import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }

  static badRequest(message: string, code: string = 'BAD_REQUEST'): AppError {
    return new AppError(message, 400, code);
  }

  static payloadTooLarge(message: string, code: string = 'PAYLOAD_TOO_LARGE'): AppError {
    return new AppError(message, 413, code);
  }

  static unprocessable(message: string, code: string = 'UNPROCESSABLE_ENTITY'): AppError {
    return new AppError(message, 422, code);
  }

  static internal(message: string, code: string = 'INTERNAL_ERROR'): AppError {
    return new AppError(message, 500, code);
  }
}

export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      throw AppError.badRequest('Format JSON tidak valid.', 'INVALID_JSON');
    }
    throw AppError.badRequest('Body request tidak dapat dibaca.', 'INVALID_REQUEST_BODY');
  }
}

export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status });
}

export function createErrorResponse(
  error: unknown,
  fallbackMessage: string = 'Terjadi kesalahan yang tidak terduga.'
): NextResponse<ApiResponse<null>> {
  if (error instanceof AppError) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error('Unhandled API error:', error);
  const message = error instanceof Error ? error.message : fallbackMessage;

  return NextResponse.json<ApiResponse<null>>(
    { success: false, error: message, code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
