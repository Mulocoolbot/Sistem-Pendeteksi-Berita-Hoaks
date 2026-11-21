import { APP_CONFIG } from '@/lib/config';

export function getClaimExtractionPrompt(title: string, content: string): string {
  return `Extract 1 to 5 verifiable factual claims from the news article below. Ignore opinions, speculation, and subjective statements.

ARTICLE TITLE: ${title}
ARTICLE CONTENT:
${content.substring(0, APP_CONFIG.limits.claimPromptContentMaxLength)}

Return valid JSON only:
{
  "claims": [
    {
      "claim": "Specific verifiable claim",
      "context": "Brief context from the article",
      "importance": "high|medium|low"
    }
  ]
}`;
}

export function getImageAnalysisPrompt(): string {
  return `Analyze this image for news verification:
1. Extract all visible text (headlines, body, captions, watermarks, dates, authors).
2. Classify contentType as one of: news-screenshot, social-media, poster, meme, other.
3. Identify the media source or outlet if visible, otherwise null.
4. Identify any visible date or timestamp, otherwise null.
5. Provide a brief summary of the image content.

Return valid JSON only:
{
  "extractedText": "All visible text",
  "contentType": "news-screenshot|social-media|poster|meme|other",
  "detectedSource": "Source name or null",
  "detectedDate": "Detected date or null",
  "summary": "Brief summary"
}`;
}

export function getInvestigationPrompt(
  articleTitle: string,
  articleContent: string,
  claims: string[],
  factCheckData: string,
  relatedArticles: string
): string {
  return `Investigate whether the article below is factual or misinformation using the provided evidence. Evaluate source credibility, cross-source consistency, red flags (sensationalism, anonymous sources, factual contradictions, manipulated context), and positive indicators. If evidence is insufficient, use "BELUM TERVERIFIKASI".

TITLE: ${articleTitle}
CONTENT: ${articleContent.substring(0, APP_CONFIG.limits.investigationPromptContentMaxLength)}

KEY CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

EXISTING FACT-CHECKS:
${factCheckData || 'None found.'}

RELATED ARTICLES:
${relatedArticles || 'None found.'}

Return valid JSON only:
{
  "overallVerdict": "HOAKS|FAKTA|MISLEADING|BELUM TERVERIFIKASI",
  "credibilityScore": 0,
  "confidenceLevel": "high|medium|low",
  "summary": "2-3 paragraph investigation summary",
  "claimAssessments": [
    {
      "claim": "Claim text",
      "verdict": "HOAKS|FAKTA|MISLEADING|BELUM TERVERIFIKASI",
      "confidence": 0,
      "explanation": "Assessment rationale",
      "supportingSources": ["Source title or URL"],
      "contradictingSources": ["Source title or URL"]
    }
  ],
  "keyFindings": ["Finding 1"],
  "redFlags": ["Red flag 1"],
  "positiveIndicators": ["Positive indicator 1"],
  "sourceEvaluations": [
    {
      "scrapedIndex": 1,
      "similarityScore": 0,
      "stance": "supports|contradicts|neutral"
    }
  ]
}`;
}

export function getSearchQueryPrompt(claims: string[], articleTitle: string): string {
  return `Generate 3 to 5 concise search queries (3-8 words each) to find corroborating or contradicting news coverage for these claims. Focus on key facts, names, places, and events.

ARTICLE TITLE: ${articleTitle}
CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return valid JSON only:
{
  "queries": ["query 1", "query 2", "query 3"]
}`;
}
