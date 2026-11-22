import type { EvidenceSource, FactCheckResult, Verdict } from '@/lib/types';
import { classifyDomain } from '@/lib/utils/credibility';

export interface CalibrateConfidenceInput {
  llmConfidence: number;
  verdict: Verdict;
  evidence: EvidenceSource[];
  factCheckMatches: FactCheckResult[];
  hasContradiction: boolean;
}

export interface CalibratedConfidenceResult {
  verdict: Verdict;
  confidenceScore: number;
  tier1AlignedCount: number;
  tier2AlignedCount: number;
  officialFactCheckCount: number;
  evidenceStrengthScore: number;
}

function normalizeUrlKey(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Detects genuine factual contradiction among credible sources for a given verdict.
 * For MISLEADING verdicts, partial truth alongside corrections is expected, so only
 * explicit caller-level contradiction is treated as ambiguity unless Tier-1 sources split.
 */
export function detectEvidenceContradiction(
  evidence: EvidenceSource[],
  verdict: Verdict
): boolean {
  if (verdict === 'UNVERIFIED' || verdict === 'MISLEADING') {
    return false;
  }

  const seenUrls = new Set<string>();
  let tier1Supports = 0;
  let tier1Contradicts = 0;
  let tier2Contradicts = 0;

  for (const item of evidence) {
    const key = normalizeUrlKey(item.url);
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);

    if (item.credibilityTier === 'TIER_1') {
      if (item.stance === 'supports') tier1Supports++;
      if (item.stance === 'contradicts') tier1Contradicts++;
    } else if (item.credibilityTier === 'TIER_2') {
      if (item.stance === 'contradicts') tier2Contradicts++;
    }
  }

  if (tier1Supports > 0 && tier1Contradicts > 0) {
    return true;
  }

  if (verdict === 'VERIFIED' && (tier1Contradicts > 0 || tier2Contradicts > 0)) {
    return true;
  }

  return false;
}

/**
 * Calibrates final confidence score deterministically using LLM judgement and
 * consensus strength across tiered evidence and official fact-checkers.
 * Preserves the anti-hallucination guard (<= 40 when evidence is empty or UNVERIFIED)
 * and caps conflicting-source cases at <= 68 without hardcoding artificial floors.
 */
export function calibrateConfidence(
  input: CalibrateConfidenceInput
): CalibratedConfidenceResult {
  const { llmConfidence, verdict, evidence, factCheckMatches, hasContradiction } = input;
  const clampedLlm = clampScore(llmConfidence);
  const totalRelevantEvidence = evidence.length + factCheckMatches.length;

  if (totalRelevantEvidence === 0 || verdict === 'UNVERIFIED') {
    return {
      verdict: 'UNVERIFIED',
      confidenceScore: Math.min(clampedLlm, 40),
      tier1AlignedCount: 0,
      tier2AlignedCount: 0,
      officialFactCheckCount: 0,
      evidenceStrengthScore: 0,
    };
  }

  const alignedStance = verdict === 'VERIFIED' ? 'supports' : 'contradicts';

  const officialFactCheckUrls = new Set<string>();
  for (const fc of factCheckMatches) {
    const primaryIsTier1 = fc.url ? classifyDomain(fc.url).tier === 'TIER_1' : false;
    const reviewIsTier1 = fc.reviews.some(
      (rev) =>
        rev.credibilityTier === 'TIER_1' ||
        (rev.url ? classifyDomain(rev.url).tier === 'TIER_1' : false)
    );
    if (primaryIsTier1 || reviewIsTier1) {
      const key = fc.url
        ? normalizeUrlKey(fc.url)
        : `${fc.claimText.trim().toLowerCase()}::${fc.publisher.trim().toLowerCase()}`;
      officialFactCheckUrls.add(key);
    }
  }

  const seenEvidenceUrls = new Set<string>();
  const tier1AlignedUrls = new Set<string>();
  const tier2AlignedUrls = new Set<string>();
  const tier3AlignedUrls = new Set<string>();
  let hasAnyTier1 = officialFactCheckUrls.size > 0;
  let hasAnyTier2 = false;

  for (const item of evidence) {
    const urlKey = normalizeUrlKey(item.url);
    if (seenEvidenceUrls.has(urlKey)) continue;
    seenEvidenceUrls.add(urlKey);

    if (item.credibilityTier === 'TIER_1') hasAnyTier1 = true;
    if (item.credibilityTier === 'TIER_2') hasAnyTier2 = true;

    if (item.stance !== alignedStance) continue;

    if (item.credibilityTier === 'TIER_1') {
      tier1AlignedUrls.add(urlKey);
    } else if (item.credibilityTier === 'TIER_2') {
      tier2AlignedUrls.add(urlKey);
    } else {
      tier3AlignedUrls.add(urlKey);
    }
  }

  const officialFactCheckCount = officialFactCheckUrls.size;
  const tier1AlignedCount = tier1AlignedUrls.size;
  const tier2AlignedCount = tier2AlignedUrls.size;

  let additionalTier1Count = 0;
  for (const urlKey of tier1AlignedUrls) {
    if (!officialFactCheckUrls.has(urlKey)) {
      additionalTier1Count++;
    }
  }

  const alignedWeight =
    officialFactCheckCount * 1.25 +
    additionalTier1Count * 1.0 +
    tier2AlignedCount * 0.6 +
    Math.min(tier3AlignedUrls.size * 0.2, 0.4);

  const effectiveContradiction =
    hasContradiction || detectEvidenceContradiction(evidence, verdict);

  if (effectiveContradiction) {
    const tierCeiling = hasAnyTier1 ? 68 : hasAnyTier2 ? 62 : 50;
    const evidenceStrengthScore = Math.min(
      68,
      Math.round(45 + Math.min(alignedWeight, 3) * 7)
    );
    return {
      verdict,
      confidenceScore: Math.min(68, tierCeiling, clampedLlm),
      tier1AlignedCount,
      tier2AlignedCount,
      officialFactCheckCount,
      evidenceStrengthScore,
    };
  }

  if (officialFactCheckCount >= 1 || tier1AlignedCount >= 2) {
    const evidenceStrengthScore = Math.min(
      95,
      Math.round(75 + Math.min(alignedWeight, 5) * 4)
    );
    const blended = Math.round(0.45 * clampedLlm + 0.55 * evidenceStrengthScore);
    const guardedBlended =
      clampedLlm < 50 ? Math.min(blended, clampedLlm + 15) : blended;

    return {
      verdict,
      confidenceScore: Math.max(0, Math.min(95, guardedBlended)),
      tier1AlignedCount,
      tier2AlignedCount,
      officialFactCheckCount,
      evidenceStrengthScore,
    };
  }

  if (tier1AlignedCount === 1) {
    const evidenceStrengthScore = Math.min(
      76,
      Math.round(62 + Math.min(alignedWeight, 2.8) * 5)
    );
    const ceiling = tier2AlignedCount >= 2 ? 78 : 74;
    const confidenceScore = Math.max(
      0,
      Math.min(ceiling, Math.round(0.5 * clampedLlm + 0.5 * evidenceStrengthScore))
    );
    return {
      verdict,
      confidenceScore,
      tier1AlignedCount,
      tier2AlignedCount,
      officialFactCheckCount,
      evidenceStrengthScore,
    };
  }

  if (tier2AlignedCount > 0) {
    const evidenceStrengthScore = Math.min(
      72,
      Math.round(52 + Math.min(alignedWeight, 3.0) * 6.5)
    );
    const ceiling = Math.min(74, 56 + tier2AlignedCount * 6);
    const confidenceScore = Math.max(
      0,
      Math.min(ceiling, Math.round(0.55 * clampedLlm + 0.45 * evidenceStrengthScore))
    );
    return {
      verdict,
      confidenceScore,
      tier1AlignedCount,
      tier2AlignedCount,
      officialFactCheckCount,
      evidenceStrengthScore,
    };
  }

  if (tier3AlignedUrls.size > 0) {
    const evidenceStrengthScore = Math.min(
      50,
      Math.round(30 + Math.min(tier3AlignedUrls.size, 3) * 6)
    );
    const confidenceScore = Math.max(
      0,
      Math.min(55, Math.round(0.5 * clampedLlm + 0.5 * evidenceStrengthScore))
    );
    return {
      verdict,
      confidenceScore,
      tier1AlignedCount,
      tier2AlignedCount,
      officialFactCheckCount,
      evidenceStrengthScore,
    };
  }

  const fallbackStrengthScore = 35;
  return {
    verdict,
    confidenceScore: Math.max(
      0,
      Math.min(45, Math.round(0.5 * clampedLlm + 0.5 * fallbackStrengthScore))
    ),
    tier1AlignedCount,
    tier2AlignedCount,
    officialFactCheckCount,
    evidenceStrengthScore: fallbackStrengthScore,
  };
}

export function calibrateClaimConfidence(params: {
  llmConfidence: number;
  status: Verdict;
  supportingEvidence: EvidenceSource[];
  factCheckMatches: FactCheckResult[];
  hasContradiction?: boolean;
}): number {
  const result = calibrateConfidence({
    llmConfidence: params.llmConfidence,
    verdict: params.status,
    evidence: params.supportingEvidence,
    factCheckMatches: params.factCheckMatches,
    hasContradiction: params.hasContradiction ?? false,
  });
  return result.confidenceScore;
}
