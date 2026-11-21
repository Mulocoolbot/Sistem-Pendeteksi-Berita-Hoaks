import axios, { type AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { APP_CONFIG } from '@/lib/config';
import type { ArticleData } from '@/lib/types';
import { AppError } from '@/lib/utils/errors';
import { getDomain, isRecord, stripHtml } from '@/lib/utils/sanitize';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getBrowserHeaders(url: string): Record<string, string> {
  const domain = getDomain(url);
  return {
    'User-Agent': getRandomUserAgent(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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

function isUnreachableHostError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  const code = typeof error.code === 'string' ? error.code : '';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED') {
    return true;
  }
  if (typeof error.message === 'string') {
    return (
      error.message.includes('ENOTFOUND') ||
      error.message.includes('EAI_AGAIN') ||
      error.message.includes('getaddrinfo')
    );
  }
  return false;
}

async function fetchHtml(url: string): Promise<string> {
  const config: AxiosRequestConfig = {
    headers: getBrowserHeaders(url),
    timeout: APP_CONFIG.timeouts.directScrapeMs,
    maxRedirects: APP_CONFIG.limits.maxRedirects,
    validateStatus: (status) => status < 500,
  };

  try {
    const response = await axios.get<string>(url, config);
    if (response.status === 200 && typeof response.data === 'string' && response.data.length > 0) {
      return response.data;
    }
  } catch (error: unknown) {
    if (isUnreachableHostError(error)) {
      throw AppError.unprocessable(
        `Domain ${getDomain(url)} tidak ditemukan atau tidak dapat dijangkau.`,
        'UNREACHABLE_DOMAIN'
      );
    }
  }

  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
    const response = await axios.get<string>(cacheUrl, {
      ...config,
      timeout: APP_CONFIG.timeouts.cacheScrapeMs,
      headers: {
        ...getBrowserHeaders(cacheUrl),
        Referer: 'https://www.google.com/',
      },
    });
    if (response.status === 200 && typeof response.data === 'string' && response.data.length > 0) {
      return response.data;
    }
  } catch {
    // Fall through to simple fetch when Google Cache is unavailable.
  }

  try {
    const simpleResponse = await axios.get<string>(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html,*/*',
      },
      timeout: APP_CONFIG.timeouts.simpleScrapeMs,
      maxRedirects: APP_CONFIG.limits.maxRedirects,
    });
    if (typeof simpleResponse.data === 'string' && simpleResponse.data.length > 0) {
      return simpleResponse.data;
    }
  } catch {
    // Throw unified SCRAPE_FAILED error below after exhausting all strategies.
  }

  throw AppError.unprocessable(
    `Tidak bisa mengambil konten dari ${getDomain(url)} setelah beberapa percobaan.`,
    'SCRAPE_FAILED'
  );
}

export async function scrapeArticle(url: string): Promise<ArticleData> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    $('script, style, nav, footer, header, iframe, noscript, .ads, .advertisement, .sidebar, .comments, .related-posts, .social-share, .breadcrumb').remove();

    const title = extractTitle($);
    const content = extractContent($);
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
      extractMeta($, ['meta[property="og:locale"]']) ||
      $('html').attr('lang') ||
      null;

    const finalContent =
      content.length > APP_CONFIG.limits.minArticleContentLength
        ? content
        : description || title;

    return {
      url,
      title,
      content: finalContent,
      description,
      author,
      publishedDate,
      siteName,
      imageUrl,
      language,
    };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error(`Failed to scrape ${url}:`, error);
    throw AppError.unprocessable(
      `Gagal mengambil konten dari ${getDomain(url)}. Situs mungkin memblokir akses atau tidak tersedia.`,
      'SCRAPE_FAILED'
    );
  }
}

export async function scrapeMultipleArticles(
  urls: string[],
  maxArticles: number = APP_CONFIG.limits.maxRelatedArticlesToScrape
): Promise<ArticleData[]> {
  const limited = urls.slice(0, maxArticles);
  const settled = await Promise.allSettled(limited.map((url) => scrapeArticle(url)));
  const results: ArticleData[] = [];

  for (const outcome of settled) {
    if (
      outcome.status === 'fulfilled' &&
      outcome.value.content.length > APP_CONFIG.limits.minArticleContentLength
    ) {
      results.push(outcome.value);
    }
  }

  return results;
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

  return stripHtml($('body').html() || '').substring(0, APP_CONFIG.limits.bodyFallbackMaxLength);
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
