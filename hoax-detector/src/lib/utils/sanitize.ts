// ============================================================
// Sanitization & Utility Functions
// ============================================================

/**
 * Validates if a string is a valid URL.
 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Cleans HTML content, removing tags and normalizing whitespace.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncates text to a maximum length, adding ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extracts the domain from a URL.
 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Safely parses JSON, returning null on failure.
 */
export function safeJsonParse<T>(text: string): T | null {
  try {
    // Try to find JSON in the text (sometimes LLMs add extra text around JSON)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Creates a delay promise.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formats a date string to a readable format.
 */
export function formatDate(dateStr: string | null, language: string = 'id'): string {
  if (!dateStr) return language === 'id' ? 'Tanggal tidak diketahui' : 'Unknown date';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const locale = 
      language === 'id' ? 'id-ID' :
      language === 'en' ? 'en-US' :
      language === 'zh' ? 'zh-CN' :
      language === 'ja' ? 'ja-JP' :
      language === 'es' ? 'es-ES' :
      language === 'hi' ? 'hi-IN' :
      language === 'fr' ? 'fr-FR' :
      language === 'pt' ? 'pt-PT' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Returns a color based on credibility score.
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return 'var(--accent-green)';
  if (score >= 40) return 'var(--accent-amber)';
  return 'var(--accent-red)';
}

/**
 * Returns a verdict badge configuration.
 */
export function getVerdictConfig(verdict: string): {
  label: string;
  color: string;
  gradient: string;
  icon: string;
} {
  switch (verdict) {
    case 'FAKTA':
      return {
        label: '✅ FAKTA',
        color: 'var(--accent-green)',
        gradient: 'var(--gradient-fact)',
        icon: '✅',
      };
    case 'HOAKS':
      return {
        label: '❌ HOAKS',
        color: 'var(--accent-red)',
        gradient: 'var(--gradient-hoax)',
        icon: '❌',
      };
    case 'MISLEADING':
      return {
        label: '⚠️ MENYESATKAN',
        color: 'var(--accent-orange)',
        gradient: 'var(--gradient-unknown)',
        icon: '⚠️',
      };
    default:
      return {
        label: '🔍 BELUM TERVERIFIKASI',
        color: 'var(--accent-amber)',
        gradient: 'var(--gradient-unknown)',
        icon: '🔍',
      };
  }
}

/**
 * Converts file to base64.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
