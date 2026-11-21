import { APP_CONFIG } from '@/lib/config';

export function getClaimExtractionPrompt(title: string, content: string): string {
  return `Extract 1-5 verifiable factual claims (exclude opinions and speculation).

TITLE: ${title}
CONTENT: ${content.substring(0, APP_CONFIG.limits.claimPromptContentMaxLength)}

JSON only:
{"claims":[{"claim":"...","context":"...","importance":"high|medium|low"}]}`;
}

export function getImageAnalysisPrompt(): string {
  return `Extract all visible text, classify contentType, detect outlet/source and date if visible (else null), and summarize.

JSON only:
{"extractedText":"...","contentType":"news-screenshot|social-media|poster|meme|other","detectedSource":"...|null","detectedDate":"...|null","summary":"..."}`;
}

export function getInvestigationPrompt(
  articleTitle: string,
  articleContent: string,
  claims: string[],
  factCheckData: string,
  relatedArticles: string
): string {
  return `Investigate article credibility from the evidence. Evaluate source reliability, cross-source consistency, red flags, and positive indicators. Use "BELUM TERVERIFIKASI" if evidence is insufficient. Scores (credibilityScore, confidence, similarityScore) are 0-100.

TITLE: ${articleTitle}
CONTENT: ${articleContent.substring(0, APP_CONFIG.limits.investigationPromptContentMaxLength)}
CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}
FACT-CHECKS:
${factCheckData || 'None.'}
RELATED ARTICLES:
${relatedArticles || 'None.'}

JSON only:
{
  "overallVerdict": "HOAKS|FAKTA|MISLEADING|BELUM TERVERIFIKASI",
  "credibilityScore": 0,
  "confidenceLevel": "high|medium|low",
  "summary": "2-3 paragraphs",
  "claimAssessments": [{"claim":"...","verdict":"HOAKS|FAKTA|MISLEADING|BELUM TERVERIFIKASI","confidence":0,"explanation":"...","supportingSources":["..."],"contradictingSources":["..."]}],
  "keyFindings": ["..."],
  "redFlags": ["..."],
  "positiveIndicators": ["..."],
  "sourceEvaluations": [{"scrapedIndex":1,"similarityScore":0,"stance":"supports|contradicts|neutral"}]
}`;
}

export function getSearchQueryPrompt(claims: string[], articleTitle: string): string {
  return `Generate 3-5 search queries (3-8 words each) using key facts, names, places, and events to verify these claims.

TITLE: ${articleTitle}
CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

JSON only:
{"queries":["..."]}`;
}
