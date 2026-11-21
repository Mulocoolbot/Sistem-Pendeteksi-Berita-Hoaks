import axios from 'axios';
import { APP_CONFIG, getEnvConfig } from '@/lib/config';
import type { EvidenceItem, RerankerMethod } from '@/lib/types';

export type { EvidenceItem };

export interface RerankResult<T extends EvidenceItem = EvidenceItem> {
  items: T[];
  method: RerankerMethod;
}

interface JinaRerankResultEntry {
  index?: number;
  relevance_score?: number;
  score?: number;
}

interface JinaRerankApiResponse {
  results?: JinaRerankResultEntry[];
  data?: JinaRerankResultEntry[];
}

const STOPWORDS = new Set<string>([
  'yang',
  'dan',
  'di',
  'ke',
  'dari',
  'untuk',
  'pada',
  'dengan',
  'atau',
  'ini',
  'itu',
  'ada',
  'adalah',
  'akan',
  'juga',
  'tidak',
  'bukan',
  'dalam',
  'oleh',
  'sebagai',
  'karena',
  'bahwa',
  'telah',
  'sudah',
  'bisa',
  'dapat',
  'saat',
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'over',
  'under',
  'about',
  'are',
  'was',
  'were',
  'been',
  'have',
  'has',
  'had',
  'not',
  'but',
  'you',
  'your',
  'their',
  'they',
]);

function tokenize(text: string): string[] {
  const rawTokens = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);

  const filtered = rawTokens.filter((token) => token.length > 2 && !STOPWORDS.has(token));
  return filtered.length > 0 ? filtered : rawTokens;
}

function rerankLocally<T extends EvidenceItem>(
  query: string,
  items: T[],
  topK: number
): T[] {
  const queryTokens = tokenize(query);
  const uniqueQueryTokens = Array.from(new Set(queryTokens));

  if (uniqueQueryTokens.length === 0) {
    return items.slice(0, topK);
  }

  const docTokensList = items.map((item) => tokenize(`${item.title} ${item.snippet}`));
  const docCount = items.length;
  const avgDocLength =
    docTokensList.reduce((sum, tokens) => sum + tokens.length, 0) / Math.max(1, docCount);

  const docFreq = new Map<string, number>();
  for (const token of uniqueQueryTokens) {
    let count = 0;
    for (const docTokens of docTokensList) {
      if (docTokens.includes(token)) {
        count++;
      }
    }
    docFreq.set(token, count);
  }

  const k1 = 1.2;
  const b = 0.75;

  const scored = items.map((item, index) => {
    const docTokens = docTokensList[index];
    const docLength = Math.max(1, docTokens.length);
    const termCounts = new Map<string, number>();
    for (const token of docTokens) {
      termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
    }

    let bm25 = 0;
    let overlapCount = 0;
    for (const token of uniqueQueryTokens) {
      const tf = termCounts.get(token) ?? 0;
      if (tf === 0) continue;
      overlapCount++;
      const df = docFreq.get(token) ?? 0;
      const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5));
      const denom = tf + k1 * (1 - b + b * (docLength / Math.max(1, avgDocLength)));
      bm25 += idf * ((tf * (k1 + 1)) / denom);
    }

    const overlapRatio = overlapCount / uniqueQueryTokens.length;
    const combinedScore = bm25 + overlapRatio * 2 + item.credibilityWeight * 0.15;
    const computedSimilarity =
      overlapCount > 0
        ? Math.max(20, Math.min(95, Math.round(overlapRatio * 65 + Math.min(30, bm25 * 10))))
        : item.similarityScore > 0
          ? item.similarityScore
          : 15;

    return {
      item: {
        ...item,
        similarityScore: computedSimilarity,
      },
      score: combinedScore,
      originalIndex: index,
    };
  });

  scored.sort((a, bItem) => {
    if (bItem.score !== a.score) {
      return bItem.score - a.score;
    }
    return a.originalIndex - bItem.originalIndex;
  });

  return scored.slice(0, topK).map((entry) => entry.item);
}

/**
 * Semantically reranks evidence items via Jina Reranker v2 and gracefully falls back
 * to a local BM25 + token-overlap reranker when the API key is absent or Jina fails.
 */
export async function rerankEvidence<T extends EvidenceItem = EvidenceItem>(
  query: string,
  items: T[],
  topK: number = APP_CONFIG.limits.rerankTopK
): Promise<RerankResult<T>> {
  const limit = Math.max(1, topK);

  if (items.length === 0) {
    return { items: [], method: 'local' };
  }

  const trimmedQuery = query.trim();
  const jinaApiKey = getEnvConfig().jinaApiKey.trim();

  if (jinaApiKey && items.length > 1 && trimmedQuery.length > 0) {
    try {
      const response = await axios.post<JinaRerankApiResponse>(
        APP_CONFIG.endpoints.jinaRerank,
        {
          model: 'jina-reranker-v2-base-multilingual',
          query: trimmedQuery,
          documents: items.map((item) => `${item.title} ${item.snippet}`.trim()),
          top_n: Math.min(limit, items.length),
        },
        {
          headers: {
            Authorization: `Bearer ${jinaApiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: APP_CONFIG.timeouts.externalApiMs,
        }
      );

      const rawResults = Array.isArray(response.data?.results)
        ? response.data.results
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];

      const seenIndices = new Set<number>();
      const reranked: T[] = [];

      for (const entry of rawResults) {
        if (
          typeof entry.index !== 'number' ||
          !Number.isInteger(entry.index) ||
          entry.index < 0 ||
          entry.index >= items.length ||
          seenIndices.has(entry.index)
        ) {
          continue;
        }
        seenIndices.add(entry.index);
        const rawScore =
          typeof entry.relevance_score === 'number'
            ? entry.relevance_score
            : typeof entry.score === 'number'
              ? entry.score
              : 0.5;
        const normalizedSimilarity = Math.max(15, Math.min(99, Math.round(rawScore * 100)));
        reranked.push({
          ...items[entry.index],
          similarityScore: normalizedSimilarity,
        });
      }

      if (reranked.length > 0) {
        return {
          items: reranked.slice(0, limit),
          method: 'jina',
        };
      }
    } catch (error: unknown) {
      console.warn('Jina reranker unavailable, falling back to local reranker:', error);
    }
  }

  return {
    items: rerankLocally(trimmedQuery, items, limit),
    method: 'local',
  };
}
