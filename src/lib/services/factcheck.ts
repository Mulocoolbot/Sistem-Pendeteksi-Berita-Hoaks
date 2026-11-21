// ============================================================
// Google Fact Check API Service
// ============================================================

import axios from 'axios';
import type { FactCheckResult, FactCheckReview } from '@/lib/types';

const FACT_CHECK_API_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

interface FactCheckApiResponse {
  claims?: Array<{
    text?: string;
    claimant?: string;
    claimDate?: string;
    claimReview?: Array<{
      publisher?: {
        name?: string;
        site?: string;
      };
      url?: string;
      title?: string;
      textualRating?: string;
      languageCode?: string;
    }>;
  }>;
}

/**
 * Searches for existing fact-checks for a given claim using Google Fact Check API.
 */
export async function checkClaim(claim: string): Promise<FactCheckResult[]> {
  const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_FACT_CHECK_API_KEY not configured. Skipping fact-check lookup.');
    return [];
  }

  try {
    const response = await axios.get<FactCheckApiResponse>(FACT_CHECK_API_URL, {
      params: {
        query: claim,
        key: apiKey,
        languageCode: '', // Search all languages
      },
      timeout: 10000,
    });

    if (!response.data.claims) {
      return [];
    }

    return response.data.claims.map(c => ({
      text: c.text || claim,
      claimant: c.claimant || null,
      claimDate: c.claimDate || null,
      reviews: (c.claimReview || []).map(
        (r): FactCheckReview => ({
          publisher: r.publisher?.name || r.publisher?.site || 'Unknown',
          url: r.url || '',
          title: r.title || '',
          rating: r.textualRating || 'Unknown',
          languageCode: r.languageCode || 'en',
        })
      ),
    }));
  } catch (error) {
    console.error('Fact Check API error:', error);
    return [];
  }
}

/**
 * Checks multiple claims in parallel.
 */
export async function checkMultipleClaims(
  claims: string[]
): Promise<FactCheckResult[]> {
  const results = await Promise.allSettled(
    claims.map(claim => checkClaim(claim))
  );

  const allResults: FactCheckResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  return allResults;
}

/**
 * Formats fact-check results into a readable string for the AI prompt.
 */
export function formatFactCheckResults(results: FactCheckResult[]): string {
  if (results.length === 0) return '';

  return results
    .map((r, i) => {
      const reviews = r.reviews
        .map(
          rev =>
            `  - ${rev.publisher}: "${rev.rating}" (${rev.url})`
        )
        .join('\n');
      return `[${i + 1}] Claim: "${r.text}"
  Claimant: ${r.claimant || 'Unknown'}
  Date: ${r.claimDate || 'Unknown'}
  Reviews:
${reviews}`;
    })
    .join('\n\n');
}
