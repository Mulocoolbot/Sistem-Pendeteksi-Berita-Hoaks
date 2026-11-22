'use client';

import { useState } from 'react';
import HeroSection from '@/components/HeroSection';
import InputPanel from '@/components/InputPanel';
import AnalysisTimeline from '@/components/AnalysisTimeline';
import ResultCard from '@/components/ResultCard';
import { useAnalysis } from '@/hooks/useAnalysis';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

export default function HomePage() {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const {
    isAnalyzing,
    currentStep,
    report,
    error,
    clearError,
    resultRef,
    analyzeUrl,
    analyzeImage,
  } = useAnalysis(language);

  const t = TRANSLATIONS[language];

  return (
    <div className="container">
      <header>
        <HeroSection language={language} onLanguageChange={setLanguage} />
      </header>

      <main id="main-content">
        <InputPanel
          language={language}
          onAnalyzeUrl={analyzeUrl}
          onAnalyzeImage={analyzeImage}
          isAnalyzing={isAnalyzing}
          externalError={error}
          onClearError={clearError}
        />

        <section
          aria-live="polite"
          aria-busy={isAnalyzing}
          aria-label={t.timelineTitle}
        >
          {isAnalyzing && currentStep !== 'idle' && (
            <AnalysisTimeline currentStep={currentStep} language={language} />
          )}

          <div ref={resultRef}>
            {report && <ResultCard report={report} language={language} />}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p className="site-footer-disclaimer">{t.disclaimer}</p>
        <p className="site-footer-meta">{t.poweredBy}</p>
      </footer>
    </div>
  );
}
