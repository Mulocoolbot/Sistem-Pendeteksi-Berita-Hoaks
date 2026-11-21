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
    <main style={{ position: 'relative' }}>
      <div className="container">
        <LanguageSelector
          currentLanguage={language}
          onLanguageChange={(lang) => setLanguage(lang)}
        />

        <HeroSection language={language} />

        <InputPanel
          language={language}
          onAnalyzeUrl={analyzeUrl}
          onAnalyzeImage={analyzeImage}
          isAnalyzing={isAnalyzing}
        />

        {isAnalyzing && currentStep !== 'idle' && (
          <AnalysisTimeline currentStep={currentStep} language={language} />
        )}

        <div ref={resultRef}>
          {report && (
            <>
              <ResultCard report={report} language={language} />
              <EvidenceList report={report} language={language} />

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
