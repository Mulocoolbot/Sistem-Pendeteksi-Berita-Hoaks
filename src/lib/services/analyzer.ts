import { APP_CONFIG } from '@/lib/config';
import { checkMultipleClaims, formatFactCheckResults } from '@/lib/services/factcheck';
import {
  extractClaims,
  generateSearchQueries,
  investigateCredibility,
} from '@/lib/services/groq';
import { scrapeMultipleArticles } from '@/lib/services/scraper';
import {
  buildEvidenceSources,
  formatSearchResults,
  searchMultipleQueries,
} from '@/lib/services/search';
import type { ArticleData, InvestigationReport } from '@/lib/types';

interface AnalyzerPipelineInput {
  inputType: 'url' | 'image';
  inputValue: string;
  articleTitle: string;
  articleContent: string;
  language: string;
  excludeUrl?: string;
  startTimeMs?: number;
}

function formatRelatedArticles(articles: ArticleData[]): string {
  if (articles.length === 0) return '';

  return articles
    .map(
      (article, index) =>
        `[Scraped ${index + 1}] "${article.title}" (${article.siteName})\n${article.content.substring(0, APP_CONFIG.limits.relatedArticleExcerptLength)}`
    )
    .join('\n\n');
}

export async function runInvestigationPipeline(
  input: AnalyzerPipelineInput
): Promise<InvestigationReport> {
  const {
    inputType,
    inputValue,
    articleTitle,
    articleContent,
    language,
    excludeUrl,
    startTimeMs = Date.now(),
  } = input;

  const claims = await extractClaims(articleTitle, articleContent, language);
  const searchQueries = await generateSearchQueries(claims, articleTitle, language);
  const claimTexts = claims.map((claim) => claim.claim);

  const [factCheckResults, searchResults] = await Promise.all([
    checkMultipleClaims(claimTexts),
    searchMultipleQueries(searchQueries),
  ]);

  const relatedUrls = excludeUrl
    ? searchResults.map((result) => result.link).filter((link) => link !== excludeUrl)
    : searchResults.map((result) => result.link);

  const relatedArticles = await scrapeMultipleArticles(
    relatedUrls,
    APP_CONFIG.limits.maxRelatedArticlesToScrape
  );

  const factCheckFormatted = formatFactCheckResults(factCheckResults);
  const searchFormatted = formatSearchResults(searchResults);
  const relatedFormatted = formatRelatedArticles(relatedArticles);

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

  return {
    inputType,
    inputValue,
    articleTitle,
    articleContent: articleContent.substring(0, APP_CONFIG.limits.reportContentPreviewLength),
    overallVerdict: investigation.overallVerdict,
    credibilityScore: investigation.credibilityScore,
    confidenceLevel: investigation.confidenceLevel,
    summary: investigation.summary,
    claimAssessments: investigation.claimAssessments,
    evidenceSources,
    factCheckResults,
    analyzedAt: new Date().toISOString(),
    analysisTimeMs: Date.now() - startTimeMs,
    keyFindings: investigation.keyFindings,
    redFlags: investigation.redFlags,
    positiveIndicators: investigation.positiveIndicators,
  };
}
