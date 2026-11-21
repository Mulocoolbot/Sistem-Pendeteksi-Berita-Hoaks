import axios from 'axios';
import { APP_CONFIG, getEnvConfig, HTTP_TIMEOUT_MS } from '@/lib/config';
import type { FactCheckResult, FactCheckReview } from '@/lib/types';
import { classifyDomain } from '@/lib/utils/credibility';

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

export async function checkClaim(claim: string): Promise<FactCheckResult[]> {
  const { googleFactCheckApiKey } = getEnvConfig();
  if (!googleFactCheckApiKey) {
    return [];
  }

  try {
    const response = await axios.get<FactCheckApiResponse>(
      APP_CONFIG.endpoints.googleFactCheck,
      {
        params: {
          query: claim,
          key: googleFactCheckApiKey,
          languageCode: '',
        },
        timeout: HTTP_TIMEOUT_MS,
      }
    );

    if (!response.data.claims) {
      return [];
    }

    return response.data.claims.map((c) => ({
      text: c.text || claim,
      claimant: c.claimant || null,
      claimDate: c.claimDate || null,
      reviews: (c.claimReview || []).map((r): FactCheckReview => {
        const domainInfo = classifyDomain(r.url || r.publisher?.site || '');
        return {
          publisher: r.publisher?.name || r.publisher?.site || 'Unknown',
          url: r.url || '',
          title: r.title || '',
          rating: r.textualRating || 'Unknown',
          languageCode: r.languageCode || 'en',
          credibilityTier: domainInfo.tier,
          credibilityLabel: domainInfo.label,
        };
      }),
    }));
  } catch (error: unknown) {
    console.error('Fact Check API error:', error);
    return [];
  }
}

export async function checkMultipleClaims(claims: string[]): Promise<FactCheckResult[]> {
  const results = await Promise.allSettled(claims.map((claim) => checkClaim(claim)));

  const allResults: FactCheckResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  return allResults;
}

export function formatFactCheckResults(results: FactCheckResult[]): string {
  if (results.length === 0) return '';

  return results
    .map((r, i) => {
      const reviews = r.reviews
        .map((rev) => {
          const tier = rev.credibilityTier ?? classifyDomain(rev.url).tier;
          const label = rev.credibilityLabel ?? classifyDomain(rev.url).label;
          return `  - ${rev.publisher} [${tier} - ${label}]: "${rev.rating}" (${rev.url})`;
        })
        .join('\n');
      return `[${i + 1}] Claim: "${r.text}"
  Claimant: ${r.claimant || 'Unknown'}
  Date: ${r.claimDate || 'Unknown'}
  Reviews:
${reviews}`;
    })
    .join('\n\n');
}
