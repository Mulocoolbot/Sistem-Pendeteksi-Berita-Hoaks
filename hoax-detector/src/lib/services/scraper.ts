// ============================================================
// Web Scraper Service — Article Content Extraction
// Dengan anti-blocking headers dan fallback strategies
// ============================================================

import axios, { type AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import type { ArticleData } from '@/lib/types';
import { stripHtml, getDomain } from '@/lib/utils/sanitize';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Builds realistic browser-like headers to avoid being blocked.
 */
function getBrowserHeaders(url: string): Record<string, string> {
  const domain = getDomain(url);
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': `https://www.google.com/search?q=site:${domain}`,
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };
}

/**
 * Fetches HTML with retry logic and fallback strategies.
 */
async function fetchHtml(url: string): Promise<string> {
  const config: AxiosRequestConfig = {
    headers: getBrowserHeaders(url),
    timeout: 20000,
    maxRedirects: 5,
    // Accept all status codes to see what we get
    validateStatus: (status) => status < 500,
  };

  // Attempt 1: Direct fetch
  try {
    const response = await axios.get(url, config);
    if (response.status === 200 && response.data) {
      return response.data;
    }
  } catch (e) {
    console.warn(`Direct fetch failed for ${url}:`, (e as Error).message);
  }

  // Attempt 2: Try via Google Web Cache
  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
    const response = await axios.get(cacheUrl, {
      ...config,
      headers: {
        ...getBrowserHeaders(cacheUrl),
        'Referer': 'https://www.google.com/',
      },
    });
    if (response.status === 200 && response.data) {
      console.log(`Fetched via Google Cache: ${url}`);
      return response.data;
    }
  } catch {
    console.warn(`Google cache fallback failed for ${url}`);
  }

  // Attempt 3: Try without some headers (simpler request)
  try {
    const simpleResponse = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,*/*',
      },
      timeout: 15000,
      maxRedirects: 5,
    });
    if (simpleResponse.data) {
      return simpleResponse.data;
    }
  } catch {
    // Fall through to final error
  }

  throw new Error(`Tidak bisa mengambil konten dari ${getDomain(url)} setelah beberapa percobaan.`);
}

/**
 * Scrapes and extracts article content from a given URL.
 */
export async function scrapeArticle(url: string): Promise<ArticleData> {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript, .ads, .advertisement, .sidebar, .comments, .related-posts, .social-share, .breadcrumb').remove();

    // Extract metadata
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
    const siteName = extractMeta($, [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
    ]) || getDomain(url);
    const imageUrl = extractMeta($, [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]',
    ]);
    const language = extractMeta($, [
      'meta[property="og:locale"]',
      'html[lang]',
    ]) || $('html').attr('lang') || null;

    // Even if we only got metadata (title + description), that's OK
    const finalContent = content.length > 50
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
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    throw new Error(`Gagal mengambil konten dari ${getDomain(url)}. Situs mungkin memblokir akses atau tidak tersedia.`);
  }
}

/**
 * Scrapes multiple URLs for comparison.
 */
export async function scrapeMultipleArticles(
  urls: string[],
  maxArticles: number = 5
): Promise<ArticleData[]> {
  const limited = urls.slice(0, maxArticles);
  const results: ArticleData[] = [];

  for (const url of limited) {
    try {
      const article = await scrapeArticle(url);
      if (article.content.length > 50) {
        results.push(article);
      }
    } catch {
      // Skip failed scrapes silently
      continue;
    }
  }

  return results;
}

// ── Helper Functions ────────────────────────────────────

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
  // Try common article selectors (includes Indonesian news sites)
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
    '.read__content',        // Kompas
    '.detail__body-text',    // Detik
    '.article__content',     // CNN Indonesia
    '.text-cnn',             // CNN Indonesia alt
    '.itp_bodycontent',      // Tribunnews
    '.side-article',         // Merdeka
    '.content-detail',       // Liputan6
    '.article-content-body', // Tempo
    '#content-body',         // Kumparan
  ];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      const text = el
        .find('p, h2, h3, h4, li')
        .map((_, elem) => $(elem).text().trim())
        .get()
        .filter(t => t.length > 20)
        .join('\n\n');
      if (text.length > 100) return text;
    }
  }

  // Fallback: get all paragraph text from body
  const paragraphs = $('p')
    .map((_, elem) => $(elem).text().trim())
    .get()
    .filter(t => t.length > 30);

  if (paragraphs.length > 0) {
    return paragraphs.join('\n\n');
  }

  // Last resort: get body text
  return stripHtml($('body').html() || '').substring(0, 5000);
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
