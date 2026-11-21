import type { z } from 'zod';
import type {
  AtomicClaimSchema,
  ClaimExtractionOutputSchema,
  CredibilityTierSchema,
  ExtractedClaimItemSchema,
  FinalSynthesisOutputSchema,
  ImageAnalysisOutputSchema,
  ImageAnalyzeInputSchema,
  ImageContentTypeSchema,
  JournalisticSignalsSchema,
  UrlAnalyzeInputSchema,
  VerdictSchema,
} from '@/lib/schemas/analysis';

export type Verdict = z.infer<typeof VerdictSchema>;

export type CredibilityTier = z.infer<typeof CredibilityTierSchema>;

export type AtomicClaim = z.infer<typeof AtomicClaimSchema>;

export type JournalisticSignals = z.infer<typeof JournalisticSignalsSchema>;

export type ExtractedClaimItem = z.infer<typeof ExtractedClaimItemSchema>;

export type ClaimExtractionOutput = z.infer<typeof ClaimExtractionOutputSchema>;

export type FinalSynthesisOutput = z.infer<typeof FinalSynthesisOutputSchema>;

export type ImageContentType = z.infer<typeof ImageContentTypeSchema>;

export type ImageAnalysisResult = z.infer<typeof ImageAnalysisOutputSchema>;

export type AnalyzeUrlRequest = z.infer<typeof UrlAnalyzeInputSchema>;

export type AnalyzeImageRequest = z.infer<typeof ImageAnalyzeInputSchema>;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type SourceStance = 'supports' | 'contradicts' | 'neutral';

export type ClaimImportance = 'high' | 'medium' | 'low';

export interface ArticleData {
  url: string;
  title: string;
  content: string;
  description: string;
  author: string | null;
  publishedDate: string | null;
  siteName: string | null;
  imageUrl: string | null;
  language: string | null;
}

export interface ClaimData {
  claim: string;
  context: string;
  importance: ClaimImportance;
}

export interface FactCheckReview {
  publisher: string;
  url: string;
  title: string;
  rating: string;
  languageCode: string;
  credibilityTier?: CredibilityTier;
  credibilityLabel?: string;
}

export interface FactCheckResult {
  text: string;
  claimant: string | null;
  claimDate: string | null;
  reviews: FactCheckReview[];
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  datePublished: string | null;
}

export interface EvidenceSource {
  title: string;
  url: string;
  siteName: string;
  snippet: string;
  publishedDate: string | null;
  similarityScore: number;
  stance: SourceStance;
  credibilityTier: CredibilityTier;
  credibilityLabel: string;
  credibilityWeight: number;
}

export interface ClaimAssessment {
  claim: string;
  verdict: Verdict;
  confidence: number;
  explanation: string;
  supportingSources: string[];
  contradictingSources: string[];
}

export interface SourceEvaluation {
  scrapedIndex: number;
  similarityScore: number;
  stance: SourceStance;
}

export interface InvestigationReport {
  inputType: 'url' | 'image';
  inputValue: string;
  articleTitle: string;
  articleContent: string;

  verdict: Verdict;
  overallVerdict: Verdict;
  confidenceScore: number;
  credibilityScore: number;
  confidenceLevel: ConfidenceLevel;

  summary: string;
  claims: AtomicClaim[];
  claimAssessments: ClaimAssessment[];
  signals: JournalisticSignals;
  evidenceSources: EvidenceSource[];
  factCheckResults: FactCheckResult[];

  analyzedAt: string;
  analysisTimeMs: number;
  cached: boolean;

  keyFindings: string[];
  redFlags: string[];
  positiveIndicators: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export type AnalysisStep =
  | 'idle'
  | 'extracting'
  | 'analyzing-claims'
  | 'searching'
  | 'fact-checking'
  | 'comparing'
  | 'generating-report'
  | 'complete'
  | 'error';
