import {
  APP_CONFIG,
  CONFIDENCE_TARGET,
  DEEP_ARTICLE_MAX_CHARS,
  DEEP_SCRAPE_TIMEOUT_MS,
  MAX_DEEP_ARTICLES,
} from '@/lib/config';
import { ExpandedQueriesSchema } from '@/lib/schemas/analysis';
import { invokeStructuredTask } from '@/lib/services/ai-router';
import {
  checkMultipleClaimsWithStatus,
  formatFactCheckResults,
} from '@/lib/services/factcheck';
import {
  auditSynthesisDraft,
  extractClaimsAndSignals,
  synthesizeFinalVerdictWithMeta,
} from '@/lib/services/groq';
import { rerankEvidence } from '@/lib/services/reranker';
import {
  getLastScrapeStatus,
  scrapeArticle,
} from '@/lib/services/scraper';
import {
  buildEvidenceSources,
  searchWithProvider,
} from '@/lib/services/search';
import type {
  ArticleData,
  AtomicClaim,
  ClaimAssessment,
  ConfidenceLevel,
  EvidenceSource,
  FactCheckProviderStatus,
  FactCheckResult,
  InvestigationReport,
  JournalisticSignals,
  ProviderStatus,
  RerankerMethod,
  ScraperProviderStatus,
  SearchProviderStatus,
  SearchResult,
  SourceStance,
  VerificationDepth,
  Verdict,
} from '@/lib/types';
import {
  analysisCache,
  buildImageCacheKey,
  buildUrlCacheKey,
} from '@/lib/utils/cache';
import { classifyDomain } from '@/lib/utils/credibility';
import {
  getQueryExpansionPrompt,
  type IndexedAtomicClaim,
} from '@/lib/utils/prompts';
import {
  calibrateClaimConfidence,
  calibrateConfidence,
  detectEvidenceContradiction,
} from '@/lib/utils/scoring';

export interface InvestigationInput {
  inputType: 'url' | 'image';
  inputValue: string;
  articleTitle: string;
  articleContent: string;
  language: string;
  excludeUrl?: string;
  publishedDate?: string | null;
  cacheKey?: string;
  startTimeMs?: number;
}

function normalizeUrlForComparison(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function formatRerankedEvidenceForPrompt(
  sources: EvidenceSource[],
  maxItems: number = APP_CONFIG.limits.rerankTopK
): string {
  if (sources.length === 0) return '';

  return sources
    .slice(0, maxItems)
    .map((source, index) => {
      const excerpt = source.snippet.substring(0, APP_CONFIG.limits.promptSnippetMaxLength);
      return `[${index + 1}] "${source.title}"
  URL: ${source.url}
  Source: ${source.siteName} [${source.credibilityTier} | weight=${source.credibilityWeight} | ${source.credibilityLabel} | relevance=${source.similarityScore}%]
  Date: ${source.publishedDate || 'Unknown'}
  Excerpt: ${excerpt}`;
    })
    .join('\n\n');
}

function formatDeepArticlesForPrompt(articles: ArticleData[]): string {
  if (articles.length === 0) return '';

  return articles
    .slice(0, MAX_DEEP_ARTICLES)
    .map((article, index) => {
      const credibility = classifyDomain(article.url);
      const excerpt = article.content.trim().substring(0, DEEP_ARTICLE_MAX_CHARS);
      return `[Deep Article ${index + 1}] "${article.title}" (${article.siteName || credibility.domain})
  URL: ${article.url}
  Credibility: ${credibility.tier} (weight=${credibility.weight}, ${credibility.label})
  Date: ${article.publishedDate || 'Unknown'}
  Full Content Excerpt: ${excerpt}`;
    })
    .join('\n\n');
}

function formatSupplementScrapedArticles(
  articles: ArticleData[],
  rerankedSources: EvidenceSource[],
  deepArticles: ArticleData[] = []
): string {
  const includedUrls = new Set([
    ...rerankedSources.map((source) => normalizeUrlForComparison(source.url)),
    ...deepArticles.map((article) => normalizeUrlForComparison(article.url)),
  ]);
  const missingArticles = articles.filter(
    (article) => !includedUrls.has(normalizeUrlForComparison(article.url))
  );
  if (missingArticles.length === 0) return '';

  const excerptLimit = Math.min(320, APP_CONFIG.limits.relatedArticleExcerptLength);
  return missingArticles
    .map((article, index) => {
      const credibility = classifyDomain(article.url);
      return `[Scraped ${index + 1}] "${article.title}" (${article.siteName || credibility.domain})
  URL: ${article.url}
  Credibility: ${credibility.tier} (weight=${credibility.weight}, ${credibility.label})
  Date: ${article.publishedDate || 'Unknown'}
  Excerpt: ${article.content.substring(0, excerptLimit)}`;
    })
    .join('\n\n');
}

function formatAuditEvidenceForPrompt(
  rerankedFormatted: string,
  articles: ArticleData[],
  rerankedSources: EvidenceSource[],
  deepArticles: ArticleData[] = []
): string {
  const includedUrls = new Set([
    ...rerankedSources.map((source) => normalizeUrlForComparison(source.url)),
    ...deepArticles.map((article) => normalizeUrlForComparison(article.url)),
  ]);
  const extraUrls = articles
    .filter((article) => !includedUrls.has(normalizeUrlForComparison(article.url)))
    .map((article, index) => {
      const credibility = classifyDomain(article.url);
      return `[Scraped ${index + 1}] "${article.title}" | URL: ${article.url} | ${credibility.tier} (weight=${credibility.weight})`;
    })
    .join('\n');

  return [rerankedFormatted, extraUrls].filter(Boolean).join('\n\n');
}

function deduplicateFactChecks(items: FactCheckResult[]): FactCheckResult[] {
  const seen = new Set<string>();
  const unique: FactCheckResult[] = [];

  for (const item of items) {
    const reviewUrl = item.url ? normalizeUrlForComparison(item.url) : '';
    const key =
      reviewUrl ||
      `${item.claimText.trim().toLowerCase()}::${item.publisher.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

function deduplicateSearchResults(
  items: SearchResult[],
  excludeUrl?: string
): SearchResult[] {
  const excludedNormalized = excludeUrl ? normalizeUrlForComparison(excludeUrl) : null;
  const seen = new Set<string>();
  const unique: SearchResult[] = [];

  for (const item of items) {
    const normalized = normalizeUrlForComparison(item.url);
    if (excludedNormalized && normalized === excludedNormalized) {
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(item);
    }
  }

  return unique;
}

function buildFallbackExpandedQueries(
  articleTitle: string,
  claims: IndexedAtomicClaim[],
  previousQueries: string[]
): string[] {
  const prevSet = new Set(previousQueries.map((q) => q.trim().toLowerCase()));
  const candidates = [
    articleTitle.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 7).join(' '),
    ...claims.map((c) => c.statement.trim().split(/\s+/).slice(0, 8).join(' ')),
  ];

  const unique: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || prevSet.has(trimmed.toLowerCase())) continue;
    if (!unique.some((q) => q.toLowerCase() === trimmed.toLowerCase())) {
      unique.push(trimmed);
    }
    if (unique.length >= 2) break;
  }

  return unique.length > 0 ? unique : previousQueries.slice(0, 2);
}

async function expandSearchQueries(params: {
  articleTitle: string;
  language: 'id' | 'en';
  claims: IndexedAtomicClaim[];
  previousQueries: string[];
  preliminaryVerdict: Verdict;
  preliminaryConfidence: number;
  auditNote: string;
}): Promise<string[]> {
  const prompt = getQueryExpansionPrompt(params);
  const result = await invokeStructuredTask({
    task: 'extract',
    messages: [
      {
        role: 'system',
        content:
          'You are an investigative research strategist. Generate complementary search queries including cross-language terms (Indonesian <-> English). Return strictly valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    schema: ExpandedQueriesSchema,
    maxTokens: 300,
  });

  const previousSet = new Set(params.previousQueries.map((q) => q.trim().toLowerCase()));
  const unique = new Set<string>();

  for (const rawQuery of result.data.queries) {
    const trimmed = rawQuery.trim();
    if (!trimmed || previousSet.has(trimmed.toLowerCase())) continue;
    unique.add(trimmed);
  }

  if (unique.size > 0) {
    return Array.from(unique).slice(0, 3);
  }

  return result.data.queries
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 3);
}

async function scrapeArticleWithTimeout(
  url: string,
  timeoutMs: number
): Promise<ArticleData | null> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      timerId = setTimeout(() => resolve(null), timeoutMs);
    });
    return await Promise.race([
      scrapeArticle(url).catch(() => null),
      timeoutPromise,
    ]);
  } finally {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
  }
}

const GENERIC_FACTCHECK_NOISE_TOKENS = new Set<string>([
  'cekfakta', 'turnbackhoax', 'mafindo', 'hoaks', 'hoax', 'fakta', 'klaim',
  'salah', 'keliru', 'benar', 'informasi', 'artikel', 'berita', 'unggah',
  'unggahan', 'dibagikan', 'media', 'sosial', 'pembaca', 'saran', 'tanggapan',
  'bantahan', 'periksa', 'decode', 'pewarta', 'editor', 'copyright', 'antara',
  'dilarang', 'komentar', 'suka', 'likes', 'tanda', 'focus', 'articles',
  'article', 'read', 'html', 'yang', 'untuk', 'dengan', 'dalam', 'pada',
  'dari', 'atau', 'akan', 'juga', 'tidak', 'bukan', 'oleh', 'sebagai',
  'karena', 'bahwa', 'telah', 'sudah', 'dapat', 'bisa', 'saat', 'hingga',
  'lebih', 'tentang', 'menurut', 'melalui', 'tersebut', 'adalah', 'fact',
  'check', 'false', 'true', 'misleading', 'claim', 'claims', 'video', 'foto',
  'photo', 'image', 'gambar', 'viral', 'beredar', 'fiktif', 'mengaku', 'mengakui',
]);

const NON_ARTICLE_SCRAPE_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'fb.com',
  'x.com',
  'twitter.com',
] as const;

function extractDistinctiveTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !GENERIC_FACTCHECK_NOISE_TOKENS.has(token));
  return new Set(tokens);
}

function getFactCheckRetrievedText(fc: FactCheckResult): string {
  const reviewText = fc.reviews
    .map((r) => `${r.title} ${r.textualRating}`)
    .join(' ');
  let urlPathText = '';
  try {
    urlPathText = new URL(fc.url).pathname.replace(/[-_/]/g, ' ');
  } catch {
    urlPathText = fc.url;
  }
  return `${reviewText} ${fc.summary} ${urlPathText}`.trim();
}

function countDistinctiveOverlap(
  sourceText: string,
  referenceTokens: Set<string>
): number {
  if (referenceTokens.size === 0) return 0;
  const sourceTokens = extractDistinctiveTokens(sourceText);
  let overlap = 0;
  for (const token of sourceTokens) {
    if (referenceTokens.has(token)) {
      overlap++;
    }
  }
  return overlap;
}

function filterRelevantFactChecks(
  factCheckResults: FactCheckResult[],
  referenceText: string
): FactCheckResult[] {
  const referenceTokens = extractDistinctiveTokens(referenceText);
  if (referenceTokens.size === 0) return factCheckResults;

  const minOverlap = referenceTokens.size <= 3 ? 1 : 2;
  return factCheckResults.filter((fc) => {
    const retrievedText = getFactCheckRetrievedText(fc);
    return countDistinctiveOverlap(retrievedText, referenceTokens) >= minOverlap;
  });
}

function isScrapableArticleUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (
      NON_ARTICLE_SCRAPE_DOMAINS.some(
        (blocked) => host === blocked || host.endsWith(`.${blocked}`)
      )
    ) {
      return false;
    }
    const lowerPath = parsed.pathname.toLowerCase();
    if (lowerPath.endsWith('.pdf') || lowerPath.endsWith('.jpg') || lowerPath.endsWith('.png')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function selectScrapableSearchUrls(results: SearchResult[]): string[] {
  const ranked = results
    .filter((r) => isScrapableArticleUrl(r.url))
    .map((r, index) => {
      const tier = classifyDomain(r.url).tier;
      const tierRank = tier === 'TIER_1' ? 0 : tier === 'TIER_2' ? 1 : 2;
      return { url: r.url, tierRank, index };
    });

  ranked.sort((a, b) =>
    a.tierRank !== b.tierRank ? a.tierRank - b.tierRank : a.index - b.index
  );

  return ranked.map((entry) => entry.url);
}

function selectTopDeepArticleUrls(
  rerankedSources: EvidenceSource[],
  factCheckResults: FactCheckResult[],
  excludeUrl?: string,
  maxArticles: number = MAX_DEEP_ARTICLES
): string[] {
  const excludedNorm = excludeUrl ? normalizeUrlForComparison(excludeUrl) : null;
  const candidates: Array<{ url: string; tierRank: number; originalOrder: number }> = [];
  const seen = new Set<string>();

  const addCandidate = (rawUrl: string): void => {
    if (!rawUrl || !isScrapableArticleUrl(rawUrl)) return;
    const norm = normalizeUrlForComparison(rawUrl);
    if ((excludedNorm && norm === excludedNorm) || seen.has(norm)) return;
    seen.add(norm);
    const tier = classifyDomain(rawUrl).tier;
    const tierRank = tier === 'TIER_1' ? 0 : tier === 'TIER_2' ? 1 : 2;
    candidates.push({ url: rawUrl, tierRank, originalOrder: candidates.length });
  };

  for (const source of rerankedSources) {
    addCandidate(source.url);
  }
  for (const fc of factCheckResults) {
    addCandidate(fc.url);
  }

  candidates.sort((a, b) =>
    a.tierRank !== b.tierRank ? a.tierRank - b.tierRank : a.originalOrder - b.originalOrder
  );

  return candidates.slice(0, maxArticles).map((entry) => entry.url);
}

function filterMatchedFactChecks(
  factCheckResults: FactCheckResult[],
  citedUrlSet: Set<string>,
  referenceText: string,
  verdict: Verdict
): FactCheckResult[] {
  const referenceTokens = extractDistinctiveTokens(referenceText);
  const minOverlap = referenceTokens.size <= 3 ? 1 : 2;

  return factCheckResults.filter((fc) => {
    const primaryNorm = fc.url ? normalizeUrlForComparison(fc.url) : '';
    if (primaryNorm && citedUrlSet.has(primaryNorm)) {
      return true;
    }
    if (
      fc.reviews.some(
        (rev) => rev.url && citedUrlSet.has(normalizeUrlForComparison(rev.url))
      )
    ) {
      return true;
    }
    if (verdict === 'HOAX' || verdict === 'MISLEADING') {
      const retrievedText = getFactCheckRetrievedText(fc);
      return countDistinctiveOverlap(retrievedText, referenceTokens) >= minOverlap;
    }
    return false;
  });
}

function deriveConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function deriveCredibilityScore(verdict: Verdict, confidenceScore: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(confidenceScore)));
  switch (verdict) {
    case 'VERIFIED':
      return Math.min(100, Math.round(50 + clamped / 2));
    case 'HOAX':
      return Math.max(0, Math.round(50 - clamped / 2));
    case 'MISLEADING':
      return Math.max(30, Math.min(55, Math.round(55 - clamped * 0.2)));
    case 'UNVERIFIED':
    default:
      return 50;
  }
}

function computeKeywordSimilarity(sourceText: string, referenceText: string): number {
  const tokenize = (text: string): Set<string> =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 3)
    );

  const sourceTokens = tokenize(sourceText);
  const refTokens = tokenize(referenceText);
  if (sourceTokens.size === 0 || refTokens.size === 0) return 0;

  let overlap = 0;
  refTokens.forEach((token) => {
    if (sourceTokens.has(token)) overlap++;
  });

  const ratio = overlap / Math.min(refTokens.size, 25);
  return Math.max(15, Math.min(95, Math.round(ratio * 100)));
}

function enrichEvidenceStanceAndSimilarity(
  evidenceSources: EvidenceSource[],
  claims: AtomicClaim[],
  articleTitle: string,
  articleContent: string
): EvidenceSource[] {
  const referenceText = `${articleTitle} ${articleContent.substring(0, 500)}`;

  return evidenceSources.map((source) => {
    const normalizedSourceUrl = normalizeUrlForComparison(source.url);
    const matchingClaims = claims.filter((claim) =>
      claim.supportingUrls.some(
        (u) => normalizeUrlForComparison(u) === normalizedSourceUrl
      )
    );

    let stance: SourceStance = source.stance;
    if (matchingClaims.length > 0) {
      if (matchingClaims.some((c) => c.status === 'HOAX' || c.status === 'MISLEADING')) {
        stance = 'contradicts';
      } else if (matchingClaims.some((c) => c.status === 'VERIFIED')) {
        stance = 'supports';
      }
    }

    const similarityScore =
      source.similarityScore > 0
        ? source.similarityScore
        : computeKeywordSimilarity(`${source.title} ${source.snippet}`, referenceText);

    return {
      ...source,
      stance,
      similarityScore,
    };
  });
}

function buildDerivedIndicators(
  signals: JournalisticSignals,
  claims: AtomicClaim[],
  evidenceSources: EvidenceSource[],
  factCheckResults: FactCheckResult[],
  language: string
): {
  redFlags: string[];
  positiveIndicators: string[];
  keyFindings: string[];
} {
  const isId = language === 'id';
  const redFlags: string[] = [];
  const positiveIndicators: string[] = [];

  if (signals.clickbait.detected) {
    redFlags.push(
      isId
        ? `Indikasi clickbait (${signals.clickbait.severity}): ${signals.clickbait.reason}`
        : `Clickbait detected (${signals.clickbait.severity}): ${signals.clickbait.reason}`
    );
  }

  if (signals.temporalContext.status === 'OUTDATED_RECYCLED') {
    redFlags.push(
      isId
        ? `Konteks waktu kedaluwarsa / daur ulang: ${signals.temporalContext.reason}`
        : `Outdated or recycled temporal context: ${signals.temporalContext.reason}`
    );
  } else if (signals.temporalContext.status === 'UNDATED') {
    redFlags.push(
      isId
        ? `Tanggal publikasi tidak jelas: ${signals.temporalContext.reason}`
        : `Missing publication date: ${signals.temporalContext.reason}`
    );
  } else if (signals.temporalContext.status === 'CURRENT') {
    positiveIndicators.push(
      isId
        ? `Konteks waktu terkini dan jelas: ${signals.temporalContext.reason}`
        : `Current temporal context: ${signals.temporalContext.reason}`
    );
  }

  if (signals.sourceAttribution.clarity === 'ANONYMOUS_OR_MISSING') {
    redFlags.push(
      isId
        ? `Atribusi sumber tidak jelas / anonim: ${signals.sourceAttribution.reason}`
        : `Anonymous or missing source attribution: ${signals.sourceAttribution.reason}`
    );
  } else if (signals.sourceAttribution.clarity === 'CLEAR') {
    positiveIndicators.push(
      isId
        ? `Atribusi sumber jelas: ${signals.sourceAttribution.reason}`
        : `Clear source attribution: ${signals.sourceAttribution.reason}`
    );
  }

  const tier1Count = evidenceSources.filter((s) => s.credibilityTier === 'TIER_1').length;
  if (tier1Count > 0) {
    positiveIndicators.push(
      isId
        ? `Ditemukan ${tier1Count} sumber referensi Tier 1 (kredibilitas tinggi).`
        : `Found ${tier1Count} Tier 1 high-credibility reference source(s).`
    );
  }

  const hoaxClaims = claims.filter((c) => c.status === 'HOAX' || c.status === 'MISLEADING');
  if (hoaxClaims.length > 0) {
    redFlags.push(
      isId
        ? `${hoaxClaims.length} klaim teridentifikasi hoaks atau menyesatkan.`
        : `${hoaxClaims.length} claim(s) identified as hoax or misleading.`
    );
  }

  if (factCheckResults.length > 0) {
    positiveIndicators.push(
      isId
        ? `Tersedia ${factCheckResults.length} rujukan pemeriksa fakta terkait.`
        : `Found ${factCheckResults.length} related fact-check record(s).`
    );
  }

  if (evidenceSources.length === 0 && factCheckResults.length === 0) {
    redFlags.push(
      isId
        ? 'Tidak ada bukti pembanding relevan yang ditemukan dari pencarian maupun database fact-check.'
        : 'No relevant corroborating or contradicting evidence found from search or fact-check databases.'
    );
  }

  const keyFindings = claims.map(
    (c) => `[${c.status}] ${c.statement} — ${c.reasoning}`
  );

  return { redFlags, positiveIndicators, keyFindings };
}

function buildClaimAssessments(
  claims: AtomicClaim[],
  evidenceSources: EvidenceSource[]
): ClaimAssessment[] {
  const urlToStance = new Map<string, SourceStance>();
  for (const source of evidenceSources) {
    urlToStance.set(normalizeUrlForComparison(source.url), source.stance);
  }

  return claims.map((c) => {
    const supportingSources: string[] = [];
    const contradictingSources: string[] = [];

    for (const url of c.supportingUrls) {
      const stance = urlToStance.get(normalizeUrlForComparison(url));
      if (stance === 'contradicts' || c.status === 'HOAX' || c.status === 'MISLEADING') {
        contradictingSources.push(url);
      } else {
        supportingSources.push(url);
      }
    }

    return {
      claim: c.statement,
      verdict: c.status,
      confidence: c.confidence,
      explanation: c.reasoning,
      supportingSources,
      contradictingSources,
    };
  });
}

interface ReasoningCalibrationPassInput {
  articleTitle: string;
  rawArticleTitle: string;
  articleContent: string;
  language: string;
  indexedClaims: IndexedAtomicClaim[];
  signals: JournalisticSignals;
  factCheckResults: FactCheckResult[];
  relatedArticles: ArticleData[];
  baseEvidenceSources: EvidenceSource[];
  rerankedEvidenceSources: EvidenceSource[];
  deepArticles?: ArticleData[];
  evidencePromptLimit?: number;
}

interface ReasoningCalibrationPassResult {
  summary: string;
  auditNote: string;
  selfCritiqueAdjusted: boolean;
  modelUsed: string;
  guardedClaims: AtomicClaim[];
  finalVerdict: Verdict;
  finalConfidenceScore: number;
  evidenceSources: EvidenceSource[];
}

async function runReasoningAndCalibrationPass(
  input: ReasoningCalibrationPassInput
): Promise<ReasoningCalibrationPassResult> {
  const {
    articleTitle,
    rawArticleTitle,
    articleContent,
    language,
    indexedClaims,
    signals,
    factCheckResults,
    relatedArticles,
    baseEvidenceSources,
    rerankedEvidenceSources,
    deepArticles = [],
    evidencePromptLimit = APP_CONFIG.limits.rerankTopK,
  } = input;

  const factCheckFormatted = formatFactCheckResults(factCheckResults);
  const rerankedFormatted = formatRerankedEvidenceForPrompt(
    rerankedEvidenceSources,
    evidencePromptLimit
  );
  const supplementRelatedFormatted = formatSupplementScrapedArticles(
    relatedArticles,
    rerankedEvidenceSources,
    deepArticles
  );
  const combinedEvidence = [rerankedFormatted, supplementRelatedFormatted]
    .filter(Boolean)
    .join('\n\n---\n\n');
  const deepArticlesData = formatDeepArticlesForPrompt(deepArticles);

  // Pass 1 Synthesizer -> Pass 2 Adversarial Self-Critique
  const synthesisExecution = await synthesizeFinalVerdictWithMeta(
    {
      articleTitle,
      articleContent,
      claims: indexedClaims,
      signals,
      factCheckData: factCheckFormatted,
      evidenceData: combinedEvidence,
      deepArticlesData,
    },
    language
  );
  const synthesis = synthesisExecution.data;

  const auditEvidence = formatAuditEvidenceForPrompt(
    rerankedFormatted,
    relatedArticles,
    rerankedEvidenceSources,
    deepArticles
  );

  const auditExecution = await auditSynthesisDraft(
    {
      articleTitle,
      draft: synthesis,
      rerankedEvidenceData: auditEvidence,
      factCheckData: factCheckFormatted,
      deepArticlesData,
    },
    language
  );
  const critique = auditExecution.data;

  const selfCritiqueAdjusted = !critique.approved;
  const effectiveVerdict: Verdict = selfCritiqueAdjusted
    ? critique.adjustedVerdict
    : synthesis.verdict;
  const effectiveConfidence: number = selfCritiqueAdjusted
    ? critique.adjustedConfidence
    : synthesis.confidenceScore;

  const modelUsed =
    synthesisExecution.modelUsed === auditExecution.modelUsed
      ? auditExecution.modelUsed
      : `${synthesisExecution.modelUsed} -> ${auditExecution.modelUsed}`;

  const knownEvidenceByUrl = new Map<string, EvidenceSource>();
  for (const source of baseEvidenceSources) {
    const normUrl = normalizeUrlForComparison(source.url);
    if (!knownEvidenceByUrl.has(normUrl)) {
      knownEvidenceByUrl.set(normUrl, source);
    }
  }
  for (const fc of factCheckResults) {
    if (fc.url) {
      const normUrl = normalizeUrlForComparison(fc.url);
      if (!knownEvidenceByUrl.has(normUrl)) {
        const domainInfo = classifyDomain(fc.url);
        knownEvidenceByUrl.set(normUrl, {
          title: fc.publisher,
          url: fc.url,
          siteName: fc.publisher || domainInfo.domain,
          snippet: fc.summary,
          publishedDate: fc.claimDate,
          similarityScore: 0,
          stance: 'neutral',
          credibilityTier: domainInfo.tier,
          credibilityLabel: domainInfo.label,
          credibilityWeight: domainInfo.weight,
        });
      }
    }
    for (const rev of fc.reviews) {
      if (rev.url) {
        const normUrl = normalizeUrlForComparison(rev.url);
        if (!knownEvidenceByUrl.has(normUrl)) {
          const domainInfo = classifyDomain(rev.url);
          knownEvidenceByUrl.set(normUrl, {
            title: rev.title || rev.publisher,
            url: rev.url,
            siteName: rev.publisher || domainInfo.domain,
            snippet: rev.textualRating,
            publishedDate: rev.reviewDate,
            similarityScore: 0,
            stance: 'neutral',
            credibilityTier: domainInfo.tier,
            credibilityLabel: domainInfo.label,
            credibilityWeight: domainInfo.weight,
          });
        }
      }
    }
  }

  const factCheckReviewCount = factCheckResults.reduce(
    (sum, fc) => sum + Math.max(1, fc.reviews.length),
    0
  );
  const totalRelevantEvidence = baseEvidenceSources.length + factCheckReviewCount;

  const ungroundedClaimsLower = critique.ungroundedClaims
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const normalizedClaims: AtomicClaim[] = indexedClaims.map((indexed, idx) => {
    const matched =
      synthesis.claimResults.find((r) => r.id === indexed.id) ??
      synthesis.claimResults[idx];

    if (totalRelevantEvidence === 0) {
      return {
        id: indexed.id,
        statement: matched?.statement || indexed.statement,
        searchQuery: matched?.searchQuery || indexed.searchQuery,
        status: 'UNVERIFIED',
        confidence: Math.max(0, Math.min(40, Math.round(matched?.confidence ?? 25))),
        reasoning:
          matched?.reasoning ||
          'Tidak ditemukan bukti pembanding yang cukup untuk memverifikasi klaim ini.',
        supportingUrls: [],
      };
    }

    const validSupportingUrls = (matched?.supportingUrls ?? []).filter((url) =>
      knownEvidenceByUrl.has(normalizeUrlForComparison(url))
    );

    const isFlaggedUngrounded =
      selfCritiqueAdjusted &&
      ungroundedClaimsLower.some(
        (flagged) =>
          indexed.id.toLowerCase() === flagged ||
          indexed.statement.toLowerCase() === flagged ||
          indexed.statement.toLowerCase().includes(flagged) ||
          flagged.includes(indexed.statement.toLowerCase())
      );

    if (isFlaggedUngrounded && validSupportingUrls.length === 0) {
      return {
        id: indexed.id,
        statement: matched?.statement || indexed.statement,
        searchQuery: matched?.searchQuery || indexed.searchQuery,
        status: 'UNVERIFIED',
        confidence: Math.max(
          0,
          Math.min(40, Math.round(matched?.confidence ?? effectiveConfidence))
        ),
        reasoning: matched?.reasoning || critique.auditNote,
        supportingUrls: [],
      };
    }

    const claimStatus: Verdict = matched?.status ?? 'UNVERIFIED';
    const claimStance: SourceStance =
      claimStatus === 'HOAX' || claimStatus === 'MISLEADING'
        ? 'contradicts'
        : claimStatus === 'VERIFIED'
          ? 'supports'
          : 'neutral';

    const validUrlSet = new Set(validSupportingUrls.map(normalizeUrlForComparison));
    const claimSupportingEvidence: EvidenceSource[] =
      validSupportingUrls.length > 0
        ? validSupportingUrls
          .map((url) => {
            const existing = knownEvidenceByUrl.get(normalizeUrlForComparison(url));
            return existing ? { ...existing, stance: claimStance } : null;
          })
          .filter((item): item is EvidenceSource => item !== null)
        : baseEvidenceSources;

    const claimFactChecks = filterMatchedFactChecks(
      factCheckResults,
      validUrlSet,
      indexed.statement,
      claimStatus
    );

    const rawClaimConfidence = isFlaggedUngrounded
      ? Math.min(matched?.confidence ?? effectiveConfidence, effectiveConfidence)
      : (matched?.confidence ?? effectiveConfidence);

    const calibratedClaimConfidence = calibrateClaimConfidence({
      llmConfidence: rawClaimConfidence,
      status: claimStatus,
      supportingEvidence: claimSupportingEvidence,
      factCheckMatches: claimFactChecks,
    });

    return {
      id: indexed.id,
      statement: matched?.statement || indexed.statement,
      searchQuery: matched?.searchQuery || indexed.searchQuery,
      status: claimStatus,
      confidence: calibratedClaimConfidence,
      reasoning: matched?.reasoning || synthesis.summary,
      supportingUrls: validSupportingUrls,
    };
  });

  // Mandatory Anti-Hallucination Code Guard & Majority Core-Claim Aggregation
  const totalCitedSupportingUrls = normalizedClaims.reduce(
    (sum, c) => sum + c.supportingUrls.length,
    0
  );
  const citedCredibleEvidenceCount = normalizedClaims.reduce((count, claim) => {
    const hasCredibleForClaim = claim.supportingUrls.some((url) => {
      const ev = knownEvidenceByUrl.get(normalizeUrlForComparison(url));
      return (
        ev !== undefined &&
        (ev.credibilityTier === 'TIER_1' || ev.credibilityTier === 'TIER_2')
      );
    });
    return count + (hasCredibleForClaim ? 1 : 0);
  }, 0);
  const verifiedClaimsCount = normalizedClaims.filter(
    (c) => c.status === 'VERIFIED' && c.supportingUrls.length > 0
  ).length;
  const hoaxOrMisleadingCount = normalizedClaims.filter(
    (c) => c.status === 'HOAX' || c.status === 'MISLEADING'
  ).length;
  const hasTier1OrTier2Evidence = baseEvidenceSources.some(
    (s) => s.credibilityTier === 'TIER_1' || s.credibilityTier === 'TIER_2'
  );

  const shouldPromoteToVerified =
    !selfCritiqueAdjusted &&
    effectiveVerdict === 'UNVERIFIED' &&
    totalRelevantEvidence > 0 &&
    citedCredibleEvidenceCount > 0 &&
    hoaxOrMisleadingCount === 0 &&
    hasTier1OrTier2Evidence &&
    verifiedClaimsCount >= Math.ceil(normalizedClaims.length * 0.6);

  const hasInsufficientEvidence =
    totalRelevantEvidence === 0 ||
    (factCheckReviewCount === 0 &&
      (totalCitedSupportingUrls === 0 || citedCredibleEvidenceCount === 0)) ||
    (effectiveVerdict === 'UNVERIFIED' && !shouldPromoteToVerified);

  const guardedClaims: AtomicClaim[] = normalizedClaims.map((claim) => {
    if (
      hasInsufficientEvidence &&
      ((factCheckReviewCount === 0 && claim.supportingUrls.length === 0) ||
        claim.status === 'UNVERIFIED')
    ) {
      return {
        ...claim,
        status: 'UNVERIFIED',
        confidence: Math.max(0, Math.min(40, claim.confidence)),
      };
    }
    return claim;
  });

  const preliminaryVerdict: Verdict = hasInsufficientEvidence
    ? 'UNVERIFIED'
    : shouldPromoteToVerified
      ? 'VERIFIED'
      : effectiveVerdict;

  const rawConfidenceForCalibration = shouldPromoteToVerified
    ? Math.max(
      effectiveConfidence,
      Math.round(
        guardedClaims
          .filter((c) => c.status === 'VERIFIED')
          .reduce((sum, c) => sum + c.confidence, 0) / Math.max(1, verifiedClaimsCount)
      )
    )
    : effectiveConfidence;

  const citedUrlSet = new Set(
    guardedClaims.flatMap((claim) => claim.supportingUrls.map(normalizeUrlForComparison))
  );

  const rerankedScoreByUrl = new Map<string, number>(
    rerankedEvidenceSources.map((source) => [
      normalizeUrlForComparison(source.url),
      source.similarityScore,
    ])
  );

  const allEnrichedEvidence = enrichEvidenceStanceAndSimilarity(
    baseEvidenceSources.map((source) => ({
      ...source,
      similarityScore:
        rerankedScoreByUrl.get(normalizeUrlForComparison(source.url)) ??
        source.similarityScore,
    })),
    guardedClaims,
    rawArticleTitle,
    articleContent
  );

  const matchedFactChecks = filterMatchedFactChecks(
    factCheckResults,
    citedUrlSet,
    `${rawArticleTitle} ${articleContent.substring(0, 500)}`,
    preliminaryVerdict
  );

  const hasContradiction = detectEvidenceContradiction(
    allEnrichedEvidence,
    preliminaryVerdict
  );

  const calibration = hasInsufficientEvidence
    ? {
      verdict: 'UNVERIFIED' as const,
      confidenceScore: Math.max(0, Math.min(40, Math.round(effectiveConfidence))),
      tier1AlignedCount: 0,
      tier2AlignedCount: 0,
      officialFactCheckCount: 0,
      evidenceStrengthScore: 0,
    }
    : calibrateConfidence({
      llmConfidence: rawConfidenceForCalibration,
      verdict: preliminaryVerdict,
      evidence: allEnrichedEvidence,
      factCheckMatches: matchedFactChecks,
      hasContradiction,
    });

  const baseSourcesForReport =
    rerankedEvidenceSources.length > 0 ? rerankedEvidenceSources : baseEvidenceSources;
  const reportUrlSet = new Set(
    baseSourcesForReport.map((source) => normalizeUrlForComparison(source.url))
  );
  const additionalCitedSources = allEnrichedEvidence.filter(
    (source) =>
      citedUrlSet.has(normalizeUrlForComparison(source.url)) &&
      !reportUrlSet.has(normalizeUrlForComparison(source.url))
  );

  const evidenceSources = enrichEvidenceStanceAndSimilarity(
    [...baseSourcesForReport, ...additionalCitedSources],
    guardedClaims,
    rawArticleTitle,
    articleContent
  );

  return {
    summary: synthesis.summary,
    auditNote: critique.auditNote,
    selfCritiqueAdjusted,
    modelUsed,
    guardedClaims,
    finalVerdict: calibration.verdict,
    finalConfidenceScore: calibration.confidenceScore,
    evidenceSources,
  };
}

export async function runInvestigation(
  input: InvestigationInput
): Promise<InvestigationReport> {
  const {
    inputType,
    inputValue,
    articleTitle,
    articleContent,
    language,
    excludeUrl,
    publishedDate = null,
    cacheKey,
    startTimeMs = Date.now(),
  } = input;

  // Step 1: Cache Lookup
  const resolvedCacheKey =
    cacheKey ||
    (inputType === 'url'
      ? buildUrlCacheKey(inputValue)
      : buildImageCacheKey(articleContent || inputValue));

  const cachedReport = analysisCache.get(resolvedCacheKey);
  if (cachedReport) {
    return {
      ...cachedReport,
      cached: true,
      analysisTimeMs: Date.now() - startTimeMs,
    };
  }

  // Step 2: Claim Extraction & Journalistic Signals via callGroqStructured
  const extraction = await extractClaimsAndSignals(
    articleTitle,
    articleContent,
    language,
    publishedDate
  );

  const signals: JournalisticSignals = {
    ...extraction.signals,
    temporalContext: {
      ...extraction.signals.temporalContext,
      publishedDate: extraction.signals.temporalContext.publishedDate ?? publishedDate,
    },
  };

  const indexedClaims: IndexedAtomicClaim[] = extraction.claims.map((claim, index) => ({
    id: `claim-${index + 1}`,
    statement: claim.statement,
    searchQuery: claim.searchQuery,
  }));

  // Step 3 (Putaran 1): Parallel Fast Search (depth: 'basic') + Fact-Check
  const [factCheckExecution, searchOutcomes] = await Promise.all([
    checkMultipleClaimsWithStatus(
      indexedClaims.map((claim) => claim.statement),
      extraction.language
    ),
    Promise.allSettled(
      indexedClaims.map((claim) =>
        searchWithProvider(claim.searchQuery, {
          depth: 'basic',
          maxResults: APP_CONFIG.limits.resultsPerSearchQuery,
        })
      )
    ),
  ]);

  const rawSearchResults: SearchResult[] = [];
  const rawWarnings: string[] = [...factCheckExecution.warnings];
  let tavilySucceeded = false;
  let jinaSearchSucceeded = false;

  for (const outcome of searchOutcomes) {
    if (outcome.status === 'fulfilled') {
      rawWarnings.push(...outcome.value.warnings);
      if (outcome.value.provider === 'tavily') {
        tavilySucceeded = true;
      } else if (outcome.value.provider === 'jina_search') {
        jinaSearchSucceeded = true;
      }
      rawSearchResults.push(...outcome.value.results);
    } else {
      rawWarnings.push('Salah satu permintaan pencarian berita gagal diproses.');
    }
  }

  let searchStatus: SearchProviderStatus =
    indexedClaims.length === 0
      ? 'skipped'
      : tavilySucceeded
        ? 'tavily'
        : jinaSearchSucceeded
          ? 'jina_search'
          : 'failed';
  let factcheckStatus: FactCheckProviderStatus = factCheckExecution.status;

  const factCheckReferenceText = [
    extraction.headline || articleTitle,
    ...indexedClaims.map((claim) => claim.statement),
  ].join(' ');
  const factCheckResults = filterRelevantFactChecks(
    deduplicateFactChecks(factCheckExecution.results),
    factCheckReferenceText
  );
  const searchResults = deduplicateSearchResults(rawSearchResults, excludeUrl);

  const urlsToScrape = selectScrapableSearchUrls(searchResults).slice(0, 2);
  const round1ScrapeOutcomes =
    urlsToScrape.length > 0
      ? await Promise.all(
        urlsToScrape.map((url) =>
          scrapeArticleWithTimeout(url, Math.min(DEEP_SCRAPE_TIMEOUT_MS, 4500))
        )
      )
      : [];

  const initialRelatedArticles: ArticleData[] = [];
  for (const article of round1ScrapeOutcomes) {
    if (article && article.content.length >= APP_CONFIG.limits.minArticleContentLength) {
      initialRelatedArticles.push(article);
      const status = getLastScrapeStatus(article.url);
      if (status?.warning) {
        rawWarnings.push(status.warning);
      }
    }
  }

  const relatedArticlesByUrl = new Map<string, ArticleData>();
  for (const article of initialRelatedArticles) {
    relatedArticlesByUrl.set(normalizeUrlForComparison(article.url), article);
  }

  let scraperStatus: ScraperProviderStatus = 'not_applicable';
  if (inputType === 'url') {
    const mainScrapeStatus = getLastScrapeStatus(inputValue);
    if (mainScrapeStatus) {
      scraperStatus = mainScrapeStatus.extractor;
      if (mainScrapeStatus.warning) {
        rawWarnings.push(mainScrapeStatus.warning);
      }
    } else if (initialRelatedArticles.some((article) => article.extractor === 'jina')) {
      scraperStatus = 'jina';
    } else {
      scraperStatus = 'cheerio';
    }
  }

  const baseEvidenceSources = buildEvidenceSources(
    initialRelatedArticles,
    [],
    searchResults
  );

  // Step 3.5: Semantic Evidence Reranking (Jina Reranker v2 -> Local BM25 fallback)
  const rerankQuery = [
    extraction.headline || articleTitle,
    ...indexedClaims.map((claim) => claim.statement),
  ]
    .join(' ')
    .trim();

  const { items: rerankedEvidenceSources, method: rerankerUsed } = await rerankEvidence(
    rerankQuery,
    baseEvidenceSources,
    APP_CONFIG.limits.rerankTopK
  );

  const resolvedHeadline = extraction.headline || articleTitle;
  const pass1Result = await runReasoningAndCalibrationPass({
    articleTitle: resolvedHeadline,
    rawArticleTitle: articleTitle,
    articleContent,
    language,
    indexedClaims,
    signals,
    factCheckResults,
    relatedArticles: initialRelatedArticles,
    baseEvidenceSources,
    rerankedEvidenceSources,
  });

  let activePass = pass1Result;
  let activeFactCheckResults = factCheckResults;
  let activeRerankerUsed: RerankerMethod = rerankerUsed;
  let verificationDepth: VerificationDepth = {
    passes: 1,
    deepSearchTriggered: false,
    fullArticlesRead: 0,
  };

  // Putaran 2: Deep Verification Loop when Putaran 1 confidence < CONFIDENCE_TARGET (75)
  if (pass1Result.finalConfidenceScore < CONFIDENCE_TARGET) {
    try {
      const previousQueries = indexedClaims.map((c) => c.searchQuery);
      let expandedQueries: string[];
      try {
        expandedQueries = await expandSearchQueries({
          articleTitle: resolvedHeadline,
          language: extraction.language,
          claims: indexedClaims,
          previousQueries,
          preliminaryVerdict: pass1Result.finalVerdict,
          preliminaryConfidence: pass1Result.finalConfidenceScore,
          auditNote: pass1Result.auditNote,
        });
      } catch {
        rawWarnings.push(
          'Ekspansi kueri LLM gagal; menggunakan kueri fallback untuk verifikasi mendalam.'
        );
        expandedQueries = buildFallbackExpandedQueries(
          resolvedHeadline,
          indexedClaims,
          previousQueries
        );
      }

      const [deepFactCheckExecution, deepSearchOutcomes] = await Promise.all([
        checkMultipleClaimsWithStatus(expandedQueries, extraction.language),
        Promise.allSettled(
          expandedQueries.map((query) =>
            searchWithProvider(query, {
              depth: 'advanced',
              maxResults: APP_CONFIG.limits.advancedSearchResults,
            })
          )
        ),
      ]);

      rawWarnings.push(...deepFactCheckExecution.warnings);
      if (deepFactCheckExecution.status === 'tavily_factcheck') {
        factcheckStatus = 'tavily_factcheck';
      } else if (
        factcheckStatus === 'failed' &&
        deepFactCheckExecution.status === 'jina_factcheck'
      ) {
        factcheckStatus = 'jina_factcheck';
      }

      const deepRawSearchResults: SearchResult[] = [];
      for (const outcome of deepSearchOutcomes) {
        if (outcome.status === 'fulfilled') {
          rawWarnings.push(...outcome.value.warnings);
          if (outcome.value.provider === 'tavily') {
            searchStatus = 'tavily';
          } else if (searchStatus === 'failed' && outcome.value.provider === 'jina_search') {
            searchStatus = 'jina_search';
          }
          deepRawSearchResults.push(...outcome.value.results);
        }
      }

      const mergedFactCheckResults = filterRelevantFactChecks(
        deduplicateFactChecks([
          ...factCheckResults,
          ...deepFactCheckExecution.results,
        ]),
        factCheckReferenceText
      );
      const mergedSearchResults = deduplicateSearchResults(
        [...searchResults, ...deepRawSearchResults],
        excludeUrl
      );

      const mergedBaseEvidencePreDeep = buildEvidenceSources(
        Array.from(relatedArticlesByUrl.values()),
        [],
        mergedSearchResults
      );

      const deepPromptTopK = Math.max(APP_CONFIG.limits.rerankTopK, 8);
      const { items: deepRerankedPreScrape, method: deepRerankerUsed } = await rerankEvidence(
        rerankQuery,
        mergedBaseEvidencePreDeep,
        deepPromptTopK
      );

      const topUrlsToRead = selectTopDeepArticleUrls(
        deepRerankedPreScrape,
        mergedFactCheckResults,
        excludeUrl,
        MAX_DEEP_ARTICLES
      );

      const deepScrapeResults = await Promise.all(
        topUrlsToRead.map(async (url) => {
          const existing = relatedArticlesByUrl.get(normalizeUrlForComparison(url));
          if (existing && existing.content.length >= APP_CONFIG.limits.minArticleContentLength) {
            return existing;
          }
          return scrapeArticleWithTimeout(url, DEEP_SCRAPE_TIMEOUT_MS);
        })
      );

      const deepArticles: ArticleData[] = [];
      for (const article of deepScrapeResults) {
        if (article && article.content.length >= APP_CONFIG.limits.minArticleContentLength) {
          deepArticles.push(article);
          relatedArticlesByUrl.set(normalizeUrlForComparison(article.url), article);
        }
      }

      const allScrapedArticles = Array.from(relatedArticlesByUrl.values());
      const mergedBaseEvidence = buildEvidenceSources(
        allScrapedArticles,
        [],
        mergedSearchResults
      );
      const baseByNormUrl = new Map<string, EvidenceSource>(
        mergedBaseEvidence.map((item) => [normalizeUrlForComparison(item.url), item])
      );
      const deepRerankedSources = deepRerankedPreScrape.map((item) => {
        const refreshed = baseByNormUrl.get(normalizeUrlForComparison(item.url));
        return refreshed
          ? { ...refreshed, similarityScore: item.similarityScore }
          : item;
      });

      const pass2Result = await runReasoningAndCalibrationPass({
        articleTitle: resolvedHeadline,
        rawArticleTitle: articleTitle,
        articleContent,
        language,
        indexedClaims,
        signals,
        factCheckResults: mergedFactCheckResults,
        relatedArticles: allScrapedArticles,
        baseEvidenceSources: mergedBaseEvidence,
        rerankedEvidenceSources: deepRerankedSources,
        deepArticles,
        evidencePromptLimit: deepPromptTopK,
      });

      activePass = pass2Result;
      activeFactCheckResults = mergedFactCheckResults;
      activeRerankerUsed = deepRerankerUsed;
      verificationDepth = {
        passes: 2,
        deepSearchTriggered: true,
        fullArticlesRead: deepArticles.length,
      };
    } catch (deepLoopError: unknown) {
      console.warn('Deep verification loop failed, keeping Putaran 1 results:', deepLoopError);
      rawWarnings.push(
        'Putaran verifikasi mendalam gagal diselesaikan; mempertahankan hasil Putaran 1.'
      );
    }
  }

  const providerStatus: ProviderStatus = {
    search: searchStatus,
    scraper: scraperStatus,
    factcheck: factcheckStatus,
    warnings: Array.from(new Set(rawWarnings.filter(Boolean))),
  };

  const confidenceLevel = deriveConfidenceLevel(activePass.finalConfidenceScore);
  const credibilityScore = deriveCredibilityScore(
    activePass.finalVerdict,
    activePass.finalConfidenceScore
  );

  const claimAssessments = buildClaimAssessments(
    activePass.guardedClaims,
    activePass.evidenceSources
  );
  const { redFlags, positiveIndicators, keyFindings } = buildDerivedIndicators(
    signals,
    activePass.guardedClaims,
    activePass.evidenceSources,
    activeFactCheckResults,
    language
  );

  const report: InvestigationReport = {
    inputType,
    inputValue,
    articleTitle: resolvedHeadline,
    articleContent: articleContent.substring(0, APP_CONFIG.limits.reportContentPreviewLength),
    verdict: activePass.finalVerdict,
    overallVerdict: activePass.finalVerdict,
    confidenceScore: activePass.finalConfidenceScore,
    credibilityScore,
    confidenceLevel,
    summary: activePass.summary,
    claims: activePass.guardedClaims,
    claimAssessments,
    signals,
    evidenceSources: activePass.evidenceSources,
    factCheckResults: activeFactCheckResults,
    analyzedAt: new Date().toISOString(),
    analysisTimeMs: Date.now() - startTimeMs,
    cached: false,
    providerStatus,
    aiAudit: {
      modelUsed: activePass.modelUsed,
      rerankerUsed: activeRerankerUsed,
      selfCritiqueAdjusted: activePass.selfCritiqueAdjusted,
      auditNote: activePass.auditNote,
    },
    verificationDepth,
    keyFindings,
    redFlags,
    positiveIndicators,
  };

  // Step 5: Cache Store
  analysisCache.set(resolvedCacheKey, report);

  return report;
}

export const runInvestigationPipeline = runInvestigation;
