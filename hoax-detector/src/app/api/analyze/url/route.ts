// ============================================================
// API Route: Analyze URL — /api/analyze/url
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { scrapeArticle, scrapeMultipleArticles } from '@/lib/services/scraper';
import { extractClaims, generateSearchQueries, investigateCredibility } from '@/lib/services/groq';
import { checkMultipleClaims, formatFactCheckResults } from '@/lib/services/factcheck';
import { searchMultipleQueries, formatSearchResults } from '@/lib/services/search';
import { isValidUrl } from '@/lib/utils/sanitize';
import type { InvestigationReport, ApiResponse } from '@/lib/types';

export const maxDuration = 60; // Allow up to 60 seconds

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { url, language = 'id' } = body;

    // Validate input
    if (!url || !isValidUrl(url)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'URL tidak valid. Pastikan URL dimulai dengan http:// atau https://' },
        { status: 400 }
      );
    }

    // ── Step 1: Scrape the article ────────────────────────
    console.log('[1/6] Scraping article:', url);
    const article = await scrapeArticle(url);

    if (!article.content || article.content.length < 50) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Konten artikel tidak dapat diekstrak. Situs mungkin memblokir akses.' },
        { status: 422 }
      );
    }

    // ── Step 2: Extract claims using AI ───────────────────
    console.log('[2/6] Extracting claims...');
    const claims = await extractClaims(article.title, article.content, language);

    // ── Step 3: Generate search queries ───────────────────
    console.log('[3/6] Generating search queries...');
    const searchQueries = await generateSearchQueries(claims, article.title, language);

    // ── Step 4: Parallel search + fact-check ──────────────
    console.log('[4/6] Searching & fact-checking...');
    const claimTexts = claims.map(c => c.claim);

    const [factCheckResults, searchResults] = await Promise.all([
      checkMultipleClaims(claimTexts),
      searchMultipleQueries(searchQueries),
    ]);

    // ── Step 5: Scrape related articles for comparison ────
    console.log('[5/6] Scraping related articles...');
    const relatedUrls = searchResults
      .map(r => r.link)
      .filter(link => link !== url); // Exclude the original URL

    const relatedArticles = await scrapeMultipleArticles(relatedUrls, 3);

    // Format evidence for AI
    const factCheckFormatted = formatFactCheckResults(factCheckResults);
    const searchFormatted = formatSearchResults(searchResults);

    const relatedFormatted = relatedArticles.length > 0
      ? relatedArticles
          .map(
            (a, i) =>
              `[Scraped ${i + 1}] "${a.title}" (${a.siteName})\n${a.content.substring(0, 500)}`
          )
          .join('\n\n')
      : '';

    const combinedEvidence = [searchFormatted, relatedFormatted]
      .filter(Boolean)
      .join('\n\n---\n\n');

    // ── Step 6: AI Investigation ──────────────────────────
    console.log('[6/6] Running AI investigation...');
    const investigation = await investigateCredibility(
      article.title,
      article.content,
      claims,
      factCheckFormatted,
      combinedEvidence,
      language
    );

    // Build the final report
    const report: InvestigationReport = {
      inputType: 'url',
      inputValue: url,
      articleTitle: article.title,
      articleContent: article.content.substring(0, 2000),

      overallVerdict: (investigation.overallVerdict as InvestigationReport['overallVerdict']) || 'BELUM TERVERIFIKASI',
      credibilityScore: typeof investigation.credibilityScore === 'number'
        ? investigation.credibilityScore
        : 50,
      confidenceLevel: (investigation.confidenceLevel as InvestigationReport['confidenceLevel']) || 'low',

      summary: (investigation.summary as string) || 'Analisis tidak tersedia.',
      claimAssessments: Array.isArray(investigation.claimAssessments)
        ? investigation.claimAssessments as InvestigationReport['claimAssessments']
        : [],
      evidenceSources: Array.isArray(investigation.evidenceSources)
        ? investigation.evidenceSources as InvestigationReport['evidenceSources']
        : searchResults.map(r => ({
            title: r.title,
            url: r.link,
            siteName: r.displayLink,
            snippet: r.snippet,
            publishedDate: r.datePublished,
            similarityScore: 0,
            stance: 'neutral' as const,
          })),
      factCheckResults,

      analyzedAt: new Date().toISOString(),
      analysisTimeMs: Date.now() - startTime,

      keyFindings: Array.isArray(investigation.keyFindings)
        ? investigation.keyFindings as string[]
        : [],
      redFlags: Array.isArray(investigation.redFlags)
        ? investigation.redFlags as string[]
        : [],
      positiveIndicators: Array.isArray(investigation.positiveIndicators)
        ? investigation.positiveIndicators as string[]
        : [],
    };

    console.log(`Analysis complete in ${report.analysisTimeMs}ms. Verdict: ${report.overallVerdict}`);

    return NextResponse.json<ApiResponse<InvestigationReport>>(
      { success: true, data: report },
      { status: 200 }
    );
  } catch (error) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga.';

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
