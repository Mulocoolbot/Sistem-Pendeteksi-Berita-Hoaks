import { APP_CONFIG } from '@/lib/config';
import type {
  ExtractedClaimItem,
  FinalSynthesisOutput,
  JournalisticSignals,
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
3. "claims": 1 to 5 atomic, independently verifiable core factual claims (exclude pure opinions/speculation; combine minor technical sub-metrics like exact seconds or sensor amplitudes into the main event claim rather than splitting trivial measurements into separate claims). If the article is a fact-check/debunk (e.g., [SALAH], [HOAKS], [KLARIFIKASI]), extract the ORIGINAL viral claim being tested/debunked (NOT the fact-checker's conclusion that it is false). Each claim must have:
   - "statement": clear factual assertion.
   - "searchQuery": concise 3 to 5 core keywords ONLY (main entities + event/topic; omit exact clock times like "01.51 WIB" or minor measurements like "97 detik") for web news search.
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
}

export function getFinalSynthesisPrompt(input: FinalSynthesisPromptInput): string {
  const { articleTitle, articleContent, claims, signals, factCheckData, evidenceData } = input;

  const claimsSection = claims
    .map((c) => `- id: "${c.id}" | statement: "${c.statement}" | searchQuery: "${c.searchQuery}"`)
    .join('\n');

  const signalsSection = [
    `Clickbait: detected=${signals.clickbait.detected}, severity=${signals.clickbait.severity} (${signals.clickbait.reason})`,
    `Temporal: status=${signals.temporalContext.status}, publishedDate=${signals.temporalContext.publishedDate ?? 'null'} (${signals.temporalContext.reason})`,
    `Attribution: clarity=${signals.sourceAttribution.clarity} (${signals.sourceAttribution.reason})`,
  ].join('\n');

  return `Investigate the factual accuracy of the article and its atomic claims using ONLY the gathered evidence and credibility tiers below.
Evidence tiers: TIER_1 (weight 1.0 = official fact-checkers, government/academic domains, verified mainstream outlets), TIER_2 (weight 0.6 = general news portals), TIER_3 (weight 0.25 = unverified blogs, UGC, social media).
Rules:
- Allowed verdicts: "VERIFIED", "MISLEADING", "HOAX", "UNVERIFIED".
- If evidence is missing, weak, or unrelated to the claim, use "UNVERIFIED" and keep confidenceScore low (<= 40). Do NOT guess or hallucinate facts outside the provided evidence.
- Use "MISLEADING" ONLY when evidence directly contradicts key details or demonstrates distortion/out-of-context framing. NEVER mark a claim or article "MISLEADING" merely because an evidence excerpt omits secondary numerical details or reports an adjacent update of the same ongoing event.
- If the core claims (or a majority of claims) are corroborated by credible TIER_1 or TIER_2 sources and no source refutes or disproves them, overall "verdict" MUST be "VERIFIED" (do NOT downgrade the overall verdict to "UNVERIFIED" just because a minor secondary claim is not mentioned in snippets).
- If fact-checks or credible news sources refute/debunk a claim (state it is false, hoaks, salah, keliru, or fabricated), set "status" and overall "verdict" to "HOAX" (or "MISLEADING" if partially true, recycled, or out-of-context), explain the debunking, and include those debunking evidence URLs in "supportingUrls". Even if the input URL itself is a fact-check article (e.g., [SALAH], [HOAKS], [KLARIFIKASI]), judge the veracity of the underlying viral claim being debunked—do NOT mark it "VERIFIED" merely because fact-checkers confirm it is false.
- In "claimResults", include one entry for each claim using its exact "id", "statement", and "searchQuery", with "status" ("VERIFIED"|"MISLEADING"|"HOAX"|"UNVERIFIED"), "confidence" (0-100), "reasoning", and "supportingUrls" (only real URLs present in the evidence below that verify OR refute the claim, or [] if none).
- "confidenceScore" must be a number from 0 to 100 reflecting evidence strength and source tiers.

TITLE: ${articleTitle}
CONTENT: ${articleContent.substring(0, APP_CONFIG.limits.investigationPromptContentMaxLength)}

EXTRACTED CLAIMS:
${claimsSection}

JOURNALISTIC SIGNALS:
${signalsSection}

FACT-CHECKS:
${factCheckData || 'None.'}

EVIDENCE SOURCES (WITH CREDIBILITY TIERS):
${evidenceData || 'None.'}

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
}

export function getAuditCritiquePrompt(input: AuditCritiquePromptInput): string {
  const { articleTitle, draft, rerankedEvidenceData, factCheckData } = input;

  return `You are an adversarial fact-checking auditor. Perform a strict Pass-2 audit on the Pass-1 draft synthesis below against ONLY the provided fact-checks and reranked evidence sources (including their URLs and credibility tiers).

Check every claim and overall verdict for:
1. Hallucinated or unsupported URLs (any URL in "supportingUrls" not present in FACT-CHECKS or RERANKED EVIDENCE SOURCES).
2. Reasoning that asserts facts not supported by the provided evidence snippets or fact-check records.
3. Verdict or confidenceScore inflation (e.g., marking "VERIFIED" or "HOAX" with high confidence when evidence is absent, unrelated, or only from TIER_3 sources; or marking "MISLEADING" without actual contradiction).

Rules:
- If all claim reasoning, cited URLs, verdict, and confidence are well-grounded in the provided evidence: set "approved": true, keep "adjustedVerdict" equal to the draft's verdict, keep "adjustedConfidence" aligned with the draft, set "ungroundedClaims": [], and write a concise "auditNote".
- If any claim or overall verdict is ungrounded, overstated, or contradicts the evidence: set "approved": false, provide the corrected "adjustedVerdict" ("VERIFIED" | "MISLEADING" | "HOAX" | "UNVERIFIED"), provide a calibrated "adjustedConfidence" (0..100, <= 40 if evidence is missing/insufficient), list the ungrounded claim IDs or statements in "ungroundedClaims", and explain the adjustment in "auditNote".

ARTICLE TITLE: ${articleTitle}

PASS-1 DRAFT SYNTHESIS:
${JSON.stringify(draft)}

FACT-CHECKS:
${factCheckData || 'None.'}

RERANKED EVIDENCE SOURCES (WITH URL & TIER):
${rerankedEvidenceData || 'None.'}

Return strictly valid JSON matching this schema:
{
  "approved": true,
  "adjustedVerdict": "VERIFIED",
  "adjustedConfidence": 0,
  "ungroundedClaims": [],
  "auditNote": "..."
}`;
}
