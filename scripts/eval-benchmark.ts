import type { ApiResponse, InvestigationReport, Verdict } from '../src/lib/types';

interface BenchmarkCase {
  id: string;
  label: string;
  url: string;
  language: 'id' | 'en';
  expectedVerdict: Verdict;
  rationale: string;
}

interface CaseOutcome {
  testCase: BenchmarkCase;
  actualVerdict: Verdict | 'ERROR';
  confidenceScore: number | null;
  matched: boolean;
  durationMs: number;
  modelUsed: string;
  rerankerUsed: string;
  selfCritiqueAdjusted: boolean | null;
  auditNote: string;
  errorMessage?: string;
}

const DEFAULT_API_URL = 'http://localhost:3000/api/analyze/url';
const REQUEST_TIMEOUT_MS = 110_000;
const DEFAULT_INTER_CASE_DELAY_MS = 15_000;

const GOLDEN_BENCHMARK_CASES: readonly BenchmarkCase[] = [
  {
    id: 'VERIFIED-01',
    label: 'WHO Global Health Report',
    url: 'https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue',
    language: 'en',
    expectedVerdict: 'VERIFIED',
    rationale: 'Official WHO medical fact sheet supported by primary institutional sources.',
  },
  {
    id: 'VERIFIED-02',
    label: 'BMKG Official Earthquake Info (ANTARA)',
    url: 'https://sumbar.antaranews.com/berita/784807/bmkg-gempa-69-magnitudo-di-china-tak-picu-tsunami-di-indonesia',
    language: 'id',
    expectedVerdict: 'VERIFIED',
    rationale: 'Official BMKG statement reported by Tier-1 wire agency ANTARA News.',
  },
  {
    id: 'HOAX-01',
    label: 'TurnBackHoax Debunked Vaccine Claim (Mafindo)',
    url: 'https://turnbackhoax.id/articles/22687-salah-moderna-mengakui-vaksin-covid-19-menyebabkan-kanker',
    language: 'id',
    expectedVerdict: 'HOAX',
    rationale: 'Documented false vaccine claim debunked by TurnBackHoax (Mafindo).',
  },
  {
    id: 'HOAX-02',
    label: 'Kompas CekFakta Debunked Hoax Video',
    url: 'https://www.kompas.com/cekfakta/read/2025/07/19/164300082/-hoaks-video-jokowi-mengancam-para-ulama?page=all',
    language: 'id',
    expectedVerdict: 'HOAX',
    rationale: 'Manipulated video hoax explicitly debunked by Kompas CekFakta.',
  },
  {
    id: 'MISLEADING-01',
    label: 'Kompas CekFakta Misleading Newspaper Headline Context',
    url: 'https://www.kompas.com/cekfakta/read/2024/07/09/134000082/-klarifikasi-konteks-keliru-soal-tajuk-koran-yang-kritik-jokowi-pada?page=all',
    language: 'id',
    expectedVerdict: 'MISLEADING',
    rationale: 'Newspaper headline photo shared with misleading/wrong context verified by Kompas CekFakta.',
  },
  {
    id: 'MISLEADING-02',
    label: 'Kompas CekFakta Out-of-Context INASAR Video',
    url: 'https://www.kompas.com/cekfakta/read/2023/02/13/193100882/-klarifikasi-konteks-keliru-video-tim-inasar-tiba-di-turkiye',
    language: 'id',
    expectedVerdict: 'MISLEADING',
    rationale: 'Video shared with misleading/wrong context verified by Kompas CekFakta.',
  },
  {
    id: 'UNVERIFIED-01',
    label: 'Fictional Uncorroborated Claim (Atlantis ZQ991)',
    url: 'https://httpbin.org/base64/PGh0bWw-PGhlYWQ-PHRpdGxlPktsYWltIEZpa3RpZiBLb3RhIEF0bGFudGlzIFpROTkxIGRpIERhbmF1IFRvYmEgMjA5OTwvdGl0bGU-PC9oZWFkPjxib2R5PjxhcnRpY2xlPjxwPkVrc3BlZGlzaSBmaWt0aWYgWHlsb0Nocm9ub3MtOTkxODI3IG1lbmdrbGFpbSBtZW5lbXVrYW4ga3ViYWgga3Jpc3RhbCBBdGxhbnRpcyBaUTk5MSBiZXJ1c2lhIDgwMDAwIHRhaHVuIGRlbmdhbiByZWFrdG9yIGt1YW50dW0gZGkgZGFzYXIgRGFuYXUgVG9iYSBwYWRhIDMwIEZlYnJ1YXJpIDIwOTkuIE1lbnVydXQgUHJvZmVzb3IgWm9yZ29uIFZleGxhci03NzQxLCBrdWJhaCBtZW1hbmNhcmthbiBzaW55YWwgdGVsZXBhdGkga2Ugc2F0ZWxpdCBOZXB0dW51cy1YOTkuPC9wPjwvYXJ0aWNsZT48L2JvZHk-PC9odG1sPg==',
    language: 'id',
    expectedVerdict: 'UNVERIFIED',
    rationale: 'Fictional entities and impossible claims with zero corroborating evidence.',
  },
  {
    id: 'UNVERIFIED-02',
    label: 'Fictional Uncorroborated Claim (Zephyr-88412)',
    url: 'https://httpbin.org/base64/PGh0bWw-PGhlYWQ-PHRpdGxlPkxhcG9yYW4gRWtzcGVkaXNpIFplcGh5ci04ODQxMiBLb2xvbmkgUGVuZ3VpbiBDeWJlcm5ldGljIEtyYWthdGF1PC90aXRsZT48L2hlYWQ+PGJvZHk+PGFydGljbGU-PHA-TGFwb3JhbiBpbnRlcm5hbCBmaWt0aWYgWmVwaHlyLTg4NDEyIG1lbnllYnV0IDQ1MDAgcGVuZ3VpbiBjeWJlcm5ldGljIGJlcnRlbmFnYSBmdXNpIGRpbmdpbiBtZW1iYW5ndW4gbWVuYXJhIG9ic2lkaWFuIDkwMCBtZXRlciBkaSBrYXdhaCBLcmFrYXRhdSBwYWRhIHRhaHVuIDIwOTguIEtlcGFsYSByaXNldCBLYWVsb3IgVnludHJpeCBtZW5na2xhaW0ga29sb25pIHRlcnNlYnV0IG1lbmdpcmltIGVzIGtlIG9yYml0IEV1cm9wYS48L3A-PC9hcnRpY2xlPjwvYm9keT48L2h0bWw-',
    language: 'id',
    expectedVerdict: 'UNVERIFIED',
    rationale: 'Fictional expedition report with zero corroborating search or fact-check sources.',
  },
];

async function evaluateCase(
  testCase: BenchmarkCase,
  apiUrl: string
): Promise<CaseOutcome> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        url: testCase.url,
        language: testCase.language,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as ApiResponse<InvestigationReport>;
    const durationMs = Date.now() - startedAt;

    if (!response.ok || !payload.success || !payload.data) {
      return {
        testCase,
        actualVerdict: 'ERROR',
        confidenceScore: null,
        matched: false,
        durationMs,
        modelUsed: '-',
        rerankerUsed: '-',
        selfCritiqueAdjusted: null,
        auditNote: '',
        errorMessage: payload.error || `HTTP ${response.status}`,
      };
    }

    const report = payload.data;
    const matched = report.verdict === testCase.expectedVerdict;

    return {
      testCase,
      actualVerdict: report.verdict,
      confidenceScore: report.confidenceScore,
      matched,
      durationMs,
      modelUsed: report.aiAudit?.modelUsed ?? 'unknown',
      rerankerUsed: report.aiAudit?.rerankerUsed ?? 'unknown',
      selfCritiqueAdjusted: report.aiAudit?.selfCritiqueAdjusted ?? null,
      auditNote: report.aiAudit?.auditNote ?? '',
    };
  } catch (error: unknown) {
    const durationMs = Date.now() - startedAt;
    const message =
      error instanceof Error ? error.message : 'Unknown network/fetch failure';
    return {
      testCase,
      actualVerdict: 'ERROR',
      confidenceScore: null,
      matched: false,
      durationMs,
      modelUsed: '-',
      rerankerUsed: '-',
      selfCritiqueAdjusted: null,
      auditNote: '',
      errorMessage: message,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  const apiUrl = process.env.EVAL_API_URL?.trim() || DEFAULT_API_URL;
  const parsedDelay = Number(process.env.EVAL_CASE_DELAY_MS);
  const interCaseDelayMs = Number.isFinite(parsedDelay) && parsedDelay >= 0
    ? parsedDelay
    : DEFAULT_INTER_CASE_DELAY_MS;
  console.log(`\n=== Sprint 7 Golden Benchmark Evaluation ===`);
  console.log(`Target endpoint : ${apiUrl}`);
  console.log(`Total test cases: ${GOLDEN_BENCHMARK_CASES.length}\n`);

  const outcomes: CaseOutcome[] = [];

  for (let i = 0; i < GOLDEN_BENCHMARK_CASES.length; i++) {
    const testCase = GOLDEN_BENCHMARK_CASES[i];
    process.stdout.write(`Running [${testCase.id}] ${testCase.label}... `);
    const outcome = await evaluateCase(testCase, apiUrl);
    outcomes.push(outcome);

    const statusTag = outcome.matched ? 'PASS' : 'MISMATCH';
    const scoreTag =
      outcome.confidenceScore !== null ? `${outcome.confidenceScore}%` : 'n/a';
    console.log(
      `${statusTag} | expected=${testCase.expectedVerdict} actual=${outcome.actualVerdict} (${scoreTag}) | model=${outcome.modelUsed} | reranker=${outcome.rerankerUsed} | selfCritiqueAdjusted=${String(outcome.selfCritiqueAdjusted)} | ${outcome.durationMs}ms`
    );

    const isLast = i === GOLDEN_BENCHMARK_CASES.length - 1;
    if (!isLast && interCaseDelayMs > 0 && outcome.durationMs > 2000) {
      await sleep(interCaseDelayMs);
    }
  }

  const passedCount = outcomes.filter((o) => o.matched).length;
  const accuracyPct = ((passedCount / outcomes.length) * 100).toFixed(1);
  const mismatches = outcomes.filter((o) => !o.matched);

  console.log(`\n=== Summary Report ===`);
  console.log(`Passed   : ${passedCount}/${outcomes.length}`);
  console.log(`Accuracy : ${accuracyPct}%`);

  if (mismatches.length > 0) {
    console.log(`\n=== Mismatch Details (${mismatches.length}) ===`);
    for (const mismatch of mismatches) {
      console.log(
        `- [${mismatch.testCase.id}] ${mismatch.testCase.label} (${mismatch.testCase.url})`
      );
      console.log(
        `  Expected: ${mismatch.testCase.expectedVerdict} | Actual: ${mismatch.actualVerdict}`
      );
      console.log(`  Rationale: ${mismatch.testCase.rationale}`);
      if (mismatch.errorMessage) {
        console.log(`  Error: ${mismatch.errorMessage}`);
      } else if (mismatch.auditNote) {
        console.log(`  Audit Note: ${mismatch.auditNote}`);
      }
    }
  } else {
    console.log('\nAll golden benchmark cases matched expected verdicts.');
  }

  if (passedCount === 0 && outcomes.every((o) => o.actualVerdict === 'ERROR')) {
    process.exitCode = 1;
  }
}

void main();
