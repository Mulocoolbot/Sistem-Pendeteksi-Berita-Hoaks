import { z } from 'zod';

export const VerdictSchema = z.enum(['VERIFIED', 'MISLEADING', 'HOAX', 'UNVERIFIED']);

export const CredibilityTierSchema = z.enum(['TIER_1', 'TIER_2', 'TIER_3']);

export const AtomicClaimSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  searchQuery: z.string().min(1),
  status: VerdictSchema,
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1),
  supportingUrls: z.array(z.string()),
});

export const JournalisticSignalsSchema = z.object({
  clickbait: z.object({
    detected: z.boolean(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    reason: z.string(),
  }),
  temporalContext: z.object({
    status: z.enum(['CURRENT', 'OUTDATED_RECYCLED', 'UNDATED', 'UNCLEAR']),
    publishedDate: z.string().nullable(),
    reason: z.string(),
  }),
  sourceAttribution: z.object({
    clarity: z.enum(['CLEAR', 'PARTIAL', 'ANONYMOUS_OR_MISSING']),
    reason: z.string(),
  }),
});

export const ExtractedClaimItemSchema = z.object({
  statement: z.string().min(1),
  searchQuery: z.string().min(1),
});

export const ClaimExtractionOutputSchema = z.object({
  headline: z.string().min(1),
  language: z.enum(['id', 'en']),
  claims: z.array(ExtractedClaimItemSchema).min(1).max(5),
  signals: JournalisticSignalsSchema,
});

export const FinalSynthesisOutputSchema = z.object({
  verdict: VerdictSchema,
  confidenceScore: z.number().min(0).max(100),
  summary: z.string().min(1),
  claimResults: z.array(AtomicClaimSchema).min(1),
});

export const ImageContentTypeSchema = z.enum([
  'news-screenshot',
  'social-media',
  'poster',
  'meme',
  'other',
]);

export const ImageAnalysisOutputSchema = z.object({
  extractedText: z.string(),
  contentType: ImageContentTypeSchema,
  detectedSource: z.string().nullable(),
  detectedDate: z.string().nullable(),
  summary: z.string(),
});

export const UrlAnalyzeInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL tidak boleh kosong.')
    .refine((val) => {
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL harus dimulai dengan http:// atau https://'),
  language: z.string().trim().min(2).optional().default('id'),
});

export const ImageAnalyzeInputSchema = z.object({
  imageBase64: z.string().min(1, 'Data gambar tidak boleh kosong.'),
  mimeType: z.string().min(1, 'Tipe MIME gambar wajib diisi.'),
  language: z.string().trim().min(2).optional().default('id'),
});
