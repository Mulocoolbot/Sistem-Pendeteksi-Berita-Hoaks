import { APP_CONFIG } from '@/lib/config';
import type {
  ExtractedClaimItem,
  FinalSynthesisOutput,
  JournalisticSignals,
  Verdict,
} from '@/lib/types';

export interface IndexedAtomicClaim extends ExtractedClaimItem {
  id: string;
}

export function getClaimExtractionPrompt(
  title: string,
  content: string,
  publishedDate: string | null = null
): string {
  return `Analyze the article/content below and extract:
1. "headline": concise main headline or topic title.
2. "language": strictly "id" (for Indonesian content) or "en" (for English or non-Indonesian content).
3. "claims": 1 to 3 (max 5 only when multiple distinct events exist) atomic, independently verifiable core factual claims (exclude pure opinions/speculation; combine minor technical sub-metrics such as exact coordinates, depth, clock times, fault slip details, or aftershock cutoff timestamps into the main event claim rather than splitting telemetry into separate claims). CRITICAL FOR FACT-CHECK / CLARIFICATION ARTICLES: If the article is a fact-check or clarification (e.g., "[SALAH]", "[HOAKS]", "[KLARIFIKASI]", "[CEK FAKTA]", "Konteks Keliru", "Disinformasi", "Faktanya:", "Bukan ..."), you MUST extract ONLY the underlying false or misleading VIRAL CLAIM circulating on social media (for example: "Foto koran Independent Observer yang beredar pada 2024 merupakan media internasional baru yang mengkritik Presiden Jokowi", or "Video yang beredar menunjukkan Tim INASAR tiba di Turki pada Februari 2023"). NEVER extract the fact-checker's correction/conclusion (do NOT extract "...adalah konten lama", "...bukan media internasional", or "...adalah salah")! Each claim must have:
   - "statement": clear factual assertion.
   - "searchQuery": concise 3 to 5 core keywords ONLY in the article's primary language ("id" -> Indonesian keywords for Indonesian news/agencies like BMKG/BPOM/BPS; "en" -> English keywords). Focus on main entities + event/topic; omit exact coordinates, clock times like "01.51 WIB", or minor measurements.
4. "signals": journalistic quality signals:
   - "clickbait": { "detected": boolean, "severity": "LOW" | "MEDIUM" | "HIGH", "reason": string }
   - "temporalContext": { "status": "CURRENT" | "OUTDATED_RECYCLED" | "UNDATED" | "UNCLEAR", "publishedDate": string | null, "reason": string }
   - "sourceAttribution": { "clarity": "CLEAR" | "PARTIAL" | "ANONYMOUS_OR_MISSING", "reason": string }

TITLE: ${title}
DETECTED_PUBLISHED_DATE: ${publishedDate || 'Unknown'}
CONTENT: ${content.substring(0, APP_CONFIG.limits.claimPromptContentMaxLength)}

Return strictly valid JSON matching this schema:
{
  "headline": "...",
  "language": "id",
  "claims": [
    { "statement": "...", "searchQuery": "..." }
  ],
  "signals": {
    "clickbait": { "detected": false, "severity": "LOW", "reason": "..." },
    "temporalContext": { "status": "CURRENT", "publishedDate": null, "reason": "..." },
    "sourceAttribution": { "clarity": "CLEAR", "reason": "..." }
  }
}`;
}

export function getImageAnalysisPrompt(): string {
  return `Extract all visible text, classify contentType, detect outlet/source and date if visible (else null), and summarize.

Return strictly valid JSON:
{"extractedText":"...","contentType":"news-screenshot|social-media|poster|meme|other","detectedSource":null,"detectedDate":null,"summary":"..."}`;
}

export interface FinalSynthesisPromptInput {
  articleTitle: string;
  articleContent: string;
  claims: IndexedAtomicClaim[];
  signals: JournalisticSignals;
  factCheckData: string;
  evidenceData: string;
  deepArticlesData?: string;
}

export function getFinalSynthesisPrompt(input: FinalSynthesisPromptInput): string {
  const {
    articleTitle,
    articleContent,
    claims,
    signals,
    factCheckData,
    evidenceData,
    deepArticlesData,
  } = input;

  const claimsSection = claims
    .map((c) => `- id: "${c.id}" | statement: "${c.statement}" | searchQuery: "${c.searchQuery}"`)
    .join('\n');

  const signalsSection = [
    `Clickbait: detected=${signals.clickbait.detected}, severity=${signals.clickbait.severity} (${signals.clickbait.reason})`,
    `Temporal: status=${signals.temporalContext.status}, publishedDate=${signals.temporalContext.publishedDate ?? 'null'} (${signals.temporalContext.reason})`,
    `Attribution: clarity=${signals.sourceAttribution.clarity} (${signals.sourceAttribution.reason})`,
  ].join('\n');

  const deepArticlesSection = deepArticlesData
    ? `\n\nFULL-TEXT CORROBORATING ARTICLES (DEEP READING):\n${deepArticlesData}`
    : '';

  return `Investigate the factual accuracy of the article and its atomic claims using ONLY the gathered evidence and credibility tiers below.
Evidence tiers: TIER_1 (weight 1.0 = official fact-checkers, government/academic domains, verified mainstream outlets), TIER_2 (weight 0.6 = general news portals), TIER_3 (weight 0.25 = unverified blogs, UGC, social media).
Rules:
- Allowed verdicts: "VERIFIED", "MISLEADING", "HOAX", "UNVERIFIED".
- If evidence is missing, weak, or unrelated to the claim, use "UNVERIFIED" and keep confidenceScore low (<= 40). Do NOT guess or hallucinate facts outside the provided evidence. Specifically: if a claim involves unknown, fictional, futuristic, or uncorroborated entities/events and NO provided fact-check or credible TIER_1/TIER_2 source explicitly refutes that specific claim (even if generic background articles like Lake Toba, Krakatau, or Atlantis appear), you MUST return "UNVERIFIED" with confidenceScore <= 40 — NEVER mark it "HOAX" without explicit refutation evidence.
- Use "MISLEADING" ONLY when evidence directly contradicts key facts or demonstrates distortion/out-of-context framing. NEVER mark a claim or article "MISLEADING" merely because an evidence excerpt omits secondary details, reports an adjacent update of the same ongoing event, or shows normal minor cross-agency measurement variations for the exact same confirmed event (e.g., BMKG reporting magnitude 6.9 vs USGS/AP reporting 7.0, or slight coordinate/casualty rounding).
- If the core claims (or a majority of claims) are corroborated by credible TIER_1 or TIER_2 sources and no source refutes or disproves them, overall "verdict" MUST be "VERIFIED" (do NOT downgrade the overall verdict to "UNVERIFIED" just because a minor secondary claim is not mentioned in snippets).
- If fact-checks or credible news sources refute/debunk a claim (state it is false, hoaks, salah, keliru, or fabricated), set "status" and overall "verdict" to "HOAX" (or "MISLEADING" if real media/photo/video/article is recycled or shared with wrong/out-of-context framing such as "Konteks Keliru"), explain the debunking, and include those debunking evidence URLs in "supportingUrls". CRITICAL: Even when the input article itself is a fact-check or clarification article (e.g., "[SALAH]", "[HOAKS]", "[KLARIFIKASI]", "Konteks Keliru", "Cek Fakta", "Disinformasi"), ALWAYS judge the veracity of the UNDERLYING VIRAL CLAIM ("HOAX" or "MISLEADING") — NEVER mark it "VERIFIED" merely because the clarification article accurately debunks the viral claim.
- In "claimResults", include one entry for each claim using its exact "id", "statement", and "searchQuery", with "status" ("VERIFIED"|"MISLEADING"|"HOAX"|"UNVERIFIED"), "confidence" (0-100), "reasoning", and "supportingUrls" (only real URLs present in the evidence below that verify OR refute the claim, or [] if none).
- "confidenceScore" must be a number from 0 to 100 reflecting genuine evidence strength: 80-95 when multiple independent TIER_1 sources or official fact-checks agree without contradiction; <= 68 when credible sources conflict; <= 40 when evidence is missing or unrelated.

TITLE: ${articleTitle}
CONTENT: ${articleContent.substring(0, APP_CONFIG.limits.investigationPromptContentMaxLength)}

EXTRACTED CLAIMS:
${claimsSection}

JOURNALISTIC SIGNALS:
${signalsSection}

FACT-CHECKS:
${factCheckData || 'None.'}

EVIDENCE SOURCES (WITH CREDIBILITY TIERS):
${evidenceData || 'None.'}${deepArticlesSection}

Return strictly valid JSON matching this schema:
{
  "verdict": "VERIFIED",
  "confidenceScore": 0,
  "summary": "2-3 concise paragraphs summarizing findings",
  "claimResults": [
    {
      "id": "claim-1",
      "statement": "...",
      "searchQuery": "...",
      "status": "UNVERIFIED",
      "confidence": 0,
      "reasoning": "...",
      "supportingUrls": []
    }
  ]
}`;
}

export interface AuditCritiquePromptInput {
  articleTitle: string;
  draft: FinalSynthesisOutput;
  rerankedEvidenceData: string;
  factCheckData: string;
  deepArticlesData?: string;
}

export function getAuditCritiquePrompt(input: AuditCritiquePromptInput): string {
  const { articleTitle, draft, rerankedEvidenceData, factCheckData, deepArticlesData } = input;

  const deepArticlesSection = deepArticlesData
    ? `\n\nFULL-TEXT CORROBORATING ARTICLES (DEEP READING):\n${deepArticlesData}`
    : '';

  return `You are an adversarial fact-checking auditor. Perform a strict Pass-2 audit on the Pass-1 draft synthesis below against ONLY the provided fact-checks, reranked evidence sources, and full-text corroborating articles (including their URLs and credibility tiers).

Check every claim and overall verdict for:
1. Hallucinated or unsupported URLs (any URL in "supportingUrls" not present in FACT-CHECKS, RERANKED EVIDENCE SOURCES, or FULL-TEXT CORROBORATING ARTICLES).
2. Reasoning that asserts facts not supported by the provided evidence snippets, full-text articles, or fact-check records.
3. Verdict or confidenceScore inflation (e.g., marking "VERIFIED" or "HOAX" with high confidence when evidence is absent, unrelated generic background pages, or only from TIER_3 sources without a matching fact-check record; or marking "MISLEADING" due to normal minor cross-agency measurement differences such as earthquake magnitude 6.9 vs 7.0 on the exact same confirmed event).
4. Fact-check / clarification verdict inversion: If the input ARTICLE TITLE or context is a fact-check/clarification article (e.g., "[SALAH]", "[HOAKS]", "[KLARIFIKASI]", "Konteks Keliru", "Cek Fakta", "Disinformasi"), the overall verdict MUST judge the underlying viral claim ("MISLEADING" for out-of-context/recycled/wrong-context framing; "HOAX" for fabricated claims) — NEVER approve "VERIFIED" merely because the clarification article itself is accurate!

Rules:
- If all claim reasoning, cited URLs, verdict, and confidence are well-grounded in the provided evidence (and not an inverted clarification article): set "approved": true, keep "adjustedVerdict" equal to the draft's verdict, keep "adjustedConfidence" aligned with the draft, set "ungroundedClaims": [], and write a concise "auditNote".
- If the input is a fact-check/clarification article ("[SALAH]", "[HOAKS]", "[KLARIFIKASI]", "Konteks Keliru") and the Pass-1 draft marked it "VERIFIED" because the clarification article is accurate, set "approved": false, set "adjustedVerdict" to "MISLEADING" (if out-of-context/recycled/wrong-context) or "HOAX" (if fabricated), and explain the correction in "auditNote".
- If a draft marks an uncorroborated/fictional claim as "HOAX" without explicit refutation in FACT-CHECKS or TIER_1/TIER_2 evidence (citing only generic background pages or TIER_3 sources), set "approved": false, "adjustedVerdict": "UNVERIFIED", and "adjustedConfidence" <= 40.
- If any other claim or overall verdict is ungrounded, overstated, or contradicts the evidence: set "approved": false, provide the corrected "adjustedVerdict" ("VERIFIED" | "MISLEADING" | "HOAX" | "UNVERIFIED"), provide a calibrated "adjustedConfidence" (0..100, <= 40 if evidence is missing/insufficient), list the ungrounded claim IDs or statements in "ungroundedClaims", and explain the adjustment in "auditNote".

ARTICLE TITLE: ${articleTitle}

PASS-1 DRAFT SYNTHESIS:
${JSON.stringify(draft)}

FACT-CHECKS:
${factCheckData || 'None.'}

RERANKED EVIDENCE SOURCES (WITH URL & TIER):
${rerankedEvidenceData || 'None.'}${deepArticlesSection}

Return strictly valid JSON matching this schema:
{
  "approved": true,
  "adjustedVerdict": "VERIFIED",
  "adjustedConfidence": 0,
  "ungroundedClaims": [],
  "auditNote": "..."
}`;
}

export interface QueryExpansionPromptInput {
  articleTitle: string;
  language: 'id' | 'en';
  claims: IndexedAtomicClaim[];
  previousQueries: string[];
  preliminaryVerdict: Verdict;
  preliminaryConfidence: number;
  auditNote: string;
}

export function getQueryExpansionPrompt(input: QueryExpansionPromptInput): string {
  const {
    articleTitle,
    language,
    claims,
    previousQueries,
    preliminaryVerdict,
    preliminaryConfidence,
    auditNote,
  } = input;

  const claimsSummary = claims
    .map((c) => `- ${c.statement} (prev query: "${c.searchQuery}")`)
    .join('\n');

  const crossLangDirection =
    language === 'id'
      ? 'Indonesian -> English (at least 1 concise English search query for international/official sources)'
      : 'English -> Indonesian (at least 1 concise Indonesian search query if relevant, plus an English primary-entity query)';

  return `Round-1 verification produced insufficient confidence (${preliminaryConfidence}%, preliminary verdict: ${preliminaryVerdict}). Generate 2 to 3 complementary web search queries to find primary, official, or cross-language corroborating/debunking evidence.

Requirements:
- Each query must be 3 to 7 focused keywords (core entities, person/institution names, event, year/location).
- Do NOT repeat any previous query verbatim: ${JSON.stringify(previousQueries)}.
- Cross-language requirement: ${crossLangDirection}.
- Include at least one query targeting official statements, press releases, or fact-check records when applicable.

ARTICLE TITLE: ${articleTitle}
CLAIMS:
${claimsSummary}
ROUND-1 AUDIT NOTE: ${auditNote}

Return strictly valid JSON matching this schema:
{
  "queries": ["query 1", "query 2", "query 3"]
}`;
}
