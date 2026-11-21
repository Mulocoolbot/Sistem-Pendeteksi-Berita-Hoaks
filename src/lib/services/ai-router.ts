import axios from 'axios';
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { z } from 'zod';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import type { AiTaskType } from '@/lib/types';
import { AppError } from '@/lib/utils/errors';
import { isRecord } from '@/lib/utils/sanitize';

export interface InvokeStructuredTaskParams<T> {
  task: AiTaskType;
  messages: ChatCompletionMessageParam[];
  schema: z.ZodSchema<T>;
  temperature?: number;
  maxTokens?: number;
  primaryModelOverride?: string;
  fallbackModelOverride?: string;
}

export interface StructuredTaskResult<T> {
  data: T;
  modelUsed: string;
  fallbackUsed: boolean;
}

interface ModelCandidate {
  provider: 'groq' | 'custom';
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

function getGroqClient(): Groq {
  const { groqApiKey } = getEnvConfig();
  if (!groqApiKey.trim()) {
    throw AppError.internal(
      'GROQ_API_KEY belum dikonfigurasi. Silakan daftar gratis di https://console.groq.com dan tambahkan API key ke file .env.local',
      'MISSING_GROQ_API_KEY'
    );
  }
  return new Groq({ apiKey: groqApiKey.trim(), maxRetries: 0 });
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

function extractHttpStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }
  if (isRecord(error) && typeof error.status === 'number') {
    return error.status;
  }
  return null;
}

function shouldFallbackToNextCandidate(error: unknown): boolean {
  const status = extractHttpStatus(error);
  if (status === 404 || status === 429 || status === 503) {
    return true;
  }

  if (isRecord(error) && typeof error.message === 'string') {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('404') ||
      msg.includes('429') ||
      msg.includes('503') ||
      msg.includes('rate_limit_exceeded') ||
      msg.includes('model_not_found') ||
      msg.includes('model_decommissioned') ||
      msg.includes('does not exist') ||
      msg.includes('service_unavailable') ||
      msg.includes('overloaded')
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

const SAFE_FAST_FALLBACK_MODELS = ['qwen/qwen3.8-27b', 'openai/gpt-oss-20b'] as const;
const SAFE_VISION_FALLBACK_MODEL = 'qwen/qwen3.8-27b';

function resolveModelCandidates(
  task: AiTaskType,
  primaryModelOverride?: string,
  fallbackModelOverride?: string
): ModelCandidate[] {
  const env = getEnvConfig();
  const candidates: ModelCandidate[] = [];
  const seenGroqModels = new Set<string>();

  const pushGroqCandidate = (rawModel: string | undefined): void => {
    const model = rawModel?.trim();
    if (!model || seenGroqModels.has(model)) return;
    seenGroqModels.add(model);
    candidates.push({ provider: 'groq', model });
  };

  if (primaryModelOverride) {
    pushGroqCandidate(primaryModelOverride);
    pushGroqCandidate(fallbackModelOverride);
    return candidates;
  }

  switch (task) {
    case 'extract':
      pushGroqCandidate(env.groqModelFast);
      pushGroqCandidate(fallbackModelOverride);
      for (const fallbackModel of SAFE_FAST_FALLBACK_MODELS) {
        pushGroqCandidate(fallbackModel);
      }
      pushGroqCandidate(env.groqModelReasoning);
      break;

    case 'reason':
    case 'audit':
      if (env.aiCustomBaseUrl && env.aiCustomModel) {
        candidates.push({
          provider: 'custom',
          model: env.aiCustomModel,
          baseUrl: env.aiCustomBaseUrl,
          apiKey: env.aiCustomApiKey,
        });
      }
      pushGroqCandidate(env.groqModelReasoning);
      pushGroqCandidate(env.groqModelFast);
      for (const fallbackModel of SAFE_FAST_FALLBACK_MODELS) {
        pushGroqCandidate(fallbackModel);
      }
      break;

    case 'vision':
      pushGroqCandidate(env.groqModelVision);
      pushGroqCandidate(fallbackModelOverride);
      pushGroqCandidate(SAFE_VISION_FALLBACK_MODEL);
      break;
  }

  return candidates;
}

function buildCustomCompletionEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

async function callCandidate(
  candidate: ModelCandidate,
  messages: ChatCompletionMessageParam[],
  temperature: number,
  maxTokens: number,
  useJsonMode: boolean = true
): Promise<string> {
  if (candidate.provider === 'custom' && candidate.baseUrl) {
    const endpoint = buildCustomCompletionEndpoint(candidate.baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (candidate.apiKey) {
      headers.Authorization = `Bearer ${candidate.apiKey}`;
    }

    const response = await axios.post<OpenAiChatCompletionResponse>(
      endpoint,
      {
        model: candidate.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
      },
      {
        headers,
        timeout: APP_CONFIG.timeouts.externalApiMs * 3,
      }
    );

    return response.data?.choices?.[0]?.message?.content || '';
  }

  const groq = getGroqClient();
  const result = await groq.chat.completions.create({
    model: candidate.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
  });

  return result.choices[0]?.message?.content || '';
}

function extractRateLimitWaitMs(error: unknown): number | null {
  const status = extractHttpStatus(error);
  if (status !== 429) return null;

  if (isRecord(error) && typeof error.message === 'string') {
    const msg = error.message;
    if (/tokens per day|\(tpd\)/i.test(msg)) {
      return null;
    }

    const minSecMatch = msg.match(/try again in\s+(\d+)m(\d+(?:\.\d+)?)s/i);
    if (minSecMatch) {
      return Math.ceil(Number(minSecMatch[1]) * 60_000 + Number(minSecMatch[2]) * 1000);
    }

    const msMatch = msg.match(/try again in\s+(\d+(?:\.\d+)?)ms/i);
    if (msMatch) {
      return Math.ceil(Number(msMatch[1]));
    }

    const secMatch = msg.match(/try again in\s+(\d+(?:\.\d+)?)s/i);
    if (secMatch) {
      return Math.ceil(Number(secMatch[1]) * 1000);
    }
  }

  return 2500;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendCompletionWithFallback(
  candidates: ModelCandidate[],
  messages: ChatCompletionMessageParam[],
  temperature: number,
  maxTokens: number,
  useJsonMode: boolean = true
): Promise<{ rawText: string; modelUsed: string; fallbackUsed: boolean }> {
  let lastError: unknown;
  let rateLimitWaitMs: number | null = null;

  const tryAllCandidates = async (): Promise<{
    rawText: string;
    modelUsed: string;
    fallbackUsed: boolean;
  } | null> => {
    for (let index = 0; index < candidates.length; index++) {
      const candidate = candidates[index];
      try {
        const rawText = await callCandidate(
          candidate,
          messages,
          temperature,
          maxTokens,
          useJsonMode
        );
        return {
          rawText,
          modelUsed:
            candidate.provider === 'custom'
              ? `custom:${candidate.model}`
              : candidate.model,
          fallbackUsed: index > 0,
        };
      } catch (error: unknown) {
        lastError = error;
        const waitMs = extractRateLimitWaitMs(error);
        if (waitMs !== null) {
          rateLimitWaitMs =
            rateLimitWaitMs === null ? waitMs : Math.min(rateLimitWaitMs, waitMs);
        }
        const hasNextCandidate = index < candidates.length - 1;
        if (hasNextCandidate && shouldFallbackToNextCandidate(error)) {
          continue;
        }
        throw error;
      }
    }
    return null;
  };

  for (let cooldownAttempt = 0; cooldownAttempt < 3; cooldownAttempt++) {
    rateLimitWaitMs = null;
    try {
      const attemptResult = await tryAllCandidates();
      if (attemptResult) return attemptResult;
    } catch (error: unknown) {
      lastError = error;
      const waitMs = extractRateLimitWaitMs(error);
      if (waitMs !== null) {
        rateLimitWaitMs =
          rateLimitWaitMs === null ? waitMs : Math.min(rateLimitWaitMs, waitMs);
      }
      if (cooldownAttempt === 2 || rateLimitWaitMs === null || rateLimitWaitMs > 40_000) {
        throw error;
      }
    }

    if (cooldownAttempt === 2 || rateLimitWaitMs === null || rateLimitWaitMs > 40_000) {
      break;
    }

    await sleepMs(Math.max(1200, rateLimitWaitMs + 1000));
  }

  throw lastError;
}

/**
 * Invokes a task-routed LLM completion with automatic model fallback on 404/429/503,
 * Zod schema validation, and a single self-correction retry on malformed output.
 */
export async function invokeStructuredTask<T>(
  params: InvokeStructuredTaskParams<T>
): Promise<StructuredTaskResult<T>> {
  const temperature = params.temperature ?? APP_CONFIG.ai.temperature;
  const maxTokens = params.maxTokens ?? APP_CONFIG.ai.maxTokens;
  const candidates = resolveModelCandidates(
    params.task,
    params.primaryModelOverride,
    params.fallbackModelOverride
  );

  let firstRawText = '';
  let firstError = '';
  let activeModelUsed = candidates[0]?.model ?? APP_CONFIG.ai.fastModel;
  let fallbackUsed = false;
  let hadProviderJsonError = false;

  try {
    const firstCompletion = await sendCompletionWithFallback(
      candidates,
      params.messages,
      temperature,
      maxTokens,
      true
    );
    firstRawText = firstCompletion.rawText;
    activeModelUsed = firstCompletion.modelUsed;
    fallbackUsed = firstCompletion.fallbackUsed;

    const firstResult = parseAndValidate(firstRawText, params.schema);
    if (firstResult.ok) {
      return {
        data: firstResult.data,
        modelUsed: activeModelUsed,
        fallbackUsed,
      };
    }
    firstError = firstResult.error;
  } catch (error: unknown) {
    if (!isJsonValidationError(error)) {
      throw error;
    }
    hadProviderJsonError = true;
    firstError = 'Provider menolak JSON output (json_validate_failed).';
  }

  const retryMessages: ChatCompletionMessageParam[] = [
    ...params.messages,
    ...(firstRawText ? [{ role: 'assistant' as const, content: firstRawText }] : []),
    {
      role: 'user',
      content: `Respons JSON sebelumnya gagal validasi: ${firstError}. Perbaiki formatnya dan kembalikan HANYA objek JSON valid yang sesuai persis dengan schema yang diminta.`,
    },
  ];

  const retryMaxTokens = hadProviderJsonError ? Math.max(maxTokens, 2400) : maxTokens;
  const retryUseJsonMode = !hadProviderJsonError;

  let retryRawText = '';
  try {
    const retryCompletion = await sendCompletionWithFallback(
      candidates,
      retryMessages,
      temperature,
      retryMaxTokens,
      retryUseJsonMode
    );
    retryRawText = retryCompletion.rawText;
    activeModelUsed = retryCompletion.modelUsed;
    fallbackUsed = fallbackUsed || retryCompletion.fallbackUsed;
  } catch (error: unknown) {
    if (isJsonValidationError(error)) {
      throw AppError.badGateway(
        'Gagal memvalidasi output AI terhadap schema setelah 1x retry: json_validate_failed.',
        'LLM_SCHEMA_VALIDATION_FAILED'
      );
    }
    throw error;
  }

  const retryResult = parseAndValidate(retryRawText, params.schema);
  if (retryResult.ok) {
    return {
      data: retryResult.data,
      modelUsed: activeModelUsed,
      fallbackUsed,
    };
  }

  throw AppError.badGateway(
    `Output AI tidak sesuai schema setelah 1x retry: ${retryResult.error}`,
    'LLM_SCHEMA_VALIDATION_FAILED'
  );
}
