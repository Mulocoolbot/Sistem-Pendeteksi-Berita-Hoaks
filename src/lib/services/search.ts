import axios from 'axios';
import * as cheerio from 'cheerio';
import { APP_CONFIG, getEnvConfig, HTTP_TIMEOUT_MS } from '@/lib/config';
import type {
  ArticleData,
  EvidenceSource,
  SearchResult,
  SourceEvaluation,
} from '@/lib/types';
import { classifyDomain } from '@/lib/utils/credibility';
import { getDomain, isValidUrl } from '@/lib/utils/sanitize';

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

async function fetchBingNewsRssItems(
  query: string,
  numResults: number
): Promise<SearchResult[]> {
  try {
    const response = await axios.get<string>('https://www.bing.com/news/search', {
      params: { q: query, format: 'rss' },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: HTTP_TIMEOUT_MS,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const results: SearchResult[] = [];

    $('item').each((_, el) => {
      if (results.length >= numResults) return;
      const title = $(el).find('title').first().text().trim();
      const rawLink = $(el).find('link').first().text().trim();
      const description = $(el).find('description').first().text().trim();
      const pubDate = $(el).find('pubDate').first().text().trim();

      if (!title || !rawLink) return;

      let targetUrl = rawLink;
      try {
        const parsedLink = new URL(rawLink);
        const embeddedUrl = parsedLink.searchParams.get('url');
        if (embeddedUrl && isValidUrl(embeddedUrl)) {
          targetUrl = embeddedUrl;
        }
      } catch {
        // Keep rawLink if Bing redirect parsing fails.
      }

      if (!isValidUrl(targetUrl)) return;

      results.push({
        title,
        link: targetUrl,
        snippet: description,
        displayLink: getDomain(targetUrl),
        datePublished: pubDate || null,
      });
    });

    return results;
  } catch (error: unknown) {
    console.error('Bing News RSS fallback search error:', error);
    return [];
  }
}

async function searchBingNewsRss(
  query: string,
  numResults: number
): Promise<SearchResult[]> {
  const initialResults = await fetchBingNewsRssItems(query, numResults);
  if (initialResults.length > 0) {
    return initialResults;
  }

  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    const shortQuery = words.slice(0, 4).join(' ');
    return fetchBingNewsRssItems(shortQuery, numResults);
  }

  return [];
}

async function searchYahoo(
  query: string,
  numResults: number = APP_CONFIG.limits.defaultSearchResults
): Promise<SearchResult[]> {
  try {
    const response = await axios.get<string>(APP_CONFIG.endpoints.yahooSearch, {
      params: { p: query },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: HTTP_TIMEOUT_MS,
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

    if (results.length > 0) {
      return results;
    }

    return searchBingNewsRss(query, numResults);
  } catch (error: unknown) {
    console.error('Yahoo fallback search error. Trying Bing News RSS...', error);
    return searchBingNewsRss(query, numResults);
  }
}

export async function searchRelatedNews(
  query: string,
  numResults: number = APP_CONFIG.limits.defaultSearchResults
): Promise<SearchResult[]> {
  const { googleCustomSearchApiKey, googleSearchEngineId } = getEnvConfig();

  if (!googleCustomSearchApiKey || !googleSearchEngineId) {
    return searchYahoo(query, numResults);
  }

  try {
    const response = await axios.get<GoogleSearchApiResponse>(
      APP_CONFIG.endpoints.googleCustomSearch,
      {
        params: {
          key: googleCustomSearchApiKey,
          cx: googleSearchEngineId,
          q: query,
          num: Math.min(numResults, APP_CONFIG.limits.maxGoogleSearchResults),
        },
        timeout: HTTP_TIMEOUT_MS,
      }
    );

    if (!response.data.items || response.data.items.length === 0) {
      return searchYahoo(query, numResults);
    }

    return response.data.items
      .filter((item): item is typeof item & { link: string } => Boolean(item.link && isValidUrl(item.link)))
      .map((item) => ({
        title: item.title || '',
        link: item.link,
        snippet: item.snippet || '',
        displayLink: item.displayLink || getDomain(item.link),
        datePublished: extractDate(item.pagemap),
      }));
  } catch (error: unknown) {
    console.error('Google Custom Search error. Falling back to Yahoo search...', error);
    return searchYahoo(query, numResults);
  }
}

export async function searchMultipleQueries(
  queries: string[],
  resultsPerQuery: number = APP_CONFIG.limits.resultsPerSearchQuery
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries.slice(0, APP_CONFIG.limits.maxSearchQueriesToRun)) {
    if (allResults.length > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, APP_CONFIG.timeouts.searchThrottleDelayMs)
      );
    }
    const results = await searchRelatedNews(query, resultsPerQuery);
    for (const result of results) {
      if (!seenUrls.has(result.link)) {
        seenUrls.add(result.link);
        allResults.push(result);
      }
    }
  }

  return allResults;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';

  return results
    .map((r, i) => {
      const credibility = classifyDomain(r.link);
      return `[${i + 1}] "${r.title}"
  URL: ${r.link}
  Source: ${r.displayLink} [${credibility.tier} | weight=${credibility.weight} | ${credibility.label}]
  Date: ${r.datePublished || 'Unknown'}
  Excerpt: ${r.snippet}`;
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
      siteName: art.siteName || getDomain(art.url),
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
    if (seenUrls.has(result.link)) continue;
    seenUrls.add(result.link);
    const credibility = classifyDomain(result.link);
    evidenceSources.push({
      title: result.title,
      url: result.link,
      siteName: result.displayLink || getDomain(result.link),
      snippet: result.snippet,
      publishedDate: result.datePublished,
      similarityScore: 0,
      stance: 'neutral',
      credibilityTier: credibility.tier,
      credibilityLabel: credibility.label,
      credibilityWeight: credibility.weight,
    });
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
