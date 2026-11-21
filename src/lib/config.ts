export const DEFAULT_GROQ_MODEL_FAST = 'llama-3.3-70b-versatile';
export const DEFAULT_GROQ_MODEL_REASONING = 'openai/gpt-oss-120b';
export const DEFAULT_GROQ_MODEL_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct';

export interface EnvConfig {
  groqApiKey: string;
  tavilyApiKey: string;
  jinaApiKey: string;
  groqModelFast: string;
  groqModelReasoning: string;
  groqModelVision: string;
  aiCustomBaseUrl: string;
  aiCustomApiKey: string;
  aiCustomModel: string;
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
    groqModelFast: process.env.GROQ_MODEL_FAST?.trim() || DEFAULT_GROQ_MODEL_FAST,
    groqModelReasoning:
      process.env.GROQ_MODEL_REASONING?.trim() || DEFAULT_GROQ_MODEL_REASONING,
    groqModelVision:
      process.env.GROQ_MODEL_VISION?.trim() || DEFAULT_GROQ_MODEL_VISION,
    aiCustomBaseUrl: process.env.AI_CUSTOM_BASE_URL?.trim() || '',
    aiCustomApiKey: process.env.AI_CUSTOM_API_KEY?.trim() || '',
    aiCustomModel: process.env.AI_CUSTOM_MODEL?.trim() || '',
  };
}

export const APP_CONFIG = {
  ai: {
    fastModel: DEFAULT_GROQ_MODEL_FAST,
    reasoningModel: DEFAULT_GROQ_MODEL_REASONING,
    visionModel: DEFAULT_GROQ_MODEL_VISION,
    textModel: DEFAULT_GROQ_MODEL_REASONING,
    fallbackTextModel: DEFAULT_GROQ_MODEL_FAST,
    temperature: 0.3,
    maxTokens: 1500,
  },
  endpoints: {
    tavilySearch: 'https://api.tavily.com/search',
    jinaReader: 'https://r.jina.ai/',
    jinaSearch: 'https://s.jina.ai/',
    jinaRerank: 'https://api.jina.ai/v1/rerank',
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
    claimPromptContentMaxLength: 1600,
    investigationPromptContentMaxLength: 1100,
    maxPromptSearchResults: 6,
    maxPromptFactChecks: 4,
    rerankTopK: 6,
    promptSnippetMaxLength: 160,
    allowedImageMimes: ALLOWED_IMAGE_MIMES,
  },
} as const;
