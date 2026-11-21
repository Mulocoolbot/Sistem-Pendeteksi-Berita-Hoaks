import { APP_CONFIG } from '@/lib/config';
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
  scrapeMultipleArticlesWithStatus,
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
  FactCheckResult,
  InvestigationReport,
  JournalisticSignals,
  ProviderStatus,
  ScraperProviderStatus,
  SearchProviderStatus,
  SearchResult,
  SourceStance,
  Verdict,
} from '@/lib/types';
import {
  analysisCache,
  buildImageCacheKey,
  buildUrlCacheKey,
} from '@/lib/utils/cache';
import { classifyDomain } from '@/lib/utils/credibility';
import type { IndexedAtomicClaim } from '@/lib/utils/prompts';

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

function formatRerankedEvidenceForPrompt(sources: EvidenceSource[]): string {
  if (sources.length === 0) return '';

  return sources
    .slice(0, APP_CONFIG.limits.rerankTopK)
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

function formatSupplementScrapedArticles(
  articles: ArticleData[],
  rerankedSources: EvidenceSource[]
): string {
  const includedUrls = new Set(
    rerankedSources.map((source) => normalizeUrlForComparison(source.url))
  );
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
  rerankedSources: EvidenceSource[]
): string {
  const includedUrls = new Set(
    rerankedSources.map((source) => normalizeUrlForComparison(source.url))
  );
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

function computeTierCeiling(weights: number[]): number {
  if (weights.length === 0) return 40;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const maxWeight = Math.max(...weights);

  if (maxWeight >= 1.0) {
    return Math.min(100, 65 + Math.round(Math.min(totalWeight, 3.5) * 10));
  }
  if (maxWeight >= 0.6) {
    return Math.min(80, 50 + Math.round(Math.min(totalWeight, 3.0) * 10));
  }
  return Math.min(55, 35 + Math.round(Math.min(totalWeight, 2.0) * 10));
}

function calibrateConfidenceScore(rawScore: number, weights: number[]): number {
  if (weights.length === 0) {
    return Math.max(0, Math.min(40, Math.round(rawScore)));
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const avgWeight = totalWeight / weights.length;
  const tierFactor = 0.6 + 0.4 * avgWeight;
  const ceiling = computeTierCeiling(weights);

  return Math.max(0, Math.min(ceiling, Math.round(rawScore * tierFactor)));
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

  // Step 3: Parallel Evidence Verification per Claim via Promise.allSettled
  const [factCheckExecution, searchOutcomes] = await Promise.all([
    checkMultipleClaimsWithStatus(
      indexedClaims.map((claim) => claim.statement),
      extraction.language
    ),
    Promise.allSettled(
      indexedClaims.map((claim) =>
        searchWithProvider(claim.searchQuery, APP_CONFIG.limits.resultsPerSearchQuery)
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

  const searchStatus: SearchProviderStatus =
    indexedClaims.length === 0
      ? 'skipped'
      : tavilySucceeded
        ? 'tavily'
        : jinaSearchSucceeded
          ? 'jina_search'
          : 'failed';

  const factCheckResults = deduplicateFactChecks(factCheckExecution.results);
  const searchResults = deduplicateSearchResults(rawSearchResults, excludeUrl);

  const urlsToScrape = searchResults.map((result) => result.url);
  const { articles: relatedArticles, warnings: relatedScrapeWarnings } =
    urlsToScrape.length > 0
      ? await scrapeMultipleArticlesWithStatus(
        urlsToScrape,
        APP_CONFIG.limits.maxRelatedArticlesToScrape
      )
      : { articles: [], warnings: [] };

  rawWarnings.push(...relatedScrapeWarnings);

  let scraperStatus: ScraperProviderStatus = 'not_applicable';
  if (inputType === 'url') {
    const mainScrapeStatus = getLastScrapeStatus(inputValue);
    if (mainScrapeStatus) {
      scraperStatus = mainScrapeStatus.extractor;
      if (mainScrapeStatus.warning) {
        rawWarnings.push(mainScrapeStatus.warning);
      }
    } else if (relatedArticles.some((article) => article.extractor === 'jina')) {
      scraperStatus = 'jina';
    } else {
      scraperStatus = 'cheerio';
    }
  }

  const providerStatus: ProviderStatus = {
    search: searchStatus,
    scraper: scraperStatus,
    factcheck: factCheckExecution.status,
    warnings: Array.from(new Set(rawWarnings.filter(Boolean))),
  };

  const baseEvidenceSources = buildEvidenceSources(
    relatedArticles,
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

  const factCheckFormatted = formatFactCheckResults(factCheckResults);
  const rerankedFormatted = formatRerankedEvidenceForPrompt(rerankedEvidenceSources);
  const supplementRelatedFormatted = formatSupplementScrapedArticles(
    relatedArticles,
    rerankedEvidenceSources
  );
  const combinedEvidence = [rerankedFormatted, supplementRelatedFormatted]
    .filter(Boolean)
    .join('\n\n---\n\n');

  // Step 4: 2-Pass Reasoning (Pass 1 Synthesizer -> Pass 2 Adversarial Self-Critique)
  const synthesisExecution = await synthesizeFinalVerdictWithMeta(
    {
      articleTitle: extraction.headline || articleTitle,
      articleContent,
      claims: indexedClaims,
      signals,
      factCheckData: factCheckFormatted,
      evidenceData: combinedEvidence,
    },
    language
  );
  const synthesis = synthesisExecution.data;

  const auditEvidence = formatAuditEvidenceForPrompt(
    rerankedFormatted,
    relatedArticles,
    rerankedEvidenceSources
  );

  const auditExecution = await auditSynthesisDraft(
    {
      articleTitle: extraction.headline || articleTitle,
      draft: synthesis,
      rerankedEvidenceData: auditEvidence,
      factCheckData: factCheckFormatted,
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

  const knownEvidenceWeights = new Map<string, number>();
  for (const source of baseEvidenceSources) {
    knownEvidenceWeights.set(
      normalizeUrlForComparison(source.url),
      source.credibilityWeight
    );
  }
  for (const fc of factCheckResults) {
    if (fc.url) {
      const domainInfo = classifyDomain(fc.url);
      const normUrl = normalizeUrlForComparison(fc.url);
      if (!knownEvidenceWeights.has(normUrl)) {
        knownEvidenceWeights.set(normUrl, domainInfo.weight);
      }
    }
    for (const rev of fc.reviews) {
      if (rev.url) {
        const domainInfo = classifyDomain(rev.url);
        const normUrl = normalizeUrlForComparison(rev.url);
        if (!knownEvidenceWeights.has(normUrl)) {
          knownEvidenceWeights.set(normUrl, domainInfo.weight);
        }
      }
    }
  }

  const factCheckReviewCount = factCheckResults.reduce(
    (sum, fc) => sum + Math.max(1, fc.reviews.length),
    0
  );
  const totalRelevantEvidence = baseEvidenceSources.length + factCheckReviewCount;
  const allEvidenceWeights = Array.from(knownEvidenceWeights.values());

  const ungroundedClaimsLower = critique.ungroundedClaims
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  // Normalize claims against extracted claims, enforce valid evidence URLs, and apply Pass 2 critique
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
      knownEvidenceWeights.has(normalizeUrlForComparison(url))
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

    const claimWeights =
      validSupportingUrls.length > 0
        ? validSupportingUrls
          .map((url) => knownEvidenceWeights.get(normalizeUrlForComparison(url)) ?? 0.25)
        : allEvidenceWeights;

    const rawClaimConfidence = isFlaggedUngrounded
      ? Math.min(matched?.confidence ?? effectiveConfidence, effectiveConfidence)
      : (matched?.confidence ?? effectiveConfidence);

    const calibratedClaimConfidence = calibrateConfidenceScore(
      rawClaimConfidence,
      claimWeights
    );

    return {
      id: indexed.id,
      statement: matched?.statement || indexed.statement,
      searchQuery: matched?.searchQuery || indexed.searchQuery,
      status: matched?.status ?? 'UNVERIFIED',
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
    totalCitedSupportingUrls > 0 &&
    hoaxOrMisleadingCount === 0 &&
    hasTier1OrTier2Evidence &&
    verifiedClaimsCount >= Math.ceil(normalizedClaims.length * 0.6);

  const hasInsufficientEvidence =
    totalRelevantEvidence === 0 ||
    (factCheckReviewCount === 0 && totalCitedSupportingUrls === 0) ||
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

  const finalVerdict: Verdict = hasInsufficientEvidence
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
  const finalConfidenceScore: number = hasInsufficientEvidence
    ? Math.max(0, Math.min(40, Math.round(effectiveConfidence)))
    : calibrateConfidenceScore(rawConfidenceForCalibration, allEvidenceWeights);

  const confidenceLevel = deriveConfidenceLevel(finalConfidenceScore);
  const credibilityScore = deriveCredibilityScore(finalVerdict, finalConfidenceScore);

  const sourcesForReport =
    rerankedEvidenceSources.length > 0 ? rerankedEvidenceSources : baseEvidenceSources;
  const evidenceSources = enrichEvidenceStanceAndSimilarity(
    sourcesForReport,
    guardedClaims,
    articleTitle,
    articleContent
  );

  const claimAssessments = buildClaimAssessments(guardedClaims, evidenceSources);
  const { redFlags, positiveIndicators, keyFindings } = buildDerivedIndicators(
    signals,
    guardedClaims,
    evidenceSources,
    factCheckResults,
    language
  );

  const report: InvestigationReport = {
    inputType,
    inputValue,
    articleTitle: extraction.headline || articleTitle,
    articleContent: articleContent.substring(0, APP_CONFIG.limits.reportContentPreviewLength),
    verdict: finalVerdict,
    overallVerdict: finalVerdict,
    confidenceScore: finalConfidenceScore,
    credibilityScore,
    confidenceLevel,
    summary: synthesis.summary,
    claims: guardedClaims,
    claimAssessments,
    signals,
    evidenceSources,
    factCheckResults,
    analyzedAt: new Date().toISOString(),
    analysisTimeMs: Date.now() - startTimeMs,
    cached: false,
    providerStatus,
    aiAudit: {
      modelUsed,
      rerankerUsed,
      selfCritiqueAdjusted,
      auditNote: critique.auditNote,
    },
    keyFindings,
    redFlags,
    positiveIndicators,
  };

  // Step 5: Cache Store
  analysisCache.set(resolvedCacheKey, report);

  return report;
}

export const runInvestigationPipeline = runInvestigation;
