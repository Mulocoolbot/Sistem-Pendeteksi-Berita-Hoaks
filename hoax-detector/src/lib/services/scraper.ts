// ============================================================
// Web Scraper Service — Article Content Extraction
// ============================================================

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ArticleData } from '@/lib/types';
import { stripHtml, getDomain } from '@/lib/utils/sanitize';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Scrapes and extracts article content from a given URL.
 */
export async function scrapeArticle(url: string): Promise<ArticleData> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, header, iframe, noscript, .ads, .advertisement, .sidebar, .comments, .related-posts').remove();

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

    return {
      url,
      title,
      content,
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
  // Try common article selectors
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
