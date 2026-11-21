import { NextRequest, NextResponse } from 'next/server';
import { scrapeArticle, scrapeMultipleArticles } from '@/lib/services/scraper';
import {
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
import { isRecord, isValidUrl } from '@/lib/utils/sanitize';
import type { AnalyzeUrlRequest, ApiResponse, InvestigationReport } from '@/lib/types';

export const maxDuration = 60;

function parseAnalyzeUrlRequest(body: unknown): AnalyzeUrlRequest | null {
  if (!isRecord(body) || typeof body.url !== 'string') {
    return null;
  }
  return {
    url: body.url,
    language: typeof body.language === 'string' ? body.language : 'id',
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody: unknown = await request.json();
    const parsedBody = parseAnalyzeUrlRequest(rawBody);

    if (!parsedBody || !parsedBody.url || !isValidUrl(parsedBody.url)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'URL tidak valid. Pastikan URL dimulai dengan http:// atau https://',
        },
        { status: 400 }
      );
    }

    const { url, language = 'id' } = parsedBody;
    const article = await scrapeArticle(url);

    if (!article.content || article.content.length < 50) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Konten artikel tidak dapat diekstrak. Situs mungkin memblokir akses.',
        },
        { status: 422 }
      );
    }

    const claims = await extractClaims(article.title, article.content, language);
    const searchQueries = await generateSearchQueries(claims, article.title, language);
    const claimTexts = claims.map((c) => c.claim);

    const [factCheckResults, searchResults] = await Promise.all([
      checkMultipleClaims(claimTexts),
      searchMultipleQueries(searchQueries),
    ]);

    const relatedUrls = searchResults.map((r) => r.link).filter((link) => link !== url);
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
      article.title,
      article.content,
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
      inputType: 'url',
      inputValue: url,
      articleTitle: article.title,
      articleContent: article.content.substring(0, 2000),
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
    console.error('Analysis error:', error);
    const message =
      error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga.';

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
