// ============================================================
// AI Prompt Templates — Hoax Detection System
// ============================================================

/**
 * Prompt for extracting key claims from a news article.
 */
export function getClaimExtractionPrompt(title: string, content: string): string {
  return `You are a professional fact-checker and investigative journalist. Analyze the following news article and extract the key factual claims that can be verified.

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${content.substring(0, 4000)}

INSTRUCTIONS:
1. Identify all verifiable factual claims in this article
2. Focus on claims that are specific, measurable, and checkable
3. Ignore opinions, speculation, and subjective statements
4. Rate each claim's importance (high/medium/low)

Respond in valid JSON format ONLY with this structure:
{
  "claims": [
    {
      "claim": "The specific factual claim",
      "context": "Brief context of where this claim appears",
      "importance": "high|medium|low"
    }
  ]
}

Extract between 1 to 5 of the most important claims. Respond ONLY with the JSON, no other text.`;
}

/**
 * Prompt for analyzing an image (OCR + element detection).
 */
export function getImageAnalysisPrompt(): string {
  return `You are an expert digital forensics analyst specializing in news verification and image analysis.

Analyze this image thoroughly and provide:

1. **Text Extraction (OCR)**: Extract ALL text visible in the image, preserving the structure (headlines, body text, captions, watermarks, dates, author names).

2. **Content Type Classification**: Is this a:
   - news-screenshot (screenshot from a news website/app)
   - social-media (screenshot from social media like Twitter/X, Facebook, Instagram, WhatsApp)
   - poster (propaganda poster, infographic)
   - meme (edited/satirical image)
   - other

3. **Source Detection**: Can you identify the news source/media outlet from logos, watermarks, URL bars, or styling?

4. **Date Detection**: Is there any visible date or timestamp?

5. **Summary**: A brief summary of what this image is about.

Respond in valid JSON format ONLY:
{
  "extractedText": "All text found in the image",
  "contentType": "news-screenshot|social-media|poster|meme|other",
  "detectedSource": "Name of the source/media or null",
  "detectedDate": "Detected date string or null",
  "summary": "Brief description of the image content"
}

Respond ONLY with the JSON, no other text.`;
}

/**
 * Prompt for the final credibility investigation.
 */
export function getInvestigationPrompt(
  articleTitle: string,
  articleContent: string,
  claims: string[],
  factCheckData: string,
  relatedArticles: string
): string {
  return `You are a world-class fact-checker and investigative journalist AI. You have been given a news article and must investigate whether it is HOAX (fake news) or FACTUAL.

═══════════════════════════════════
ORIGINAL ARTICLE
═══════════════════════════════════
TITLE: ${articleTitle}
CONTENT: ${articleContent.substring(0, 3000)}

═══════════════════════════════════
KEY CLAIMS TO VERIFY
═══════════════════════════════════
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

═══════════════════════════════════
EXISTING FACT-CHECK RESULTS
═══════════════════════════════════
${factCheckData || 'No existing fact-checks found for these claims.'}

═══════════════════════════════════
RELATED ARTICLES FROM OTHER SOURCES
═══════════════════════════════════
${relatedArticles || 'No related articles found.'}

═══════════════════════════════════
YOUR INVESTIGATION
═══════════════════════════════════

Analyze all the evidence above and provide your investigation report. Consider:

1. **Consistency Check**: Do other reputable sources report the same facts?
2. **Source Credibility**: Is the original source a known/reputable news outlet?
3. **Claim Verification**: Can each claim be corroborated by multiple independent sources?
4. **Red Flags**: Look for signs of misinformation:
   - Sensationalist language
   - Missing or anonymous sources
   - Contradictions with established facts
   - Manipulated dates or context
   - Emotional manipulation tactics
5. **Positive Indicators**: Signs of credible reporting:
   - Named, verifiable sources
   - Consistent with other credible reports
   - Professional journalistic standards
   - Traceable facts and data

Respond in valid JSON format ONLY:
{
  "overallVerdict": "HOAKS|FAKTA|MISLEADING|BELUM TERVERIFIKASI",
  "credibilityScore": 0-100,
  "confidenceLevel": "high|medium|low",
  "summary": "A comprehensive 2-3 paragraph summary of your investigation findings",
  "claimAssessments": [
    {
      "claim": "The claim text",
      "verdict": "HOAKS|FAKTA|MISLEADING|BELUM TERVERIFIKASI",
      "confidence": 0-100,
      "explanation": "Detailed explanation of why this verdict",
      "supportingSources": ["source1 title or URL"],
      "contradictingSources": ["source1 title or URL"]
    }
  ],
  "keyFindings": ["Key finding 1", "Key finding 2"],
  "redFlags": ["Red flag 1 if any"],
  "positiveIndicators": ["Positive indicator 1 if any"],
  "sourceEvaluations": [
    {
      "scrapedIndex": 1,
      "similarityScore": 0-100,
      "stance": "supports|contradicts|neutral"
    }
  ]
}

Be thorough, objective, and balanced. If you cannot determine the truth, say "BELUM TERVERIFIKASI" rather than guessing. Respond ONLY with the JSON, no other text.`;
}

/**
 * Generates optimized search queries from claims for Google Custom Search.
 */
export function getSearchQueryPrompt(claims: string[], articleTitle: string): string {
  return `Given these claims from a news article, generate 3-5 optimized search queries to find related news articles that can help verify or debunk these claims.

ARTICLE TITLE: ${articleTitle}

CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Generate search queries that:
- Are concise (3-8 words each)
- Focus on the key facts, names, places, and events
- Include at least one query with the article's main topic
- Use different angles to find both supporting and contradicting evidence

Respond in valid JSON format ONLY:
{
  "queries": ["query 1", "query 2", "query 3"]
}

Respond ONLY with the JSON, no other text.`;
}
