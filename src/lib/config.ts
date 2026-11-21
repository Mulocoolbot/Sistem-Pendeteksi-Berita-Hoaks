interface EnvConfig {
  groqApiKey: string;
  googleFactCheckApiKey: string;
  googleCustomSearchApiKey: string;
  googleSearchEngineId: string;
}

export const HTTP_TIMEOUT_MS = 10_000;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];

export function getEnvConfig(): EnvConfig {
  return {
    groqApiKey: process.env.GROQ_API_KEY || '',
    googleFactCheckApiKey: process.env.GOOGLE_FACT_CHECK_API_KEY || '',
    googleCustomSearchApiKey: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || '',
    googleSearchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || '',
  };
}

export const APP_CONFIG = {
  ai: {
    textModel: 'openai/gpt-oss-120b',
    fallbackTextModel: 'openai/gpt-oss-20b',
    visionModel: 'qwen/qwen3.8-27b',
    temperature: 0.3,
    maxTokens: 4096,
  },
  endpoints: {
    googleFactCheck: 'https://factchecktools.googleapis.com/v1alpha1/claims:search',
    googleCustomSearch: 'https://www.googleapis.com/customsearch/v1',
    yahooSearch: 'https://search.yahoo.com/search',
  },
  timeouts: {
    externalApiMs: HTTP_TIMEOUT_MS,
    directScrapeMs: 5000,
    cacheScrapeMs: 4000,
    simpleScrapeMs: 4000,
    searchThrottleDelayMs: 1000,
    stepSimulationIntervalMs: 3000,
    scrollIntoViewDelayMs: 300,
  },
  limits: {
    maxRedirects: 5,
    minArticleContentLength: 50,
    minExtractedImageTextLength: 10,
    maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
    maxRelatedArticlesToScrape: 5,
    maxSearchQueriesToRun: 2,
    resultsPerSearchQuery: 3,
    defaultSearchResults: 5,
    maxGoogleSearchResults: 10,
    reportContentPreviewLength: 2000,
    relatedArticleExcerptLength: 500,
    evidenceSnippetLength: 160,
    fallbackTitleMaxLength: 100,
    bodyFallbackMaxLength: 5000,
    claimPromptContentMaxLength: 4000,
    investigationPromptContentMaxLength: 3000,
    allowedImageMimes: ALLOWED_IMAGE_MIMES,
  },
} as const;
