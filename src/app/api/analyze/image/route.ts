import { NextRequest } from 'next/server';
import { ALLOWED_IMAGE_MIMES, APP_CONFIG, MAX_IMAGE_SIZE_BYTES } from '@/lib/config';
import { runInvestigation } from '@/lib/services/analyzer';
import { analyzeImage } from '@/lib/services/groq';
import type { AnalyzeImageRequest } from '@/lib/types';
import { AppError, createSuccessResponse, parseJsonBody, toErrorResponse } from '@/lib/utils/errors';
import { isRecord } from '@/lib/utils/sanitize';

export const maxDuration = 60;

function estimateBase64Bytes(base64Input: string): number {
  const base64Data = base64Input.includes(',')
    ? base64Input.slice(base64Input.indexOf(',') + 1)
    : base64Input;
  const normalized = base64Data.replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function parseAnalyzeImageRequest(body: unknown): AnalyzeImageRequest {
  if (
    !isRecord(body) ||
    typeof body.imageBase64 !== 'string' ||
    typeof body.mimeType !== 'string' ||
    !body.imageBase64 ||
    !body.mimeType
  ) {
    throw AppError.badRequest('Gambar tidak valid. Silakan upload ulang.', 'INVALID_IMAGE');
  }

  if (!ALLOWED_IMAGE_MIMES.includes(body.mimeType)) {
    throw AppError.badRequest(
      `Format gambar tidak didukung: ${body.mimeType}. Gunakan PNG, JPEG, atau WebP.`,
      'UNSUPPORTED_IMAGE_FORMAT'
    );
  }

  if (estimateBase64Bytes(body.imageBase64) > MAX_IMAGE_SIZE_BYTES) {
    throw AppError.payloadTooLarge(
      'Ukuran gambar melebihi batas maksimal 5MB.',
      'IMAGE_TOO_LARGE'
    );
  }

  return {
    imageBase64: body.imageBase64,
    mimeType: body.mimeType,
    language: typeof body.language === 'string' ? body.language : 'id',
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await parseJsonBody(request);
    const { imageBase64, mimeType, language = 'id' } = parseAnalyzeImageRequest(rawBody);

    const imageResult = await analyzeImage(imageBase64, mimeType, language);
    if (
      !imageResult.extractedText ||
      imageResult.extractedText.length < APP_CONFIG.limits.minExtractedImageTextLength
    ) {
      throw AppError.unprocessable(
        'Tidak ada teks yang dapat diekstrak dari gambar. Pastikan gambar berisi teks berita yang jelas.',
        'UNEXTRACTABLE_IMAGE_TEXT'
      );
    }

    const articleTitle =
      imageResult.summary ||
      imageResult.extractedText.substring(0, APP_CONFIG.limits.fallbackTitleMaxLength);
    const inputValue = `[Image: ${imageResult.contentType}]${
      imageResult.detectedSource ? ` from ${imageResult.detectedSource}` : ''
    }`;

    const report = await runInvestigation({
      inputType: 'image',
      inputValue,
      articleTitle,
      articleContent: imageResult.extractedText,
      language,
      startTimeMs: startTime,
    });

    return createSuccessResponse(report);
  } catch (err: unknown) {
    return toErrorResponse(err);
  }
}
