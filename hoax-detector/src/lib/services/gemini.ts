// ============================================================
// Groq AI Service — Content Analysis & Fact-Checking
// Menggunakan Groq (GRATIS, tanpa kartu kredit)
// ============================================================

import Groq from 'groq-sdk';
import type { ClaimData, ImageAnalysisResult } from '@/lib/types';
import {
  getClaimExtractionPrompt,
  getImageAnalysisPrompt,
  getInvestigationPrompt,
  getSearchQueryPrompt,
} from '@/lib/utils/prompts';
import { safeJsonParse } from '@/lib/utils/sanitize';

// Model untuk teks biasa (cepat & gratis)
const TEXT_MODEL = 'llama-3.3-70b-versatile';
// Model untuk vision/image (mendukung gambar)
const VISION_MODEL = 'llama-3.2-90b-vision-preview';

function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY belum dikonfigurasi. Silakan daftar gratis di https://console.groq.com dan tambahkan API key ke file .env.local'
    );
  }
  return new Groq({ apiKey });
}

/**
 * Sends a text-only chat completion to Groq.
 */
async function chatCompletion(prompt: string): Promise<string> {
  const groq = getGroqClient();
  const result = await groq.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a professional fact-checker and investigative journalist AI. Always respond in valid JSON format when asked.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  });

  return result.choices[0]?.message?.content || '';
}

/**
 * Extracts key claims from an article.
 */
export async function extractClaims(
  title: string,
  content: string
): Promise<ClaimData[]> {
  const prompt = getClaimExtractionPrompt(title, content);
  const text = await chatCompletion(prompt);

  const parsed = safeJsonParse<{ claims: ClaimData[] }>(text);
  if (!parsed || !parsed.claims) {
    console.error('Failed to parse claim extraction response:', text);
    return [
      {
        claim: title,
        context: 'Main headline/title of the article',
        importance: 'high' as const,
      },
    ];
  }

  return parsed.claims;
}

/**
 * Analyzes an image using Groq Vision for OCR and element detection.
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType: string
): Promise<ImageAnalysisResult> {
  const groq = getGroqClient();
  const prompt = getImageAnalysisPrompt();

  const result = await groq.chat.completions.create({
    model: VISION_MODEL,
    messages: [
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
    temperature: 0.3,
    max_tokens: 4096,
  });

  const text = result.choices[0]?.message?.content || '';
  const parsed = safeJsonParse<ImageAnalysisResult>(text);

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

  return parsed;
}

/**
 * Generates search queries from claims for finding related articles.
 */
export async function generateSearchQueries(
  claims: ClaimData[],
  articleTitle: string
): Promise<string[]> {
  const claimTexts = claims.map(c => c.claim);
  const prompt = getSearchQueryPrompt(claimTexts, articleTitle);
  const text = await chatCompletion(prompt);

  const parsed = safeJsonParse<{ queries: string[] }>(text);
  if (!parsed || !parsed.queries) {
    return [articleTitle, claimTexts[0] || articleTitle].filter(Boolean);
  }

  return parsed.queries;
}

/**
 * Performs the final credibility investigation using all collected evidence.
 */
export async function investigateCredibility(
  articleTitle: string,
  articleContent: string,
  claims: ClaimData[],
  factCheckData: string,
  relatedArticles: string
): Promise<Record<string, unknown>> {
  const claimTexts = claims.map(c => c.claim);
  const prompt = getInvestigationPrompt(
    articleTitle,
    articleContent,
    claimTexts,
    factCheckData,
    relatedArticles
  );

  const text = await chatCompletion(prompt);

  const parsed = safeJsonParse<Record<string, unknown>>(text);
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
      evidenceSources: [],
    };
  }

  return parsed;
}
