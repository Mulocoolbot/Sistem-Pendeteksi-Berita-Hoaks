'use client';

import { useState } from 'react';
import HeroSection from '@/components/HeroSection';
import InputPanel from '@/components/InputPanel';
import AnalysisTimeline from '@/components/AnalysisTimeline';
import ResultCard from '@/components/ResultCard';
import EvidenceList from '@/components/EvidenceList';
import LanguageSelector from '@/components/LanguageSelector';
import { useAnalysis } from '@/hooks/useAnalysis';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

export default function HomePage() {
  const [language, setLanguage] = useState<LanguageCode>('id');
  const {
    isAnalyzing,
    currentStep,
    report,
    resultRef,
    analyzeUrl,
    analyzeImage,
  } = useAnalysis(language);

  const t = TRANSLATIONS[language];

  return (
    <div className="container">
      <header>
        <LanguageSelector
          currentLanguage={language}
          onLanguageChange={(lang) => setLanguage(lang)}
        />
        <HeroSection language={language} />
      </header>

      <main id="main-content">
        <InputPanel
          language={language}
          onAnalyzeUrl={analyzeUrl}
          onAnalyzeImage={analyzeImage}
          isAnalyzing={isAnalyzing}
        />

        <div aria-live="polite" aria-busy={isAnalyzing}>
          {isAnalyzing && currentStep !== 'idle' && (
            <AnalysisTimeline currentStep={currentStep} language={language} />
          )}

          <div ref={resultRef}>
            {report && (
              <>
                <ResultCard report={report} language={language} />
                <EvidenceList report={report} language={language} />
              </>
            )}
          </div>
        </div>
      </main>

      {report && (
        <footer className="site-footer">
          <p className="site-footer-disclaimer">{t.disclaimer}</p>
          <p>{t.poweredBy}</p>
        </footer>
      )}
    </div>
  );
}
