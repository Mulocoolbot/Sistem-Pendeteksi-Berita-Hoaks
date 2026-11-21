import axios from 'axios';
import * as cheerio from 'cheerio';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import type { ArticleData, ScraperExtractor } from '@/lib/types';
import { AppError } from '@/lib/utils/errors';
import { getDomain } from '@/lib/utils/sanitize';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

export interface ScrapeStatusRecord {
  extractor: ScraperExtractor;
  warning: string | null;
}

interface ParsedHtmlPayload {
  title: string;
  content: string;
  description: string;
  author: string | null;
  publishedDate: string | null;
  siteName: string | null;
  imageUrl: string | null;
  language: string | null;
}

const MAX_TRACKED_SCRAPE_STATUSES = 200;
const lastScrapeStatusMap = new Map<string, ScrapeStatusRecord>();

function normalizeTrackedUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol.toLowerCase()}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function recordScrapeStatus(url: string, status: ScrapeStatusRecord): void {
  const key = normalizeTrackedUrl(url);
  if (lastScrapeStatusMap.has(key)) {
    lastScrapeStatusMap.delete(key);
  } else if (lastScrapeStatusMap.size >= MAX_TRACKED_SCRAPE_STATUSES) {
    const oldestKey = lastScrapeStatusMap.keys().next().value;
    if (oldestKey !== undefined) {
      lastScrapeStatusMap.delete(oldestKey);
    }
  }
  lastScrapeStatusMap.set(key, status);
}

export function getLastScrapeStatus(url: string): ScrapeStatusRecord | null {
  return lastScrapeStatusMap.get(normalizeTrackedUrl(url)) ?? null;
}

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getBrowserHeaders(url: string): Record<string, string> {
  const domain = getDomain(url);
  return {
    'User-Agent': getRandomUserAgent(),
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: `https://www.google.com/search?q=site:${domain}`,
    DNT: '1',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };
}

function describeHttpFailure(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status) {
      return `HTTP ${error.response.status}`;
    }
    if (error.code === 'ECONNABORTED') {
      return 'timeout';
    }
    return error.code || error.message || 'kesalahan jaringan';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'kesalahan tidak diketahui';
}

function parseHtmlWithCheerio(html: string, url: string): ParsedHtmlPayload {
  const $ = cheerio.load(html);
  $(
    'script, style, nav, footer, header, iframe, noscript, .ads, .advertisement, .sidebar, .comments, .related-posts, .social-share, .breadcrumb'
  ).remove();

  const title = extractTitle($);
  const content = extractContent($).trim();
  const description = extractDescription($);
  const author = extractMeta($, [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
    '.author-name',
    '[rel="author"]',
  ]);
  const publishedDate = extractMeta($, [
    'meta[property="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="date"]',
    'time[datetime]',
  ]);
  const siteName =
    extractMeta($, ['meta[property="og:site_name"]', 'meta[name="application-name"]']) ||
    getDomain(url);
  const imageUrl = extractMeta($, [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]);
  const language =
    extractMeta($, ['meta[property="og:locale"]']) || $('html').attr('lang') || null;

  return {
    title,
    content,
    description,
    author,
    publishedDate,
    siteName,
    imageUrl,
    language,
  };
}

function parseJinaPlainText(
  rawText: string,
  fallbackTitle: string,
  fallbackPublishedDate: string | null
): { title: string; content: string; publishedDate: string | null } {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const titleMatch = normalized.match(/^Title:\s*(.+)$/m);
  const publishedMatch = normalized.match(/^Published Time:\s*(.+)$/m);

  let body = normalized;
  const markdownMarker = 'Markdown Content:';
  const markerIndex = normalized.indexOf(markdownMarker);
  if (markerIndex !== -1) {
    body = normalized.slice(markerIndex + markdownMarker.length).trim();
  } else {
    body = normalized
      .replace(/^(?:Title|URL Source|Published Time|Warning):.*$/gm, '')
      .trim();
  }

  return {
    title: titleMatch?.[1]?.trim() || fallbackTitle,
    content: body,
    publishedDate: publishedMatch?.[1]?.trim() || fallbackPublishedDate,
  };
}

async function fetchViaJinaReader(
  url: string,
  fallbackMeta: ParsedHtmlPayload | null
): Promise<ArticleData> {
  const { jinaApiKey } = getEnvConfig();
  const domain = getDomain(url);
  const headers: Record<string, string> = {
    Accept: 'text/plain',
  };

  if (jinaApiKey.trim()) {
    headers.Authorization = `Bearer ${jinaApiKey.trim()}`;
  }

  const jinaUrl = `${APP_CONFIG.endpoints.jinaReader}${url}`;
  const response = await axios.get<string>(jinaUrl, {
    headers,
    timeout: APP_CONFIG.timeouts.jinaScrapeMs,
    maxRedirects: APP_CONFIG.limits.maxRedirects,
  });

  if (typeof response.data !== 'string' || response.data.trim().length === 0) {
    throw new Error('Jina Reader mengembalikan respons kosong.');
  }

  const parsed = parseJinaPlainText(
    response.data,
    fallbackMeta?.title || 'Judul Tidak Ditemukan',
    fallbackMeta?.publishedDate || null
  );

  if (parsed.content.length < APP_CONFIG.limits.minArticleContentLength) {
    throw new Error(
      `Konten dari Jina Reader terlalu pendek (${parsed.content.length} karakter).`
    );
  }

  return {
    url,
    title: parsed.title,
    content: parsed.content,
    description: fallbackMeta?.description || '',
    author: fallbackMeta?.author || null,
    publishedDate: parsed.publishedDate,
    siteName: fallbackMeta?.siteName || domain,
    imageUrl: fallbackMeta?.imageUrl || null,
    language: fallbackMeta?.language || null,
    domain,
    extractor: 'jina',
  };
}

export async function scrapeArticle(url: string): Promise<ArticleData> {
  const domain = getDomain(url);
  let cheerioMeta: ParsedHtmlPayload | null = null;
  let fallbackReason = '';

  // Fast-path: fetch raw HTML with axios and extract structured content with Cheerio.
  try {
    const response = await axios.get<string>(url, {
      headers: getBrowserHeaders(url),
      timeout: APP_CONFIG.timeouts.directScrapeMs,
      maxRedirects: APP_CONFIG.limits.maxRedirects,
      validateStatus: () => true,
    });

    if (
      response.status === 200 &&
      typeof response.data === 'string' &&
      response.data.trim().length > 0
    ) {
      cheerioMeta = parseHtmlWithCheerio(response.data, url);
      if (cheerioMeta.content.length >= APP_CONFIG.limits.minCheerioContentLength) {
        recordScrapeStatus(url, { extractor: 'cheerio', warning: null });
        return {
          url,
          title: cheerioMeta.title,
          content: cheerioMeta.content,
          description: cheerioMeta.description,
          author: cheerioMeta.author,
          publishedDate: cheerioMeta.publishedDate,
          siteName: cheerioMeta.siteName,
          imageUrl: cheerioMeta.imageUrl,
          language: cheerioMeta.language,
          domain,
          extractor: 'cheerio',
        };
      }
      fallbackReason = `konten Cheerio hanya ${cheerioMeta.content.length} karakter (< ${APP_CONFIG.limits.minCheerioContentLength})`;
    } else if (response.status === 403 || response.status === 429 || response.status >= 500) {
      fallbackReason = `respons langsung HTTP ${response.status}`;
    } else {
      fallbackReason = `respons langsung HTTP ${response.status} tanpa konten memadai`;
    }
  } catch (error: unknown) {
    fallbackReason = describeHttpFailure(error);
  }

  // Fallback path: delegate extraction to Jina Reader API when direct scraping is blocked/insufficient.
  try {
    const jinaResult = await fetchViaJinaReader(url, cheerioMeta);
    recordScrapeStatus(url, {
      extractor: 'jina',
      warning: `Direct scraping untuk ${domain} beralih ke Jina Reader (${fallbackReason}).`,
    });
    return jinaResult;
  } catch (jinaError: unknown) {
    const jinaReason = describeHttpFailure(jinaError);
    console.error(`Failed to scrape ${url} via Cheerio (${fallbackReason}) and Jina (${jinaReason})`);
    throw AppError.unprocessable(
      `Gagal mengambil konten artikel dari ${domain} (${fallbackReason}; Jina Reader juga gagal: ${jinaReason}). Situs mungkin memblokir akses otomatis.`,
      'SCRAPE_FAILED'
    );
  }
}

export async function scrapeMultipleArticlesWithStatus(
  urls: string[],
  maxArticles: number = APP_CONFIG.limits.maxRelatedArticlesToScrape
): Promise<{ articles: ArticleData[]; warnings: string[] }> {
  const limited = urls.slice(0, maxArticles);
  const settled = await Promise.allSettled(limited.map((url) => scrapeArticle(url)));
  const articles: ArticleData[] = [];
  const warnings: string[] = [];

  for (const outcome of settled) {
    if (
      outcome.status === 'fulfilled' &&
      outcome.value.content.length >= APP_CONFIG.limits.minArticleContentLength
    ) {
      articles.push(outcome.value);
      const status = getLastScrapeStatus(outcome.value.url);
      if (status?.warning) {
        warnings.push(status.warning);
      }
    }
  }

  return { articles, warnings };
}

export async function scrapeMultipleArticles(
  urls: string[],
  maxArticles: number = APP_CONFIG.limits.maxRelatedArticlesToScrape
): Promise<ArticleData[]> {
  const { articles } = await scrapeMultipleArticlesWithStatus(urls, maxArticles);
  return articles;
}

function extractTitle($: cheerio.CheerioAPI): string {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) return ogTitle;

  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle) return twitterTitle;

  const h1 = $('h1').first().text().trim();
  if (h1) return h1;

  const titleTag = $('title').text().trim();
  return titleTag || 'Judul Tidak Ditemukan';
}

function extractContent($: cheerio.CheerioAPI): string {
  const selectors = [
    'article',
    '[itemprop="articleBody"]',
    '.article-content',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.content-body',
    '.story-body',
    '.news-content',
    '#article-body',
    '.detail-text',
    '.read__content',
    '.detail__body-text',
    '.article__content',
    '.text-cnn',
    '.itp_bodycontent',
    '.side-article',
    '.content-detail',
    '.article-content-body',
    '#content-body',
  ];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      const text = el
        .find('p, h2, h3, h4, li')
        .map((_, elem) => $(elem).text().trim())
        .get()
        .filter((t) => t.length > 20)
        .join('\n\n');
      if (text.length > 100) return text;
    }
  }

  const paragraphs = $('p')
    .map((_, elem) => $(elem).text().trim())
    .get()
    .filter((t) => t.length > 30);

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }

  return '';
}

function extractDescription($: cheerio.CheerioAPI): string {
  const ogDesc = $('meta[property="og:description"]').attr('content');
  if (ogDesc) return ogDesc;

  const metaDesc = $('meta[name="description"]').attr('content');
  if (metaDesc) return metaDesc;

  const twitterDesc = $('meta[name="twitter:description"]').attr('content');
  if (twitterDesc) return twitterDesc;

  return '';
}

function extractMeta($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      const content = el.attr('content') || el.attr('datetime') || el.text().trim();
      if (content) return content;
    }
  }
  return null;
}
