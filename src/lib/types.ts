export type Verdict = 'HOAKS' | 'FAKTA' | 'MISLEADING' | 'BELUM TERVERIFIKASI';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type SourceStance = 'supports' | 'contradicts' | 'neutral';

export type ClaimImportance = 'high' | 'medium' | 'low';

export type ImageContentType =
  | 'news-screenshot'
  | 'social-media'
  | 'poster'
  | 'meme'
  | 'other';

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

export interface InvestigationAIResult {
  overallVerdict: Verdict;
  credibilityScore: number;
  confidenceLevel: ConfidenceLevel;
  summary: string;
  claimAssessments: ClaimAssessment[];
  keyFindings: string[];
  redFlags: string[];
  positiveIndicators: string[];
  sourceEvaluations: SourceEvaluation[];
}

export interface InvestigationReport {
  inputType: 'url' | 'image';
  inputValue: string;
  articleTitle: string;
  articleContent: string;

  overallVerdict: Verdict;
  credibilityScore: number;
  confidenceLevel: ConfidenceLevel;

  summary: string;
  claimAssessments: ClaimAssessment[];
  evidenceSources: EvidenceSource[];
  factCheckResults: FactCheckResult[];

  analyzedAt: string;
  analysisTimeMs: number;

  keyFindings: string[];
  redFlags: string[];
  positiveIndicators: string[];
}

export interface AnalyzeUrlRequest {
  url: string;
  language?: string;
}

export interface AnalyzeImageRequest {
  imageBase64: string;
  mimeType: string;
  language?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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

export interface ImageAnalysisResult {
  extractedText: string;
  contentType: ImageContentType;
  detectedSource: string | null;
  detectedDate: string | null;
  summary: string;
}
