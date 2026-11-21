import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { z } from 'zod';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import {
  ClaimExtractionOutputSchema,
  FinalSynthesisOutputSchema,
  ImageAnalysisOutputSchema,
} from '@/lib/schemas/analysis';
import type {
  ClaimExtractionOutput,
  FinalSynthesisOutput,
  ImageAnalysisResult,
} from '@/lib/types';
import { AppError } from '@/lib/utils/errors';
import {
  type FinalSynthesisPromptInput,
  getClaimExtractionPrompt,
  getFinalSynthesisPrompt,
  getImageAnalysisPrompt,
} from '@/lib/utils/prompts';
import { isRecord } from '@/lib/utils/sanitize';

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

export interface GroqStructuredCallParams {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
}

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

function isJsonValidationError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  if (typeof error.message === 'string' && error.message.includes('json_validate_failed')) {
    return true;
  }
  if (isRecord(error.error) && isRecord(error.error.error)) {
    return error.error.error.code === 'json_validate_failed';
  }
  return false;
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

function tryParseJson(
  rawText: string
): { ok: true; data: unknown } | { ok: false; error: string } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: 'Respons LLM kosong.' };
  }

  try {
    return { ok: true, data: JSON.parse(trimmed) };
  } catch (directError: unknown) {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return { ok: true, data: JSON.parse(jsonMatch[0]) };
      } catch (embeddedError: unknown) {
        return {
          ok: false,
          error:
            embeddedError instanceof Error
              ? embeddedError.message
              : 'Sintaks JSON tidak valid.',
        };
      }
    }
    return {
      ok: false,
      error:
        directError instanceof Error ? directError.message : 'Sintaks JSON tidak valid.',
    };
  }
}

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

async function sendJsonCompletion(
  groq: Groq,
  messages: ChatCompletionMessageParam[],
  primaryModel: string,
  fallbackModel: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const requestModel = async (modelId: string): Promise<string> => {
    const result = await groq.chat.completions.create({
      model: modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });
    return result.choices[0]?.message?.content || '';
  };

  try {
    return await requestModel(primaryModel);
  } catch (error: unknown) {
    if (shouldUseFallbackModel(error)) {
      return await requestModel(fallbackModel);
    }
    throw error;
  }
}

function parseAndValidate<T>(
  rawText: string,
  schema: z.ZodSchema<T>
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = tryParseJson(rawText);
  if (!parsed.ok) {
    return { ok: false, error: `JSON parse error: ${parsed.error}` };
  }

  const validation = schema.safeParse(parsed.data);
  if (!validation.success) {
    return { ok: false, error: `Zod validation error: ${formatZodIssues(validation.error)}` };
  }

  return { ok: true, data: validation.data };
}

export async function callGroqStructured<T>(
  params: GroqStructuredCallParams,
  schema: z.ZodSchema<T>
): Promise<T> {
  const groq = getGroqClient();
  const primaryModel = params.model ?? APP_CONFIG.ai.textModel;
  const fallbackModel = params.fallbackModel ?? APP_CONFIG.ai.fallbackTextModel;
  const temperature = params.temperature ?? APP_CONFIG.ai.temperature;
  const maxTokens = params.maxTokens ?? APP_CONFIG.ai.maxTokens;

  const baseMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: params.systemPrompt },
    { role: 'user', content: params.userPrompt },
  ];

  let firstRawText = '';
  let firstError = '';

  try {
    firstRawText = await sendJsonCompletion(
      groq,
      baseMessages,
      primaryModel,
      fallbackModel,
      temperature,
      maxTokens
    );
    const firstResult = parseAndValidate(firstRawText, schema);
    if (firstResult.ok) {
      return firstResult.data;
    }
    firstError = firstResult.error;
  } catch (error: unknown) {
    if (!isJsonValidationError(error)) {
      throw error;
    }
    firstError = 'Provider menolak JSON output (json_validate_failed).';
  }

  // Perform exactly 1 retry with the concise schema/JSON error so the model can self-correct.
  const retryMessages: ChatCompletionMessageParam[] = [
    ...baseMessages,
    ...(firstRawText ? [{ role: 'assistant' as const, content: firstRawText }] : []),
    {
      role: 'user',
      content: `Respons JSON sebelumnya gagal validasi: ${firstError}. Perbaiki formatnya dan kembalikan HANYA objek JSON valid yang sesuai persis dengan schema yang diminta.`,
    },
  ];

  let retryRawText = '';
  try {
    retryRawText = await sendJsonCompletion(
      groq,
      retryMessages,
      primaryModel,
      fallbackModel,
      temperature,
      maxTokens
    );
  } catch (error: unknown) {
    if (isJsonValidationError(error)) {
      throw AppError.badGateway(
        'Gagal memvalidasi output AI terhadap schema setelah 1x retry: json_validate_failed.',
        'LLM_SCHEMA_VALIDATION_FAILED'
      );
    }
    throw error;
  }

  const retryResult = parseAndValidate(retryRawText, schema);
  if (retryResult.ok) {
    return retryResult.data;
  }

  throw AppError.badGateway(
    `Output AI tidak sesuai schema setelah 1x retry: ${retryResult.error}`,
    'LLM_SCHEMA_VALIDATION_FAILED'
  );
}

export async function extractClaimsAndSignals(
  title: string,
  content: string,
  languageCode: string = 'id',
  publishedDate: string | null = null
): Promise<ClaimExtractionOutput> {
  const langName = getLanguageName(languageCode);
  const systemPrompt = `You are a professional fact-checker and investigative journalist AI. Always respond with a single valid JSON object. All descriptive text (headline, statements, reasons) MUST be written in ${langName}, while the "language" field MUST be strictly "id" or "en".`;
  const userPrompt = getClaimExtractionPrompt(title, content, publishedDate);

  return callGroqStructured(
    { systemPrompt, userPrompt },
    ClaimExtractionOutputSchema
  );
}

export async function synthesizeFinalVerdict(
  input: FinalSynthesisPromptInput,
  languageCode: string = 'id'
): Promise<FinalSynthesisOutput> {
  const langName = getLanguageName(languageCode);
  const systemPrompt = `You are a senior investigative fact-checker AI. Always respond with a single valid JSON object. Write "summary" and claim "reasoning" in ${langName}. Never invent URLs or facts outside the provided evidence.`;
  const userPrompt = getFinalSynthesisPrompt(input);

  return callGroqStructured(
    { systemPrompt, userPrompt },
    FinalSynthesisOutputSchema
  );
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  languageCode: string = 'id'
): Promise<ImageAnalysisResult> {
  const groq = getGroqClient();
  const prompt = getImageAnalysisPrompt();
  const langName = getLanguageName(languageCode);
  const { visionModel, temperature, maxTokens } = APP_CONFIG.ai;

  const systemContent = `You are an expert AI image analyzer. Always respond in valid JSON format. All user-facing text in the JSON (such as summary/explanations) MUST be written in ${langName}.`;
  const userContent: ChatCompletionMessageParam['content'] = [
    { type: 'text', text: prompt },
    {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${imageBase64}`,
      },
    },
  ];

  const requestVision = async (extraFeedback?: string): Promise<string> => {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
      ...(extraFeedback
        ? [
            {
              role: 'user' as const,
              content: `Previous JSON validation failed: ${extraFeedback}. Return ONLY valid JSON matching the exact schema.`,
            },
          ]
        : []),
    ];

    const result = await groq.chat.completions.create({
      model: visionModel,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });

    return result.choices[0]?.message?.content || '';
  };

  let firstError = '';
  try {
    const firstRaw = await requestVision();
    const firstParsed = parseAndValidate(firstRaw, ImageAnalysisOutputSchema);
    if (firstParsed.ok) {
      return firstParsed.data;
    }
    firstError = firstParsed.error;
  } catch (error: unknown) {
    if (!isJsonValidationError(error)) {
      throw error;
    }
    firstError = 'Provider json_validate_failed';
  }

  const retryRaw = await requestVision(firstError);
  const retryParsed = parseAndValidate(retryRaw, ImageAnalysisOutputSchema);
  if (retryParsed.ok) {
    return retryParsed.data;
  }

  throw AppError.badGateway(
    `Output analisis gambar AI tidak sesuai schema setelah 1x retry: ${retryParsed.error}`,
    'LLM_SCHEMA_VALIDATION_FAILED'
  );
}
