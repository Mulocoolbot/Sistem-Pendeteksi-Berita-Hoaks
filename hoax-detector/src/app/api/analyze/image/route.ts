// ============================================================
// API Route: Analyze Image — /api/analyze/image
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, extractClaims, generateSearchQueries, investigateCredibility } from '@/lib/services/groq';
import { checkMultipleClaims, formatFactCheckResults } from '@/lib/services/factcheck';
import { searchMultipleQueries, formatSearchResults } from '@/lib/services/search';
import { scrapeMultipleArticles } from '@/lib/services/scraper';
import type { InvestigationReport, ApiResponse } from '@/lib/types';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { imageBase64, mimeType, language = 'id' } = body;

    // Validate input
    if (!imageBase64 || !mimeType) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Gambar tidak valid. Silakan upload ulang.' },
        { status: 400 }
      );
    }

    // Validate mime type
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(mimeType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Format gambar tidak didukung: ${mimeType}. Gunakan PNG, JPEG, atau WebP.` },
        { status: 400 }
      );
    }

    // ── Step 1: Analyze image with Gemini Vision ──────────
    console.log('[1/6] Analyzing image with Gemini Vision...');
    const imageResult = await analyzeImage(imageBase64, mimeType, language);

    if (!imageResult.extractedText || imageResult.extractedText.length < 10) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Tidak ada teks yang dapat diekstrak dari gambar. Pastikan gambar berisi teks berita yang jelas.' },
        { status: 422 }
      );
    }

    // Use extracted text as the "article"
    const articleTitle = imageResult.summary || imageResult.extractedText.substring(0, 100);
    const articleContent = imageResult.extractedText;

    // ── Step 2: Extract claims ────────────────────────────
    console.log('[2/6] Extracting claims from image text...');
    const claims = await extractClaims(articleTitle, articleContent, language);

    // ── Step 3: Generate search queries ───────────────────
    console.log('[3/6] Generating search queries...');
    const searchQueries = await generateSearchQueries(claims, articleTitle, language);

    // ── Step 4: Parallel search + fact-check ──────────────
    console.log('[4/6] Searching & fact-checking...');
    const claimTexts = claims.map(c => c.claim);

    const [factCheckResults, searchResults] = await Promise.all([
      checkMultipleClaims(claimTexts),
      searchMultipleQueries(searchQueries),
    ]);

    // ── Step 5: Scrape related articles ───────────────────
    console.log('[5/6] Scraping related articles...');
    const relatedUrls = searchResults.map(r => r.link);
    const relatedArticles = await scrapeMultipleArticles(relatedUrls, 3);

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
      articleTitle,
      articleContent,
      claims,
      factCheckFormatted,
      combinedEvidence,
      language
    );

    // Build the final report
    const report: InvestigationReport = {
      inputType: 'image',
      inputValue: `[Image: ${imageResult.contentType}]${imageResult.detectedSource ? ` from ${imageResult.detectedSource}` : ''}`,
      articleTitle,
      articleContent: articleContent.substring(0, 2000),

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

    console.log(`Image analysis complete in ${report.analysisTimeMs}ms. Verdict: ${report.overallVerdict}`);

    return NextResponse.json<ApiResponse<InvestigationReport>>(
      { success: true, data: report },
      { status: 200 }
    );
  } catch (error) {
    console.error('Image analysis error:', error);
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga.';

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
