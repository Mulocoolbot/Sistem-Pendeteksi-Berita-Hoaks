// ============================================================
// Google Custom Search Service — Related News Search
// ============================================================

import axios from 'axios';
import type { SearchResult } from '@/lib/types';

const CUSTOM_SEARCH_API_URL = 'https://www.googleapis.com/customsearch/v1';

interface GoogleSearchApiResponse {
  items?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    displayLink?: string;
    pagemap?: {
      metatags?: Array<{
        'article:published_time'?: string;
        'og:updated_time'?: string;
        date?: string;
      }>;
    };
  }>;
}

/**
 * Searches for related news articles using Google Custom Search API.
 */
export async function searchRelatedNews(
  query: string,
  numResults: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.warn('Google Custom Search API not configured. Skipping web search.');
    return [];
  }

  try {
    const response = await axios.get<GoogleSearchApiResponse>(CUSTOM_SEARCH_API_URL, {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: Math.min(numResults, 10),
      },
      timeout: 10000,
    });

    if (!response.data.items) {
      return [];
    }

    return response.data.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      displayLink: item.displayLink || '',
      datePublished: extractDate(item.pagemap),
    }));
  } catch (error) {
    console.error('Google Custom Search error:', error);
    return [];
  }
}

/**
 * Searches for related news using multiple queries and deduplicates.
 */
export async function searchMultipleQueries(
  queries: string[],
  resultsPerQuery: number = 3
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries.slice(0, 5)) {
    try {
      const results = await searchRelatedNews(query, resultsPerQuery);
      for (const result of results) {
        if (!seenUrls.has(result.link)) {
          seenUrls.add(result.link);
          allResults.push(result);
        }
      }
    } catch {
      continue;
    }
  }

  return allResults;
}

/**
 * Formats search results into a readable string for the AI prompt.
 */
export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';

  return results
    .map(
      (r, i) =>
        `[${i + 1}] "${r.title}"
  Source: ${r.displayLink}
  Date: ${r.datePublished || 'Unknown'}
  Excerpt: ${r.snippet}`
    )
    .join('\n\n');
}

// ── Helper ──────────────────────────────────────────────

function extractDate(
  pagemap?: {
    metatags?: Array<{
      'article:published_time'?: string;
      'og:updated_time'?: string;
      date?: string;
    }>;
  }
): string | null {
  if (!pagemap?.metatags?.length) return null;
  const meta = pagemap.metatags[0];
  return (
    meta['article:published_time'] ||
    meta['og:updated_time'] ||
    meta.date ||
    null
  );
}
