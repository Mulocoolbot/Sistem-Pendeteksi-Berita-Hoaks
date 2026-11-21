import axios from 'axios';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import type {
  ArticleData,
  EvidenceSource,
  SearchProvider,
  SearchResult,
  SourceEvaluation,
} from '@/lib/types';
import { classifyDomain } from '@/lib/utils/credibility';
import { getDomain, isValidUrl } from '@/lib/utils/sanitize';

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

export interface SearchProviderExecutionResult {
  results: SearchResult[];
  provider: SearchProvider | 'failed';
  warnings: string[];
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

async function searchWithTavily(
  query: string,
  numResults: number,
  apiKey: string
): Promise<SearchResult[]> {
  const response = await axios.post<TavilySearchApiResponse>(
    APP_CONFIG.endpoints.tavilySearch,
    {
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: numResults,
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

  return items
    .filter((item): item is typeof item & { url: string } =>
      Boolean(item.url && isValidUrl(item.url))
    )
    .slice(0, numResults)
    .map((item) => ({
      title: item.title?.trim() || getDomain(item.url),
      url: item.url,
      snippet: item.content?.trim() || '',
      publishedDate: item.published_date || item.publishedDate || null,
      sourceDomain: getDomain(item.url),
      provider: 'tavily' as const,
    }));
}

async function searchWithJina(
  query: string,
  numResults: number,
  jinaApiKey: string
): Promise<SearchResult[]> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Respond-With': 'no-content',
  };

  if (jinaApiKey) {
    headers.Authorization = `Bearer ${jinaApiKey}`;
  }

  const endpoint = `${APP_CONFIG.endpoints.jinaSearch}${encodeURIComponent(query)}`;
  const response = await axios.get<JinaSearchApiResponse>(endpoint, {
    headers,
    timeout: APP_CONFIG.timeouts.externalApiMs,
  });

  const rawItems = Array.isArray(response.data?.data)
    ? response.data.data
    : Array.isArray(response.data?.results)
      ? response.data.results
      : [];

  return rawItems
    .filter((item): item is JinaSearchItem & { url: string } =>
      Boolean(item.url && isValidUrl(item.url))
    )
    .slice(0, numResults)
    .map((item) => ({
      title: item.title?.trim() || getDomain(item.url),
      url: item.url,
      snippet: item.description?.trim() || item.content?.trim() || '',
      publishedDate: item.date || item.publishedTime || null,
      sourceDomain: getDomain(item.url),
      provider: 'jina_search' as const,
    }));
}

export async function searchWithProvider(
  query: string,
  numResults: number = APP_CONFIG.limits.defaultSearchResults
): Promise<SearchProviderExecutionResult> {
  const { tavilyApiKey, jinaApiKey } = getEnvConfig();
  const warnings: string[] = [];
  const trimmedTavilyKey = tavilyApiKey.trim();
  const trimmedJinaKey = jinaApiKey.trim();

  if (trimmedTavilyKey) {
    try {
      const results = await searchWithTavily(query, numResults, trimmedTavilyKey);
      return {
        results,
        provider: 'tavily',
        warnings,
      };
    } catch (error: unknown) {
      const reason = describeError(error);
      console.error('Tavily search error:', error);
      warnings.push(`Tavily Search gagal (${reason}); beralih ke Jina Search.`);
    }
  } else {
    warnings.push('TAVILY_API_KEY tidak tersedia; menggunakan Jina Search sebagai fallback.');
  }

  try {
    const results = await searchWithJina(query, numResults, trimmedJinaKey);
    return {
      results,
      provider: 'jina_search',
      warnings,
    };
  } catch (error: unknown) {
    const reason = describeError(error);
    console.error('Jina search error:', error);
    warnings.push(`Jina Search gagal (${reason}).`);
  }

  return {
    results: [],
    provider: 'failed',
    warnings,
  };
}

export async function searchRelatedNews(
  query: string,
  numResults: number = APP_CONFIG.limits.defaultSearchResults
): Promise<SearchResult[]> {
  const execution = await searchWithProvider(query, numResults);
  return execution.results;
}

export async function searchMultipleQueries(
  queries: string[],
  resultsPerQuery: number = APP_CONFIG.limits.resultsPerSearchQuery
): Promise<SearchResult[]> {
  const limitedQueries = queries.slice(0, APP_CONFIG.limits.maxSearchQueriesToRun);
  const outcomes = await Promise.allSettled(
    limitedQueries.map((query) => searchRelatedNews(query, resultsPerQuery))
  );

  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const outcome of outcomes) {
    if (outcome.status !== 'fulfilled') continue;
    for (const result of outcome.value) {
      if (!seenUrls.has(result.url)) {
        seenUrls.add(result.url);
        allResults.push(result);
      }
    }
  }

  return allResults;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';

  return results
    .slice(0, APP_CONFIG.limits.maxPromptSearchResults)
    .map((r, i) => {
      const credibility = classifyDomain(r.url);
      const excerpt = r.snippet.substring(0, APP_CONFIG.limits.promptSnippetMaxLength);
      return `[${i + 1}] "${r.title}"
  URL: ${r.url}
  Source: ${r.sourceDomain} [${credibility.tier} | weight=${credibility.weight} | ${credibility.label} | via=${r.provider}]
  Date: ${r.publishedDate || 'Unknown'}
  Excerpt: ${excerpt}`;
    })
    .join('\n\n');
}

export function buildEvidenceSources(
  relatedArticles: ArticleData[],
  sourceEvaluations: SourceEvaluation[],
  searchResults: SearchResult[]
): EvidenceSource[] {
  const evidenceSources: EvidenceSource[] = [];
  const seenUrls = new Set<string>();

  relatedArticles.forEach((art, index) => {
    const evaluation = sourceEvaluations.find((e) => e.scrapedIndex === index + 1);
    const credibility = classifyDomain(art.url);
    seenUrls.add(art.url);
    evidenceSources.push({
      title: art.title,
      url: art.url,
      siteName: art.siteName || art.domain || getDomain(art.url),
      snippet:
        art.description ||
        art.content.substring(0, APP_CONFIG.limits.evidenceSnippetLength),
      publishedDate: art.publishedDate,
      similarityScore: evaluation ? evaluation.similarityScore : 0,
      stance: evaluation ? evaluation.stance : 'neutral',
      credibilityTier: credibility.tier,
      credibilityLabel: credibility.label,
      credibilityWeight: credibility.weight,
    });
  });

  for (const result of searchResults) {
    if (seenUrls.has(result.url)) continue;
    seenUrls.add(result.url);
    const credibility = classifyDomain(result.url);
    evidenceSources.push({
      title: result.title,
      url: result.url,
      siteName: result.sourceDomain || getDomain(result.url),
      snippet: result.snippet,
      publishedDate: result.publishedDate,
      similarityScore: 0,
      stance: 'neutral',
      credibilityTier: credibility.tier,
      credibilityLabel: credibility.label,
      credibilityWeight: credibility.weight,
    });
  }

  return evidenceSources;
}
