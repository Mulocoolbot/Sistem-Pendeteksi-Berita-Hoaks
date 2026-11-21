interface EnvConfig {
  groqApiKey: string;
  tavilyApiKey: string;
  jinaApiKey: string;
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
    tavilyApiKey: process.env.TAVILY_API_KEY || '',
    jinaApiKey: process.env.JINA_API_KEY || '',
  };
}

export const APP_CONFIG = {
  ai: {
    textModel: 'openai/gpt-oss-120b',
    fallbackTextModel: 'openai/gpt-oss-20b',
    visionModel: 'qwen/qwen3.8-27b',
    temperature: 0.3,
    maxTokens: 1500,
  },
  endpoints: {
    tavilySearch: 'https://api.tavily.com/search',
    jinaReader: 'https://r.jina.ai/',
    jinaSearch: 'https://s.jina.ai/',
  },
  timeouts: {
    externalApiMs: HTTP_TIMEOUT_MS,
    directScrapeMs: 5000,
    jinaScrapeMs: HTTP_TIMEOUT_MS,
    cacheScrapeMs: 4000,
    simpleScrapeMs: 4000,
    searchThrottleDelayMs: 1000,
    stepSimulationIntervalMs: 3000,
    scrollIntoViewDelayMs: 300,
  },
  limits: {
    maxRedirects: 5,
    minArticleContentLength: 50,
    minCheerioContentLength: 200,
    minExtractedImageTextLength: 10,
    maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
    maxRelatedArticlesToScrape: 3,
    maxSearchQueriesToRun: 2,
    resultsPerSearchQuery: 5,
    defaultSearchResults: 5,
    reportContentPreviewLength: 2000,
    relatedArticleExcerptLength: 700,
    evidenceSnippetLength: 160,
    fallbackTitleMaxLength: 100,
    bodyFallbackMaxLength: 5000,
    claimPromptContentMaxLength: 2500,
    investigationPromptContentMaxLength: 1800,
    maxPromptSearchResults: 6,
    maxPromptFactChecks: 6,
    promptSnippetMaxLength: 240,
    allowedImageMimes: ALLOWED_IMAGE_MIMES,
  },
} as const;
