// ============================================================
// Google Custom Search Service — Related News Search
// ============================================================

import axios from 'axios';
import * as cheerio from 'cheerio';
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
 * Fallback web search using Yahoo scraping when Google API key is missing or fails (e.g. 403 forbidden).
 */
async function searchYahoo(
  query: string,
  numResults: number = 5
): Promise<SearchResult[]> {
  try {
    const response = await axios.get('https://search.yahoo.com/search', {
      params: {
        p: query,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const results: SearchResult[] = [];

    $('div.algo').each((i, el) => {
      if (results.length >= numResults) return;
      const a = $(el).find('.compTitle a, h3 a, a.d-flex').first();
      const title = a.text().trim();
      let link = a.attr('href');
      
      const snippetEl = $(el).find('.compText, .compText p, div.compText').first();
      const snippet = snippetEl.text().trim();

      if (title && link) {
        // Clean Yahoo tracking redirect urls
        if (link.includes('/RU=')) {
          const match = link.match(/\/RU=([^/]+)/);
          if (match) {
            link = decodeURIComponent(match[1]);
          }
        }
        
        try {
          const hostname = new URL(link).hostname.replace('www.', '');
          results.push({
            title,
            link,
            snippet,
            displayLink: hostname,
            datePublished: null,
          });
        } catch {
          // Skip invalid URL
        }
      }
    });

    return results;
  } catch (error) {
    console.error('Yahoo fallback search error:', error);
    return [];
  }
}

/**
 * Searches for related news articles using Google Custom Search API.
 * Falls back to Yahoo search scraping if Google credentials are missing or fail (e.g. 403 Forbidden).
 */
export async function searchRelatedNews(
  query: string,
  numResults: number = 5
): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.warn('Google Custom Search API not configured. Falling back to Yahoo search.');
    return searchYahoo(query, numResults);
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

    if (!response.data.items || response.data.items.length === 0) {
      console.log('Google search returned empty. Trying Yahoo search fallback...');
      return searchYahoo(query, numResults);
    }

    return response.data.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      displayLink: item.displayLink || '',
      datePublished: extractDate(item.pagemap),
    }));
  } catch (error) {
    console.error('Google Custom Search error. Falling back to Yahoo search...', error);
    return searchYahoo(query, numResults);
  }
}

/**
 * Searches for related news using multiple queries and deduplicates.
 * Throttles requests and limits to top 2 queries to avoid bot detection & rate-limiting.
 */
export async function searchMultipleQueries(
  queries: string[],
  resultsPerQuery: number = 3
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries.slice(0, 2)) {
    try {
      if (allResults.length > 0) {
        // Sleep for 1 second to avoid Yahoo INKApi rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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
