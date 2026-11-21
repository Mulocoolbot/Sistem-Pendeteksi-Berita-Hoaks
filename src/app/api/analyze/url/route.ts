import { NextRequest } from 'next/server';
import { APP_CONFIG } from '@/lib/config';
import { UrlAnalyzeInputSchema } from '@/lib/schemas/analysis';
import { runInvestigation } from '@/lib/services/analyzer';
import { scrapeArticle } from '@/lib/services/scraper';
import { analysisCache, buildUrlCacheKey } from '@/lib/utils/cache';
import {
  AppError,
  createSuccessResponse,
  parseJsonBody,
  toErrorResponse,
} from '@/lib/utils/errors';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await parseJsonBody(request);
    const parsed = UrlAnalyzeInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issueMessage =
        parsed.error.issues[0]?.message ||
        'URL tidak valid. Pastikan URL dimulai dengan http:// atau https://';
      throw AppError.badRequest(issueMessage, 'INVALID_URL');
    }

    const { url, language } = parsed.data;
    const cacheKey = buildUrlCacheKey(url);
    const cachedReport = analysisCache.get(cacheKey);

    if (cachedReport) {
      return createSuccessResponse({
        ...cachedReport,
        cached: true,
        analysisTimeMs: Date.now() - startTime,
      });
    }

    const article = await scrapeArticle(url);
    if (!article.content || article.content.length < APP_CONFIG.limits.minArticleContentLength) {
      throw AppError.unprocessable(
        'Konten artikel tidak dapat diekstrak. Situs mungkin memblokir akses.',
        'UNEXTRACTABLE_ARTICLE'
      );
    }

    const report = await runInvestigation({
      inputType: 'url',
      inputValue: url,
      articleTitle: article.title,
      articleContent: article.content,
      language,
      excludeUrl: url,
      publishedDate: article.publishedDate,
      cacheKey,
      startTimeMs: startTime,
    });

    return createSuccessResponse(report);
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
