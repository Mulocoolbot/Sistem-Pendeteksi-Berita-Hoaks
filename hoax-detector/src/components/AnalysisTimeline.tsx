'use client';

import { useMemo } from 'react';
import styles from './AnalysisTimeline.module.css';
import type { AnalysisStep } from '@/lib/types';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface AnalysisTimelineProps {
  currentStep: AnalysisStep;
  language: LanguageCode;
}

interface StepConfig {
  id: Exclude<AnalysisStep, 'idle' | 'complete' | 'error'>;
  icon: string;
}

const STEPS: StepConfig[] = [
  { id: 'extracting', icon: '📄' },
  { id: 'analyzing-claims', icon: '🧠' },
  { id: 'searching', icon: '🔍' },
  { id: 'fact-checking', icon: '✅' },
  { id: 'comparing', icon: '⚖️' },
  { id: 'generating-report', icon: '📊' },
];

const STEP_ORDER: AnalysisStep[] = [
  'extracting',
  'analyzing-claims',
  'searching',
  'fact-checking',
  'comparing',
  'generating-report',
];

export default function AnalysisTimeline({ currentStep, language }: AnalysisTimelineProps) {
  const t = TRANSLATIONS[language];

  const currentIndex = useMemo(
    () => STEP_ORDER.indexOf(currentStep),
    [currentStep]
  );

  const activeIndex = useMemo(() => {
    if (currentStep === 'complete') return STEPS.length;
    if (currentStep === 'error') return currentIndex;
    if (currentStep === 'idle') return -1;
    return currentIndex >= 0 ? currentIndex : 0;
  }, [currentStep, currentIndex]);

  const progressPercent = useMemo(() => {
    if (currentStep === 'complete') return 100;
    if (currentStep === 'idle') return 0;
    if (currentStep === 'error') return ((activeIndex + 1) / STEPS.length) * 100;
    return Math.min(((activeIndex + 1) / STEPS.length) * 100, 95);
  }, [currentStep, activeIndex]);

  const getStepState = (index: number): 'pending' | 'active' | 'complete' | 'error' => {
    if (currentStep === 'error' && index === activeIndex) return 'error';
    if (currentStep === 'complete' || index < activeIndex) return 'complete';
    if (index === activeIndex) return 'active';
    return 'pending';
  };

  // Localized label and description getter helper
  const getStepDetails = (id: string) => {
    switch (id) {
      case 'extracting':
        return { label: t.step_extracting, description: t.step_extracting_desc };
      case 'analyzing-claims':
        return { label: t.step_analyzing, description: t.step_analyzing_desc };
      case 'searching':
        return { label: t.step_searching, description: t.step_searching_desc };
      case 'fact-checking':
        return { label: t.step_factcheck, description: t.step_factcheck_desc };
      case 'comparing':
        return { label: t.step_comparing, description: t.step_comparing_desc };
      case 'generating-report':
        return { label: t.step_report, description: t.step_report_desc };
      default:
        return { label: '', description: '' };
    }
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineTitle}>🔬 {t.timelineTitle}</div>

      <div className={styles.steps}>
        {STEPS.map((step, index) => {
          const state = getStepState(index);
          const { label, description } = getStepDetails(step.id);
          return (
            <div key={step.id} className={`${styles.step} ${
              state === 'complete' ? styles.stepLineComplete :
              state === 'active' ? styles.stepLineActive :
              state === 'error' ? styles.stepLineError :
              ''
            }`}>
              <div
                className={`${styles.stepIcon} ${
                  state === 'complete' ? styles.stepComplete :
                  state === 'active' ? styles.stepActive :
                  state === 'error' ? styles.stepError :
                  styles.stepPending
                }`}
              >
                {state === 'active' ? (
                  <svg className={styles.spinnerSvg} viewBox="0 0 50 50">
                    <circle className={styles.spinnerPath} cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
                  </svg>
                ) : state === 'complete' ? (
                  '✓'
                ) : state === 'error' ? (
                  '✕'
                ) : (
                  step.icon
                )}
              </div>
              <div className={styles.stepContent}>
                <div
                  className={`${styles.stepLabel} ${
                    state === 'pending' ? styles.stepLabelPending :
                    state === 'active' ? styles.stepLabelActive : ''
                  }`}
                >
                  {label}
                </div>
                {state === 'active' && (
                  <div className={styles.stepDescription}>{description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.progressWrapper}>
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${currentStep !== 'complete' && currentStep !== 'error' ? styles.progressActive : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className={styles.progressText}>
          {currentStep === 'error'
            ? t.error
            : `${Math.round(progressPercent)}% ${t.complete.toLowerCase()}`}
        </div>
      </div>
    </div>
  );
}
