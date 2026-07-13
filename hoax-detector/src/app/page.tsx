'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import HeroSection from '@/components/HeroSection';
import InputPanel from '@/components/InputPanel';
import AnalysisTimeline from '@/components/AnalysisTimeline';
import ResultCard from '@/components/ResultCard';
import EvidenceList from '@/components/EvidenceList';
import LanguageSelector from '@/components/LanguageSelector';
import type { InvestigationReport, AnalysisStep } from '@/lib/types';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

// Steps to cycle through during analysis (simulated progression)
const ANALYSIS_STEPS: AnalysisStep[] = [
  'extracting',
  'analyzing-claims',
  'searching',
  'fact-checking',
  'comparing',
  'generating-report',
];

export default function HomePage() {
  const [language, setLanguage] = useState<LanguageCode>('id');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('idle');
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const t = TRANSLATIONS[language];

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
      }
    };
  }, []);

  // Simulate step progression during analysis
  const startStepSimulation = useCallback(() => {
    let stepIndex = 0;
    setCurrentStep(ANALYSIS_STEPS[0]);

    stepIntervalRef.current = setInterval(() => {
      stepIndex++;
      if (stepIndex < ANALYSIS_STEPS.length) {
        setCurrentStep(ANALYSIS_STEPS[stepIndex]);
      } else {
        // Stay on last step until real completion
        if (stepIntervalRef.current) {
          clearInterval(stepIntervalRef.current);
        }
      }
    }, 3000); // Advance every 3 seconds
  }, []);

  const stopStepSimulation = useCallback(() => {
    if (stepIntervalRef.current) {
      clearInterval(stepIntervalRef.current);
      stepIntervalRef.current = null;
    }
  }, []);

  const handleAnalysisStart = useCallback(() => {
    setIsAnalyzing(true);
    setReport(null);
    startStepSimulation();
  }, [startStepSimulation]);

  const handleAnalysisComplete = useCallback(
    (newReport: InvestigationReport) => {
      stopStepSimulation();
      setCurrentStep('complete');
      setReport(newReport);
      setIsAnalyzing(false);

      // Scroll to results
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    },
    [stopStepSimulation]
  );

  const handleAnalysisError = useCallback(
    (error: string) => {
      console.error('Analysis error:', error);
      stopStepSimulation();
      setCurrentStep('error');
      setIsAnalyzing(false);
    },
    [stopStepSimulation]
  );

  const handleStepChange = useCallback(
    (step: string) => {
      // This is called by InputPanel for real step changes
      if (step === 'complete') {
        stopStepSimulation();
        setCurrentStep('complete');
      }
    },
    [stopStepSimulation]
  );

  return (
    <main style={{ position: 'relative' }}>
      <div className="container">
        {/* Language Selector */}
        <LanguageSelector
          currentLanguage={language}
          onLanguageChange={(lang) => setLanguage(lang)}
        />

        {/* Hero Section */}
        <HeroSection language={language} />

        {/* Input Panel */}
        <InputPanel
          language={language}
          onAnalysisStart={handleAnalysisStart}
          onAnalysisComplete={handleAnalysisComplete}
          onAnalysisError={handleAnalysisError}
          onStepChange={handleStepChange}
          isAnalyzing={isAnalyzing}
        />

        {/* Analysis Timeline (shown during analysis) */}
        {isAnalyzing && currentStep !== 'idle' && (
          <AnalysisTimeline currentStep={currentStep} language={language} />
        )}

        {/* Results */}
        <div ref={resultRef}>
          {report && (
            <>
              <ResultCard report={report} language={language} />
              <EvidenceList report={report} language={language} />

              {/* Footer */}
              <footer
                style={{
                  textAlign: 'center',
                  padding: 'var(--spacing-2xl) 0',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  borderTop: '1px solid var(--border-glass)',
                  maxWidth: '900px',
                  margin: '0 auto',
                }}
              >
                <p style={{ marginBottom: '0.5rem' }}>
                  ⚠️ {t.disclaimer}
                </p>
                <p>
                  {t.poweredBy}
                </p>
              </footer>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
