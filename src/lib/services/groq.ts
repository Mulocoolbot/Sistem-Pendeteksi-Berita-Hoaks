import Groq from 'groq-sdk';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import type {
  ClaimAssessment,
  ClaimData,
  ClaimImportance,
  ConfidenceLevel,
  ImageAnalysisResult,
  ImageContentType,
  InvestigationAIResult,
  SourceEvaluation,
  SourceStance,
  Verdict,
} from '@/lib/types';
import { AppError } from '@/lib/utils/errors';
import {
  getClaimExtractionPrompt,
  getImageAnalysisPrompt,
  getInvestigationPrompt,
  getSearchQueryPrompt,
} from '@/lib/utils/prompts';
import { isRecord, safeJsonParse } from '@/lib/utils/sanitize';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: 'Chinese (Mandarin)',
  ja: 'Japanese',
  es: 'Spanish',
  hi: 'Hindi',
  fr: 'French',
  pt: 'Portuguese',
  id: 'Indonesian (Bahasa Indonesia)',
};

const VALID_VERDICTS: ReadonlySet<Verdict> = new Set([
  'HOAKS',
  'FAKTA',
  'MISLEADING',
  'BELUM TERVERIFIKASI',
]);

const VALID_CONFIDENCE: ReadonlySet<ConfidenceLevel> = new Set(['high', 'medium', 'low']);
const VALID_IMPORTANCE: ReadonlySet<ClaimImportance> = new Set(['high', 'medium', 'low']);
const VALID_STANCE: ReadonlySet<SourceStance> = new Set(['supports', 'contradicts', 'neutral']);
const VALID_CONTENT_TYPES: ReadonlySet<ImageContentType> = new Set([
  'news-screenshot',
  'social-media',
  'poster',
  'meme',
  'other',
]);

function getGroqClient(): Groq {
  const { groqApiKey } = getEnvConfig();
  if (!groqApiKey) {
    throw AppError.internal(
      'GROQ_API_KEY belum dikonfigurasi. Silakan daftar gratis di https://console.groq.com dan tambahkan API key ke file .env.local',
      'MISSING_GROQ_API_KEY'
    );
  }
  return new Groq({ apiKey: groqApiKey });
}

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || LANGUAGE_NAMES.id;
}

function shouldUseFallbackModel(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (error.status === 429 || error.status === 404) return true;
  if (typeof error.message === 'string') {
    return (
      error.message.includes('429') ||
      error.message.includes('rate_limit_exceeded') ||
      error.message.includes('404') ||
      error.message.includes('model_not_found') ||
      error.message.includes('model_decommissioned')
    );
  }
  return false;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function toVerdict(value: unknown): Verdict {
  if (typeof value === 'string' && VALID_VERDICTS.has(value as Verdict)) {
    return value as Verdict;
  }
  return 'BELUM TERVERIFIKASI';
}

function toConfidenceLevel(value: unknown): ConfidenceLevel {
  if (typeof value === 'string' && VALID_CONFIDENCE.has(value as ConfidenceLevel)) {
    return value as ConfidenceLevel;
  }
  return 'low';
}

function toClaimImportance(value: unknown): ClaimImportance {
  if (typeof value === 'string' && VALID_IMPORTANCE.has(value as ClaimImportance)) {
    return value as ClaimImportance;
  }
  return 'medium';
}

function toSourceStance(value: unknown): SourceStance {
  if (typeof value === 'string' && VALID_STANCE.has(value as SourceStance)) {
    return value as SourceStance;
  }
  return 'neutral';
}

function toImageContentType(value: unknown): ImageContentType {
  if (typeof value === 'string' && VALID_CONTENT_TYPES.has(value as ImageContentType)) {
    return value as ImageContentType;
  }
  return 'other';
}

function normalizeClaimAssessments(value: unknown): ClaimAssessment[] {
  if (!Array.isArray(value)) return [];

  const assessments: ClaimAssessment[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.claim !== 'string') continue;
    assessments.push({
      claim: item.claim,
      verdict: toVerdict(item.verdict),
      confidence: typeof item.confidence === 'number' ? item.confidence : 0,
      explanation: typeof item.explanation === 'string' ? item.explanation : '',
      supportingSources: toStringArray(item.supportingSources),
      contradictingSources: toStringArray(item.contradictingSources),
    });
  }
  return assessments;
}

function normalizeSourceEvaluations(value: unknown): SourceEvaluation[] {
  if (!Array.isArray(value)) return [];

  const evaluations: SourceEvaluation[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.scrapedIndex !== 'number') continue;
    evaluations.push({
      scrapedIndex: item.scrapedIndex,
      similarityScore: typeof item.similarityScore === 'number' ? item.similarityScore : 0,
      stance: toSourceStance(item.stance),
    });
  }
  return evaluations;
}

async function chatCompletion(prompt: string, languageCode: string = 'id'): Promise<string> {
  const groq = getGroqClient();
  const langName = getLanguageName(languageCode);
  const { textModel, fallbackTextModel, temperature, maxTokens } = APP_CONFIG.ai;

  const makeRequest = (modelId: string) =>
    groq.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: `You are a professional fact-checker and investigative journalist AI. Always respond in valid JSON format. All user-facing text in the JSON (such as summaries, explanations, claims, assessments, and findings) MUST be written in ${langName}.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });

  try {
    const result = await makeRequest(textModel);
    return result.choices[0]?.message?.content || '';
  } catch (error: unknown) {
    if (shouldUseFallbackModel(error)) {
      console.warn(`Primary model ${textModel} unavailable. Falling back to ${fallbackTextModel}...`);
      try {
        const fallbackResult = await makeRequest(fallbackTextModel);
        return fallbackResult.choices[0]?.message?.content || '';
      } catch (fallbackError: unknown) {
        console.error(`Fallback model ${fallbackTextModel} also failed:`, fallbackError);
        throw error;
      }
    }
    throw error;
  }
}

export async function extractClaims(
  title: string,
  content: string,
  languageCode: string = 'id'
): Promise<ClaimData[]> {
  const prompt = getClaimExtractionPrompt(title, content);
  const text = await chatCompletion(prompt, languageCode);
  const parsed = safeJsonParse(text, isRecord);

  if (!parsed || !Array.isArray(parsed.claims)) {
    console.error('Failed to parse claim extraction response:', text);
    return [
      {
        claim: title,
        context: 'Main headline/title of the article',
        importance: 'high',
      },
    ];
  }

  const claims: ClaimData[] = [];
  for (const item of parsed.claims) {
    if (!isRecord(item) || typeof item.claim !== 'string') continue;
    claims.push({
      claim: item.claim,
      context: typeof item.context === 'string' ? item.context : '',
      importance: toClaimImportance(item.importance),
    });
  }

  return claims.length > 0
    ? claims
    : [{ claim: title, context: 'Main headline/title of the article', importance: 'high' }];
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  languageCode: string = 'id'
): Promise<ImageAnalysisResult> {
  const groq = getGroqClient();
  const prompt = getImageAnalysisPrompt();
  const langName = getLanguageName(languageCode);
  const { visionModel, fallbackVisionModel, temperature, maxTokens } = APP_CONFIG.ai;

  const makeRequest = (modelId: string) =>
    groq.chat.completions.create({
      model: modelId,
      messages: [
        {
          role: 'system',
          content: `You are an expert AI image analyzer. Always respond in valid JSON format. All user-facing text in the JSON (such as summary/explanations) MUST be written in ${langName}.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });

  let result;
  try {
    result = await makeRequest(visionModel);
  } catch (error: unknown) {
    if (fallbackVisionModel && fallbackVisionModel !== visionModel && shouldUseFallbackModel(error)) {
      console.warn(`Vision model ${visionModel} unavailable. Falling back to ${fallbackVisionModel}...`);
      try {
        result = await makeRequest(fallbackVisionModel);
      } catch (fallbackError: unknown) {
        console.error(`Fallback vision model ${fallbackVisionModel} also failed:`, fallbackError);
        throw error;
      }
    } else {
      throw error;
    }
  }

  const text = result.choices[0]?.message?.content || '';
  const parsed = safeJsonParse(text, isRecord);

  if (!parsed) {
    console.error('Failed to parse image analysis response:', text);
    return {
      extractedText: text,
      contentType: 'other',
      detectedSource: null,
      detectedDate: null,
      summary: 'Gambar berhasil dianalisis, namun hasilnya tidak terstruktur.',
    };
  }

  return {
    extractedText: typeof parsed.extractedText === 'string' ? parsed.extractedText : text,
    contentType: toImageContentType(parsed.contentType),
    detectedSource: typeof parsed.detectedSource === 'string' ? parsed.detectedSource : null,
    detectedDate: typeof parsed.detectedDate === 'string' ? parsed.detectedDate : null,
    summary:
      typeof parsed.summary === 'string'
        ? parsed.summary
        : 'Gambar berhasil dianalisis, namun ringkasan tidak tersedia.',
  };
}

export async function generateSearchQueries(
  claims: ClaimData[],
  articleTitle: string,
  languageCode: string = 'id'
): Promise<string[]> {
  const claimTexts = claims.map((c) => c.claim);
  const prompt = getSearchQueryPrompt(claimTexts, articleTitle);
  const text = await chatCompletion(prompt, languageCode);
  const parsed = safeJsonParse(text, isRecord);
  const queries = parsed ? toStringArray(parsed.queries) : [];

  if (queries.length === 0) {
    return [articleTitle, claimTexts[0] || articleTitle].filter(Boolean);
  }

  return queries;
}

export async function investigateCredibility(
  articleTitle: string,
  articleContent: string,
  claims: ClaimData[],
  factCheckData: string,
  relatedArticles: string,
  languageCode: string = 'id'
): Promise<InvestigationAIResult> {
  const claimTexts = claims.map((c) => c.claim);
  const prompt = getInvestigationPrompt(
    articleTitle,
    articleContent,
    claimTexts,
    factCheckData,
    relatedArticles
  );

  const text = await chatCompletion(prompt, languageCode);
  const parsed = safeJsonParse(text, isRecord);

  if (!parsed) {
    console.error('Failed to parse investigation response:', text);
    return {
      overallVerdict: 'BELUM TERVERIFIKASI',
      credibilityScore: 50,
      confidenceLevel: 'low',
      summary: 'Sistem tidak dapat menyelesaikan investigasi secara lengkap. Silakan verifikasi secara manual.',
      claimAssessments: [],
      keyFindings: ['Analisis AI gagal diproses'],
      redFlags: [],
      positiveIndicators: [],
      sourceEvaluations: [],
    };
  }

  return {
    overallVerdict: toVerdict(parsed.overallVerdict),
    credibilityScore: typeof parsed.credibilityScore === 'number' ? parsed.credibilityScore : 50,
    confidenceLevel: toConfidenceLevel(parsed.confidenceLevel),
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analisis tidak tersedia.',
    claimAssessments: normalizeClaimAssessments(parsed.claimAssessments),
    keyFindings: toStringArray(parsed.keyFindings),
    redFlags: toStringArray(parsed.redFlags),
    positiveIndicators: toStringArray(parsed.positiveIndicators),
    sourceEvaluations: normalizeSourceEvaluations(parsed.sourceEvaluations),
  };
}
