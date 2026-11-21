import axios from 'axios';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import type {
  FactCheckProvider,
  FactCheckProviderStatus,
  FactCheckResult,
  FactCheckReview,
} from '@/lib/types';
import { classifyDomain } from '@/lib/utils/credibility';
import { getDomain, isValidUrl } from '@/lib/utils/sanitize';

const INDONESIAN_FACTCHECK_DOMAINS: readonly string[] = [
  'turnbackhoax.id',
  'cekfakta.com',
  'cekfakta.tempo.co',
];

const INTERNATIONAL_FACTCHECK_DOMAINS: readonly string[] = [
  'snopes.com',
  'politifact.com',
  'factcheck.org',
  'fullfact.org',
];

export const FACTCHECK_DOMAINS: readonly string[] = [
  ...INDONESIAN_FACTCHECK_DOMAINS,
  ...INTERNATIONAL_FACTCHECK_DOMAINS,
];

const PUBLISHER_NAMES: Record<string, string> = {
  'turnbackhoax.id': 'TurnBackHoax (MAFINDO)',
  'cekfakta.com': 'CekFakta.com',
  'cekfakta.tempo.co': 'Tempo Cek Fakta',
  'snopes.com': 'Snopes',
  'politifact.com': 'PolitiFact',
  'factcheck.org': 'FactCheck.org',
  'fullfact.org': 'Full Fact',
};

interface TavilySearchApiResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
    publishedDate?: string;
  }>;
}

interface JinaSearchItem {
  title?: string;
  url?: string;
  description?: string;
  content?: string;
  date?: string;
  publishedTime?: string;
}

interface JinaSearchApiResponse {
  data?: JinaSearchItem[];
  results?: JinaSearchItem[];
}

export interface FactCheckExecutionResult {
  results: FactCheckResult[];
  status: FactCheckProviderStatus;
  warnings: string[];
}

interface SingleClaimFactCheckResult {
  results: FactCheckResult[];
  provider: FactCheckProvider | 'failed';
  warnings: string[];
}

export function getPrioritizedFactCheckDomains(languageCode: 'id' | 'en'): string[] {
  if (languageCode === 'en') {
    return [...INTERNATIONAL_FACTCHECK_DOMAINS];
  }
  return [...INDONESIAN_FACTCHECK_DOMAINS, ...INTERNATIONAL_FACTCHECK_DOMAINS];
}

function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status) {
      return `HTTP ${error.response.status}`;
    }
    if (error.code === 'ECONNABORTED') {
      return 'timeout';
    }
    return error.code || error.message || 'network error';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'unknown error';
}

function resolvePublisherName(sourceDomain: string): string {
  const normalized = sourceDomain.toLowerCase().replace(/^www\./, '');
  for (const [domain, name] of Object.entries(PUBLISHER_NAMES)) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) {
      return name;
    }
  }
  return sourceDomain;
}

function isFactCheckDomain(sourceDomain: string): boolean {
  const normalized = sourceDomain.toLowerCase().replace(/^www\./, '');
  return FACTCHECK_DOMAINS.some(
    (domain) => normalized === domain || normalized.endsWith(`.${domain}`)
  );
}

function buildFactCheckResult(params: {
  claimText: string;
  title: string;
  summary: string;
  url: string;
  publishedDate: string | null;
  languageCode: 'id' | 'en';
  provider: FactCheckProvider;
}): FactCheckResult {
  const sourceDomain = getDomain(params.url);
  const publisher = resolvePublisherName(sourceDomain);
  const domainInfo = classifyDomain(params.url);
  const cleanSummary = params.summary.trim() || params.title.trim();
  const ratingBadge =
    params.languageCode === 'id' ? 'Rujukan Cek Fakta' : 'Fact-Check Reference';

  const review: FactCheckReview = {
    publisher,
    url: params.url,
    title: params.title,
    rating: ratingBadge,
    textualRating: cleanSummary,
    reviewDate: params.publishedDate,
    languageCode: params.languageCode,
    credibilityTier: domainInfo.tier,
    credibilityLabel: domainInfo.label,
  };

  return {
    claimText: params.claimText,
    publisher,
    summary: cleanSummary,
    url: params.url,
    sourceDomain,
    provider: params.provider,
    text: params.title ? `${params.claimText} — ${params.title}` : params.claimText,
    claimant: null,
    claimDate: params.publishedDate,
    reviews: [review],
  };
}

function deduplicateByUrl(items: FactCheckResult[]): FactCheckResult[] {
  const seen = new Set<string>();
  const unique: FactCheckResult[] = [];

  for (const item of items) {
    const key = item.url
      ? normalizeUrl(item.url)
      : `${item.claimText.trim().toLowerCase()}::${item.publisher.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

async function searchFactCheckWithTavily(
  claim: string,
  languageCode: 'id' | 'en',
  apiKey: string
): Promise<FactCheckResult[]> {
  const includeDomains = getPrioritizedFactCheckDomains(languageCode);
  const response = await axios.post<TavilySearchApiResponse>(
    APP_CONFIG.endpoints.tavilySearch,
    {
      api_key: apiKey,
      query: claim,
      include_domains: includeDomains,
      search_depth: 'basic',
      max_results: APP_CONFIG.limits.defaultSearchResults,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: APP_CONFIG.timeouts.externalApiMs,
    }
  );

  const items = Array.isArray(response.data?.results) ? response.data.results : [];

  const mapped = items
    .filter((item): item is typeof item & { url: string } =>
      Boolean(item.url && isValidUrl(item.url))
    )
    .slice(0, APP_CONFIG.limits.defaultSearchResults)
    .map((item) =>
      buildFactCheckResult({
        claimText: claim,
        title: item.title?.trim() || getDomain(item.url),
        summary: item.content?.trim() || '',
        url: item.url,
        publishedDate: item.published_date || item.publishedDate || null,
        languageCode,
        provider: 'tavily_factcheck',
      })
    );

  return deduplicateByUrl(mapped);
}

async function searchFactCheckWithJina(
  claim: string,
  languageCode: 'id' | 'en',
  jinaApiKey: string
): Promise<FactCheckResult[]> {
  const factCheckQuery =
    languageCode === 'id' ? `cek fakta ${claim}` : `fact check ${claim}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Respond-With': 'no-content',
  };

  if (jinaApiKey) {
    headers.Authorization = `Bearer ${jinaApiKey}`;
  }

  const endpoint = `${APP_CONFIG.endpoints.jinaSearch}${encodeURIComponent(factCheckQuery)}`;
  const response = await axios.get<JinaSearchApiResponse>(endpoint, {
    headers,
    timeout: APP_CONFIG.timeouts.externalApiMs,
  });

  const rawItems = Array.isArray(response.data?.data)
    ? response.data.data
    : Array.isArray(response.data?.results)
      ? response.data.results
      : [];

  const mapped = rawItems
    .filter((item): item is JinaSearchItem & { url: string } =>
      Boolean(item.url && isValidUrl(item.url))
    )
    .map((item) =>
      buildFactCheckResult({
        claimText: claim,
        title: item.title?.trim() || getDomain(item.url),
        summary: item.description?.trim() || item.content?.trim() || '',
        url: item.url,
        publishedDate: item.date || item.publishedTime || null,
        languageCode,
        provider: 'jina_factcheck',
      })
    );

  // Prioritize verified fact-checking domains before general results.
  const prioritized = mapped.sort((a, b) => {
    const aIsVerified = isFactCheckDomain(a.sourceDomain) ? 0 : 1;
    const bIsVerified = isFactCheckDomain(b.sourceDomain) ? 0 : 1;
    return aIsVerified - bIsVerified;
  });

  return deduplicateByUrl(prioritized).slice(0, APP_CONFIG.limits.defaultSearchResults);
}

async function queryClaimFactCheck(
  claim: string,
  languageCode: 'id' | 'en'
): Promise<SingleClaimFactCheckResult> {
  const { tavilyApiKey, jinaApiKey } = getEnvConfig();
  const trimmedTavilyKey = tavilyApiKey.trim();
  const trimmedJinaKey = jinaApiKey.trim();
  const warnings: string[] = [];

  if (trimmedTavilyKey) {
    try {
      const results = await searchFactCheckWithTavily(
        claim,
        languageCode,
        trimmedTavilyKey
      );
      return {
        results,
        provider: 'tavily_factcheck',
        warnings,
      };
    } catch (error: unknown) {
      const reason = describeError(error);
      console.error('Tavily Fact-Check search error:', error);
      warnings.push(
        `Tavily Fact-Check gagal (${reason}); beralih ke Jina Search.`
      );
    }
  } else {
    warnings.push(
      'TAVILY_API_KEY tidak tersedia; menggunakan Jina Search untuk pencarian fact-check.'
    );
  }

  try {
    const results = await searchFactCheckWithJina(claim, languageCode, trimmedJinaKey);
    return {
      results,
      provider: 'jina_factcheck',
      warnings,
    };
  } catch (error: unknown) {
    const reason = describeError(error);
    console.error('Jina Fact-Check search error:', error);
    warnings.push(`Jina Fact-Check search gagal (${reason}).`);
  }

  return {
    results: [],
    provider: 'failed',
    warnings,
  };
}

export async function checkClaim(
  claim: string,
  languageCode: 'id' | 'en' = 'id'
): Promise<FactCheckResult[]> {
  const execution = await queryClaimFactCheck(claim, languageCode);
  return execution.results;
}

export async function checkMultipleClaimsWithStatus(
  claims: string[],
  languageCode: 'id' | 'en' = 'id'
): Promise<FactCheckExecutionResult> {
  if (claims.length === 0) {
    return { results: [], status: 'skipped', warnings: [] };
  }

  const settled = await Promise.allSettled(
    claims.map((claim) => queryClaimFactCheck(claim, languageCode))
  );

  const rawResults: FactCheckResult[] = [];
  const rawWarnings: string[] = [];
  let tavilySucceeded = false;
  let jinaSucceeded = false;

  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      rawWarnings.push(...outcome.value.warnings);
      if (outcome.value.provider === 'tavily_factcheck') {
        tavilySucceeded = true;
      } else if (outcome.value.provider === 'jina_factcheck') {
        jinaSucceeded = true;
      }
      rawResults.push(...outcome.value.results);
    } else {
      const reason = describeError(outcome.reason);
      console.error('Fact-Check claim execution error:', outcome.reason);
      rawWarnings.push(`Salah satu pemeriksaan fakta gagal (${reason}).`);
    }
  }

  const status: FactCheckProviderStatus = tavilySucceeded
    ? 'tavily_factcheck'
    : jinaSucceeded
      ? 'jina_factcheck'
      : 'failed';

  return {
    results: deduplicateByUrl(rawResults),
    status,
    warnings: Array.from(new Set(rawWarnings.filter(Boolean))),
  };
}

export async function checkMultipleClaims(
  claims: string[],
  languageCode: 'id' | 'en' = 'id'
): Promise<FactCheckResult[]> {
  const execution = await checkMultipleClaimsWithStatus(claims, languageCode);
  return execution.results;
}

export function formatFactCheckResults(results: FactCheckResult[]): string {
  if (results.length === 0) return '';

  return results
    .slice(0, APP_CONFIG.limits.maxPromptFactChecks)
    .map((r, i) => {
      const credibility = classifyDomain(r.url);
      const summary = r.summary.substring(0, APP_CONFIG.limits.promptSnippetMaxLength);
      return `[${i + 1}] Claim: "${r.claimText}"
  Publisher: ${r.publisher} (${r.sourceDomain}) [${credibility.tier} | weight=${credibility.weight} | ${credibility.label} | via=${r.provider}]
  URL: ${r.url}
  Date: ${r.claimDate || 'Unknown'}
  Summary: ${summary}`;
    })
    .join('\n\n');
}
