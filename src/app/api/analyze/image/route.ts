import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeImage,
  extractClaims,
  generateSearchQueries,
  investigateCredibility,
} from '@/lib/services/groq';
import { checkMultipleClaims, formatFactCheckResults } from '@/lib/services/factcheck';
import {
  buildEvidenceSources,
  formatSearchResults,
  searchMultipleQueries,
} from '@/lib/services/search';
import { scrapeMultipleArticles } from '@/lib/services/scraper';
import { isRecord } from '@/lib/utils/sanitize';
import type { AnalyzeImageRequest, ApiResponse, InvestigationReport } from '@/lib/types';

export const maxDuration = 60;

const ALLOWED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function parseAnalyzeImageRequest(body: unknown): AnalyzeImageRequest | null {
  if (!isRecord(body)) {
    return null;
  }
  if (typeof body.imageBase64 !== 'string' || typeof body.mimeType !== 'string') {
    return null;
  }
  return {
    imageBase64: body.imageBase64,
    mimeType: body.mimeType,
    language: typeof body.language === 'string' ? body.language : 'id',
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody: unknown = await request.json();
    const parsedBody = parseAnalyzeImageRequest(rawBody);

    if (!parsedBody || !parsedBody.imageBase64 || !parsedBody.mimeType) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Gambar tidak valid. Silakan upload ulang.' },
        { status: 400 }
      );
    }

    const { imageBase64, mimeType, language = 'id' } = parsedBody;

    if (!ALLOWED_MIMES.has(mimeType)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `Format gambar tidak didukung: ${mimeType}. Gunakan PNG, JPEG, atau WebP.`,
        },
        { status: 400 }
      );
    }

    const imageResult = await analyzeImage(imageBase64, mimeType, language);

    if (!imageResult.extractedText || imageResult.extractedText.length < 10) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error:
            'Tidak ada teks yang dapat diekstrak dari gambar. Pastikan gambar berisi teks berita yang jelas.',
        },
        { status: 422 }
      );
    }

    const articleTitle = imageResult.summary || imageResult.extractedText.substring(0, 100);
    const articleContent = imageResult.extractedText;

    const claims = await extractClaims(articleTitle, articleContent, language);
    const searchQueries = await generateSearchQueries(claims, articleTitle, language);
    const claimTexts = claims.map((c) => c.claim);

    const [factCheckResults, searchResults] = await Promise.all([
      checkMultipleClaims(claimTexts),
      searchMultipleQueries(searchQueries),
    ]);

    const relatedUrls = searchResults.map((r) => r.link);
    const relatedArticles = await scrapeMultipleArticles(relatedUrls, 5);

    const factCheckFormatted = formatFactCheckResults(factCheckResults);
    const searchFormatted = formatSearchResults(searchResults);
    const relatedFormatted =
      relatedArticles.length > 0
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

    const investigation = await investigateCredibility(
      articleTitle,
      articleContent,
      claims,
      factCheckFormatted,
      combinedEvidence,
      language
    );

    const evidenceSources = buildEvidenceSources(
      relatedArticles,
      investigation.sourceEvaluations,
      searchResults
    );

    const report: InvestigationReport = {
      inputType: 'image',
      inputValue: `[Image: ${imageResult.contentType}]${imageResult.detectedSource ? ` from ${imageResult.detectedSource}` : ''}`,
      articleTitle,
      articleContent: articleContent.substring(0, 2000),
      overallVerdict: investigation.overallVerdict,
      credibilityScore: investigation.credibilityScore,
      confidenceLevel: investigation.confidenceLevel,
      summary: investigation.summary,
      claimAssessments: investigation.claimAssessments,
      evidenceSources,
      factCheckResults,
      analyzedAt: new Date().toISOString(),
      analysisTimeMs: Date.now() - startTime,
      keyFindings: investigation.keyFindings,
      redFlags: investigation.redFlags,
      positiveIndicators: investigation.positiveIndicators,
    };

    return NextResponse.json<ApiResponse<InvestigationReport>>(
      { success: true, data: report },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Image analysis error:', error);
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga.';

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
