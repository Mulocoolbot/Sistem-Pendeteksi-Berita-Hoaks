'use client';

import { useMemo } from 'react';
import styles from './AnalysisTimeline.module.css';
import type { AnalysisStep } from '@/lib/types';

interface AnalysisTimelineProps {
  currentStep: AnalysisStep;
}

interface StepConfig {
  id: AnalysisStep;
  icon: string;
  activeIcon: string;
  label: string;
  description: string;
}

const STEPS: StepConfig[] = [
  {
    id: 'extracting',
    icon: '📄',
    activeIcon: '📄',
    label: 'Mengekstrak Konten',
    description: 'Membaca dan mengekstrak elemen dari input...',
  },
  {
    id: 'analyzing-claims',
    icon: '🧠',
    activeIcon: '🧠',
    label: 'Menganalisis Klaim',
    description: 'AI mengidentifikasi klaim-klaim utama...',
  },
  {
    id: 'searching',
    icon: '🔍',
    activeIcon: '🔍',
    label: 'Mencari Berita Serupa',
    description: 'Melacak sumber berita dari internet...',
  },
  {
    id: 'fact-checking',
    icon: '✅',
    activeIcon: '✅',
    label: 'Memeriksa Fact-Check',
    description: 'Mengecek database fact-check resmi...',
  },
  {
    id: 'comparing',
    icon: '⚖️',
    activeIcon: '⚖️',
    label: 'Membandingkan Sumber',
    description: 'Membandingkan dengan sumber terpercaya...',
  },
  {
    id: 'generating-report',
    icon: '📊',
    activeIcon: '📊',
    label: 'Menyusun Laporan',
    description: 'Membuat laporan investigasi final...',
  },
];

const STEP_ORDER: AnalysisStep[] = [
  'extracting',
  'analyzing-claims',
  'searching',
  'fact-checking',
  'comparing',
  'generating-report',
];

export default function AnalysisTimeline({ currentStep }: AnalysisTimelineProps) {
  const currentIndex = useMemo(
    () => STEP_ORDER.indexOf(currentStep),
    [currentStep]
  );

  // Simulate that the backend is doing steps 2-6 at once after "extracting"
  // since it's a single API call, we animate through the steps
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

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineTitle}>🔬 Investigasi Sedang Berlangsung...</div>

      <div className={styles.steps}>
        {STEPS.map((step, index) => {
          const state = getStepState(index);
          return (
            <div key={step.id} className={styles.step}>
              <div
                className={`${styles.stepIcon} ${
                  state === 'complete' ? styles.stepComplete :
                  state === 'active' ? styles.stepActive :
                  state === 'error' ? styles.stepError :
                  styles.stepPending
                }`}
              >
                {state === 'active' ? (
                  <div className={styles.spinner} />
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
                  {step.label}
                </div>
                {state === 'active' && (
                  <div className={styles.stepDescription}>{step.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.progressWrapper}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className={styles.progressText}>
          {currentStep === 'error'
            ? 'Terjadi kesalahan'
            : `${Math.round(progressPercent)}% selesai`}
        </div>
      </div>
    </div>
  );
}
