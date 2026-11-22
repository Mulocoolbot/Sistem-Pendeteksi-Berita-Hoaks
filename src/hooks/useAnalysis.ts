'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { APP_CONFIG } from '@/lib/config';
import type { AnalysisStep, ApiResponse, InvestigationReport } from '@/lib/types';
import { fileToBase64 } from '@/lib/utils/sanitize';
import type { LanguageCode } from '@/lib/utils/translations';

const ANALYSIS_STEPS: AnalysisStep[] = [
  'extracting',
  'analyzing-claims',
  'searching',
  'fact-checking',
  'comparing',
  'generating-report',
];

export function useAnalysis(language: LanguageCode = 'en') {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('idle');
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStepSimulation = useCallback(() => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopStepSimulation();
  }, [stopStepSimulation]);

  const startStepSimulation = useCallback(() => {
    stopStepSimulation();
    let stepIndex = 0;
    setCurrentStep(ANALYSIS_STEPS[0]);

    stepIntervalRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex < ANALYSIS_STEPS.length) {
        setCurrentStep(ANALYSIS_STEPS[stepIndex]);
      } else {
        stopStepSimulation();
      }
    }, APP_CONFIG.timeouts.stepSimulationIntervalMs);
  }, [stopStepSimulation]);

  const handleAnalysisStart = useCallback(() => {
    setIsAnalyzing(true);
    setReport(null);
    setError(null);
    startStepSimulation();
  }, [startStepSimulation]);

  const handleAnalysisComplete = useCallback(
    (newReport: InvestigationReport) => {
      stopStepSimulation();
      setCurrentStep('complete');
      setReport(newReport);
      setIsAnalyzing(false);

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, APP_CONFIG.timeouts.scrollIntoViewDelayMs);
    },
    [stopStepSimulation]
  );

  const handleAnalysisError = useCallback(
    (errorMessage: string) => {
      console.error('Analysis error:', errorMessage);
      stopStepSimulation();
      setCurrentStep('error');
      setError(errorMessage);
      setIsAnalyzing(false);
    },
    [stopStepSimulation]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const executeAnalysis = useCallback(
    async (
      endpoint: string,
      buildPayload: () => Promise<Record<string, unknown>>,
      fallbackError: string
    ) => {
      handleAnalysisStart();

      try {
        const payload = await buildPayload();
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as ApiResponse<InvestigationReport>;
        if (!result.success || !result.data) {
          throw new Error(result.error || fallbackError);
        }

        handleAnalysisComplete(result.data);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : language === 'id'
              ? 'Terjadi kesalahan.'
              : 'An error occurred.';
        handleAnalysisError(message);
        throw new Error(message);
      }
    },
    [handleAnalysisComplete, handleAnalysisError, handleAnalysisStart, language]
  );

  const analyzeUrl = useCallback(
    async (url: string) => {
      const fallbackError = language === 'id' ? 'Analisis gagal.' : 'Analysis failed.';
      await executeAnalysis(
        '/api/analyze/url',
        async () => ({ url: url.trim(), language }),
        fallbackError
      );
    },
    [executeAnalysis, language]
  );

  const analyzeImage = useCallback(
    async (file: File) => {
      const fallbackError =
        language === 'id' ? 'Analisis gambar gagal.' : 'Image analysis failed.';
      await executeAnalysis(
        '/api/analyze/image',
        async () => ({
          imageBase64: await fileToBase64(file),
          mimeType: file.type,
          language,
        }),
        fallbackError
      );
    },
    [executeAnalysis, language]
  );

  return {
    isAnalyzing,
    currentStep,
    report,
    error,
    clearError,
    resultRef,
    analyzeUrl,
    analyzeImage,
  };
}
