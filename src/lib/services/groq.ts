import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { z } from 'zod';
import {
  AuditCritiqueSchema,
  ClaimExtractionOutputSchema,
  FinalSynthesisOutputSchema,
  ImageAnalysisOutputSchema,
} from '@/lib/schemas/analysis';
import {
  invokeStructuredTask,
  type StructuredTaskResult,
} from '@/lib/services/ai-router';
import type {
  AuditCritique,
  ClaimExtractionOutput,
  FinalSynthesisOutput,
  ImageAnalysisResult,
} from '@/lib/types';
import {
  type AuditCritiquePromptInput,
  type FinalSynthesisPromptInput,
  getAuditCritiquePrompt,
  getClaimExtractionPrompt,
  getFinalSynthesisPrompt,
  getImageAnalysisPrompt,
} from '@/lib/utils/prompts';

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

function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || LANGUAGE_NAMES.id;
}

export async function callGroqStructured<T>(
  params: GroqStructuredCallParams,
  schema: z.ZodSchema<T>
): Promise<T> {
  const result = await invokeStructuredTask({
    task: 'reason',
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    schema,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    primaryModelOverride: params.model,
    fallbackModelOverride: params.fallbackModel,
  });
  return result.data;
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

  return invokeStructuredTask({
    task: 'extract',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    schema: ClaimExtractionOutputSchema,
    maxTokens: 700,
  }).then((result) => result.data);
}

export async function synthesizeFinalVerdictWithMeta(
  input: FinalSynthesisPromptInput,
  languageCode: string = 'id'
): Promise<StructuredTaskResult<FinalSynthesisOutput>> {
  const langName = getLanguageName(languageCode);
  const systemPrompt = `You are a senior investigative fact-checker AI. Always respond with a single valid JSON object. Write "summary" and claim "reasoning" in ${langName}. Never invent URLs or facts outside the provided evidence.`;
  const userPrompt = getFinalSynthesisPrompt(input);

  return invokeStructuredTask({
    task: 'reason',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    schema: FinalSynthesisOutputSchema,
    maxTokens: 1000,
  });
}

export async function synthesizeFinalVerdict(
  input: FinalSynthesisPromptInput,
  languageCode: string = 'id'
): Promise<FinalSynthesisOutput> {
  const result = await synthesizeFinalVerdictWithMeta(input, languageCode);
  return result.data;
}

export async function auditSynthesisDraft(
  input: AuditCritiquePromptInput,
  languageCode: string = 'id'
): Promise<StructuredTaskResult<AuditCritique>> {
  const langName = getLanguageName(languageCode);
  const systemPrompt = `You are an adversarial fact-checking auditor AI. Verify strictly whether the draft synthesis is grounded in the supplied fact-checks and reranked evidence. Always respond with a single valid JSON object. Write "auditNote" in ${langName}.`;
  const userPrompt = getAuditCritiquePrompt(input);

  return invokeStructuredTask({
    task: 'audit',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    schema: AuditCritiqueSchema,
    maxTokens: 450,
  });
}

export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  languageCode: string = 'id'
): Promise<ImageAnalysisResult> {
  const prompt = getImageAnalysisPrompt();
  const langName = getLanguageName(languageCode);

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

  const result = await invokeStructuredTask({
    task: 'vision',
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ],
    schema: ImageAnalysisOutputSchema,
  });

  return result.data;
}
