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

function StepSpinner() {
  return (
    <svg
      className={`${styles.stepSpinner} fc-spin`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="8"
        cy="8"
        r="5.75"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <path
        d="M13.75 8A5.75 5.75 0 0 0 8 2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

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

  const getStepLabel = (id: TimelineStepId) => {
    switch (id) {
      case 'extracting':
        return t.step_extracting;
      case 'analyzing-claims':
        return t.step_analyzing;
      case 'searching':
        return t.step_searching;
      case 'fact-checking':
        return t.step_factcheck;
      case 'comparing':
        return t.step_comparing;
      case 'generating-report':
        return t.step_report;
    }
  };

  const getStatusMeta = (state: StepState) => {
    switch (state) {
      case 'complete':
        return { label: t.statusDone, className: styles.statusDone };
      case 'active':
        return { label: t.statusActive, className: styles.statusActive };
      case 'error':
        return { label: t.statusFailed, className: styles.statusError };
      default:
        return { label: t.statusQueued, className: styles.statusQueued };
    }
  };

  const roundedProgress = Math.round(progressPercent);
  const isRunning =
    currentStep !== 'idle' && currentStep !== 'complete' && currentStep !== 'error';

  return (
    <section
      className={styles.timeline}
      aria-labelledby="timeline-title"
      aria-live="polite"
      aria-busy={isRunning}
    >
      <div
        className={styles.sweepTrack}
        role="progressbar"
        aria-label={t.timelineTitle}
        aria-valuenow={roundedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {isRunning ? (
          <div className={`${styles.sweepBar} fc-progress-sweep`} />
        ) : (
          <div
            className={
              currentStep === 'error' ? styles.sweepFillError : styles.sweepFillComplete
            }
          />
        )}
      </div>

      <div className={styles.header}>
        <h2 id="timeline-title" className={styles.timelineTitle}>
          {t.timelineTitle}
        </h2>
        <span className={styles.progressCounter}>
          {currentStep === 'error' ? t.error : `${roundedProgress}%`}
        </span>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((stepId, index) => {
          const state = getStepState(index);
          const label = getStepLabel(stepId);
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
              <span
                className={`${styles.stepLabel} ${
                  state === 'pending' ? styles.stepLabelPending : ''
                }`}
              >
                {label}
              </span>
              <span className={`${styles.stepStatus} ${status.className}`}>
                {state === 'active' && <StepSpinner />}
                {status.label}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
