import { NextRequest } from 'next/server';
import { APP_CONFIG } from '@/lib/config';
import { runInvestigationPipeline } from '@/lib/services/analyzer';
import { scrapeArticle } from '@/lib/services/scraper';
import type { AnalyzeUrlRequest } from '@/lib/types';
import { AppError, createErrorResponse, createSuccessResponse, parseJsonBody } from '@/lib/utils/errors';
import { isRecord, isValidUrl } from '@/lib/utils/sanitize';

export const maxDuration = 60;

function parseAnalyzeUrlRequest(body: unknown): AnalyzeUrlRequest {
  if (!isRecord(body) || typeof body.url !== 'string' || !isValidUrl(body.url)) {
    throw AppError.badRequest(
      'URL tidak valid. Pastikan URL dimulai dengan http:// atau https://',
      'INVALID_URL'
    );
  }

  return {
    url: body.url,
    language: typeof body.language === 'string' ? body.language : 'id',
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await parseJsonBody(request);
    const { url, language = 'id' } = parseAnalyzeUrlRequest(rawBody);

    const article = await scrapeArticle(url);
    if (!article.content || article.content.length < APP_CONFIG.limits.minArticleContentLength) {
      throw AppError.unprocessable(
        'Konten artikel tidak dapat diekstrak. Situs mungkin memblokir akses.',
        'UNEXTRACTABLE_ARTICLE'
      );
    }

    const report = await runInvestigationPipeline({
      inputType: 'url',
      inputValue: url,
      articleTitle: article.title,
      articleContent: article.content,
      language,
      excludeUrl: url,
      startTimeMs: startTime,
    });

    return createSuccessResponse(report);
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}
