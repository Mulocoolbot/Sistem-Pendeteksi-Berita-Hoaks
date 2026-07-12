// ============================================================
// Type Definitions — Hoax Detection System
// ============================================================

/** Raw article data scraped from a URL */
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

/** A single factual claim extracted from content */
export interface ClaimData {
  claim: string;
  context: string;
  importance: 'high' | 'medium' | 'low';
}

/** Result from Google Fact Check API */
export interface FactCheckResult {
  text: string;
  claimant: string | null;
  claimDate: string | null;
  reviews: FactCheckReview[];
}

export interface FactCheckReview {
  publisher: string;
  url: string;
  title: string;
  rating: string;
  languageCode: string;
}

/** Result from Google Custom Search */
export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
  datePublished: string | null;
}

/** A source article found during investigation */
export interface EvidenceSource {
  title: string;
  url: string;
  siteName: string;
  snippet: string;
  publishedDate: string | null;
  similarityScore: number; // 0-100
  stance: 'supports' | 'contradicts' | 'neutral';
}

/** Credibility assessment for a claim */
export interface ClaimAssessment {
  claim: string;
  verdict: 'HOAKS' | 'FAKTA' | 'MISLEADING' | 'BELUM TERVERIFIKASI';
  confidence: number; // 0-100
  explanation: string;
  supportingSources: string[];
  contradictingSources: string[];
}

/** The final investigation report */
export interface InvestigationReport {
  // Input info
  inputType: 'url' | 'image';
  inputValue: string;
  articleTitle: string;
  articleContent: string;

  // Overall assessment
  overallVerdict: 'HOAKS' | 'FAKTA' | 'MISLEADING' | 'BELUM TERVERIFIKASI';
  credibilityScore: number; // 0-100
  confidenceLevel: 'high' | 'medium' | 'low';

  // Detailed analysis
  summary: string;
  claimAssessments: ClaimAssessment[];
  evidenceSources: EvidenceSource[];
  factCheckResults: FactCheckResult[];

  // Metadata
  analyzedAt: string;
  analysisTimeMs: number;

  // Reasoning
  keyFindings: string[];
  redFlags: string[];
  positiveIndicators: string[];
}

/** API request for URL analysis */
export interface AnalyzeUrlRequest {
  url: string;
}

/** API request for image analysis */
export interface AnalyzeImageRequest {
  imageBase64: string;
  mimeType: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** Analysis progress steps */
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

export interface AnalysisProgress {
  step: AnalysisStep;
  message: string;
  percentage: number;
}

/** Image analysis result from Gemini Vision */
export interface ImageAnalysisResult {
  extractedText: string;
  contentType: 'news-screenshot' | 'social-media' | 'poster' | 'meme' | 'other';
  detectedSource: string | null;
  detectedDate: string | null;
  summary: string;
}
