'use client';

import { useMemo } from 'react';
import styles from './AnalysisTimeline.module.css';
import type { AnalysisStep } from '@/lib/types';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface AnalysisTimelineProps {
  currentStep: AnalysisStep;
  language: LanguageCode;
}

type TimelineStepId = Exclude<AnalysisStep, 'idle' | 'complete' | 'error'>;

const STEPS: TimelineStepId[] = [
  'extracting',
  'analyzing-claims',
  'searching',
  'fact-checking',
  'comparing',
  'generating-report',
];

type StepState = 'pending' | 'active' | 'complete' | 'error';

export default function AnalysisTimeline({ currentStep, language }: AnalysisTimelineProps) {
  const t = TRANSLATIONS[language];

  const currentIndex = useMemo(
    () => STEPS.indexOf(currentStep as TimelineStepId),
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

  const getStepState = (index: number): StepState => {
    if (currentStep === 'error' && index === activeIndex) return 'error';
    if (currentStep === 'complete' || index < activeIndex) return 'complete';
    if (index === activeIndex) return 'active';
    return 'pending';
  };

  const getStepDetails = (id: TimelineStepId) => {
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
    }
  };

  const getStatusMeta = (state: StepState) => {
    switch (state) {
      case 'complete':
        return { label: `[${t.statusDone}]`, className: styles.statusDone };
      case 'active':
        return { label: `[${t.statusActive}]`, className: styles.statusActive };
      case 'error':
        return { label: `[${t.statusFailed}]`, className: styles.statusError };
      default:
        return { label: `[${t.statusQueued}]`, className: styles.statusQueued };
    }
  };

  const roundedProgress = Math.round(progressPercent);

  return (
    <section
      className={styles.timeline}
      aria-labelledby="timeline-title"
      aria-live="polite"
      aria-busy={currentStep !== 'complete' && currentStep !== 'error'}
    >
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>{t.dispatchKicker}</span>
          <h2 id="timeline-title" className={styles.timelineTitle}>
            {t.timelineTitle}
          </h2>
        </div>
        <div className={styles.progressCounter}>
          {currentStep === 'error' ? t.error : `${roundedProgress}% ${t.complete.toUpperCase()}`}
        </div>
      </div>

      <div
        className={styles.progressBar}
        role="progressbar"
        aria-label={t.timelineTitle}
        aria-valuenow={roundedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
      </div>

      <ol className={styles.steps}>
        {STEPS.map((stepId, index) => {
          const state = getStepState(index);
          const { label, description } = getStepDetails(stepId);
          const status = getStatusMeta(state);
          const stepNumber = String(index + 1).padStart(2, '0');

          return (
            <li
              key={stepId}
              className={`${styles.step} ${state === 'active' ? styles.stepRowActive : ''}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className={styles.stepIndex} aria-hidden="true">
                {stepNumber}
              </span>
              <div className={styles.stepContent}>
                <div
                  className={`${styles.stepLabel} ${
                    state === 'pending' ? styles.stepLabelPending : ''
                  }`}
                >
                  {label}
                </div>
                {state === 'active' && (
                  <p className={styles.stepDescription}>{description}</p>
                )}
              </div>
              <span className={`${styles.stepStatus} ${status.className}`}>
                {status.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
