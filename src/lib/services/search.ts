import axios from 'axios';
import * as cheerio from 'cheerio';
import type {
  ArticleData,
  EvidenceSource,
  SearchResult,
  SourceEvaluation,
} from '@/lib/types';
import { getDomain, isValidUrl } from '@/lib/utils/sanitize';

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

async function searchYahoo(
  query: string,
  numResults: number = 5
): Promise<SearchResult[]> {
  try {
    const response = await axios.get<string>('https://search.yahoo.com/search', {
      params: { p: query },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const results: SearchResult[] = [];

    $('div.algo').each((_, el) => {
      if (results.length >= numResults) return;
      const anchor = $(el).find('.compTitle a, h3 a, a.d-flex').first();
      const title = anchor.text().trim();
      let link = anchor.attr('href');
      const snippet = $(el).find('.compText, .compText p, div.compText').first().text().trim();

      if (!title || !link) return;

      if (link.includes('/RU=')) {
        const match = link.match(/\/RU=([^/]+)/);
        if (match) {
          link = decodeURIComponent(match[1]);
        }
      }

      if (!isValidUrl(link)) return;

      results.push({
        title,
        link,
        snippet,
        displayLink: getDomain(link),
        datePublished: null,
      });
    });

    return results;
  } catch (error: unknown) {
    console.error('Yahoo fallback search error:', error);
    return [];
  }
}

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
      return searchYahoo(query, numResults);
    }

    return response.data.items.map((item) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      displayLink: item.displayLink || '',
      datePublished: extractDate(item.pagemap),
    }));
  } catch (error: unknown) {
    console.error('Google Custom Search error. Falling back to Yahoo search...', error);
    return searchYahoo(query, numResults);
  }
}

export async function searchMultipleQueries(
  queries: string[],
  resultsPerQuery: number = 3
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries.slice(0, 2)) {
    try {
      if (allResults.length > 0) {
        // Throttle consecutive requests to avoid Yahoo rate limiting.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const results = await searchRelatedNews(query, resultsPerQuery);
      for (const result of results) {
        if (!seenUrls.has(result.link)) {
          seenUrls.add(result.link);
          allResults.push(result);
        }
      }
    } catch (error: unknown) {
      console.warn(`Search failed for query "${query}":`, error);
    }
  }

  return allResults;
}

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

export function buildEvidenceSources(
  relatedArticles: ArticleData[],
  sourceEvaluations: SourceEvaluation[],
  searchResults: SearchResult[]
): EvidenceSource[] {
  const evidenceSources: EvidenceSource[] = relatedArticles.map((art, index) => {
    const evaluation = sourceEvaluations.find((e) => e.scrapedIndex === index + 1);
    return {
      title: art.title,
      url: art.url,
      siteName: art.siteName || getDomain(art.url),
      snippet: art.description || art.content.substring(0, 160),
      publishedDate: art.publishedDate,
      similarityScore: evaluation ? evaluation.similarityScore : 0,
      stance: evaluation ? evaluation.stance : 'neutral',
    };
  });

  if (evidenceSources.length === 0 && searchResults.length > 0) {
    for (const result of searchResults) {
      evidenceSources.push({
        title: result.title,
        url: result.link,
        siteName: result.displayLink,
        snippet: result.snippet,
        publishedDate: result.datePublished,
        similarityScore: 0,
        stance: 'neutral',
      });
    }
  }

  return evidenceSources;
}

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
