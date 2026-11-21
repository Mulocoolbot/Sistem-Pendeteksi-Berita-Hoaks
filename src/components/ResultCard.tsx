'use client';

import styles from './ResultCard.module.css';
import type { InvestigationReport } from '@/lib/types';
import { getScoreColor, formatDate } from '@/lib/utils/sanitize';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface ResultCardProps {
  report: InvestigationReport;
  language: LanguageCode;
}

export default function ResultCard({ report, language }: ResultCardProps) {
  const t = TRANSLATIONS[language];
  const scoreColor = getScoreColor(report.credibilityScore);

  // SVG gauge calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = (report.credibilityScore / 100) * circumference;
  const dashOffset = circumference - progress;

  const getLocalizedVerdict = (verdict: string) => {
    const normalized = verdict.toUpperCase();
    if (normalized.includes('HOAKS') || normalized.includes('HOAX') || normalized.includes('FAKE') || normalized.includes('FALSE')) {
      return {
        label: `❌ ${t.verdict_hoax}`,
        gradient: 'var(--gradient-hoax)',
      };
    }
    if (normalized.includes('FAKTA') || normalized.includes('FACT') || normalized.includes('TRUE')) {
      return {
        label: `✅ ${t.verdict_fakta}`,
        gradient: 'var(--gradient-fact)',
      };
    }
    if (normalized.includes('CAMPURAN') || normalized.includes('NETRAL') || normalized.includes('MIXED') || normalized.includes('NEUTRAL')) {
      return {
        label: `⚠️ ${t.verdict_neutral}`,
        gradient: 'var(--gradient-unknown)',
      };
    }
    return {
      label: `🔍 ${t.verdict_unverified}`,
      gradient: 'var(--gradient-unknown)',
    };
  };

  const getClaimVerdictClass = (verdict: string) => {
    const normalized = verdict.toUpperCase();
    if (normalized.includes('HOAKS') || normalized.includes('HOAX') || normalized.includes('FAKE') || normalized.includes('FALSE')) {
      return styles.verdictHOAKS;
    }
    if (normalized.includes('FAKTA') || normalized.includes('FACT') || normalized.includes('TRUE')) {
      return styles.verdictFAKTA;
    }
    return styles.verdictUNKNOWN;
  };

  const getConfidenceClass = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return styles.confidenceHigh;
      case 'medium': return styles.confidenceMedium;
      default: return styles.confidenceLow;
    }
  };

  const getConfidenceLabel = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return t.confidence_high;
      case 'medium': return t.confidence_medium;
      default: return t.confidence_low;
    }
  };

  const verdictConfig = getLocalizedVerdict(report.overallVerdict);

  return (
    <div className={styles.resultCard} id="result-card">
      {/* Verdict Header */}
      <div className={styles.verdictHeader}>
        <div
          className={styles.verdictBadge}
          style={{ background: verdictConfig.gradient }}
        >
          {verdictConfig.label}
        </div>
        <div className={styles.articleTitle}>
          {report.articleTitle}
        </div>
        <div className={styles.inputSource}>
          {report.inputType === 'url' ? '🔗' : '🖼️'} {report.inputValue}
        </div>
      </div>

      {/* Score Gauge */}
      <div className={styles.scoreSection}>
        <div className={styles.gauge}>
          <svg className={styles.gaugeCircle} viewBox="0 0 160 160">
            <circle
              className={styles.gaugeBg}
              cx="80"
              cy="80"
              r={radius}
            />
            <circle
              className={styles.gaugeProgress}
              cx="80"
              cy="80"
              r={radius}
              stroke={scoreColor}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className={styles.gaugeCenter}>
            <span className={styles.gaugeScore} style={{ color: scoreColor }}>
              {report.credibilityScore}
            </span>
            <span className={styles.gaugeLabel}>{t.credibilityScore.split(' ')[0]}</span>
          </div>
        </div>

        <div className={styles.scoreDetails}>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>📊</span>
            {t.credibilityScore}: <strong>{report.credibilityScore}/100</strong>
          </div>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>🎯</span>
            {t.confidence}:{' '}
            <span className={`${styles.confidenceBadge} ${getConfidenceClass(report.confidenceLevel)}`}>
              {getConfidenceLabel(report.confidenceLevel)}
            </span>
          </div>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>📰</span>
            {t.claimsAnalyzed}: <strong>{report.claimAssessments.length}</strong>
          </div>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>🔗</span>
            {t.sourcesFound}: <strong>{report.evidenceSources.length}</strong>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <h3 className={styles.sectionTitle}>📋 {t.summary}</h3>
        <p className={styles.summaryText}>{report.summary}</p>
      </div>

      {/* Key Findings / Red Flags */}
      {(report.redFlags.length > 0 || report.positiveIndicators.length > 0) && (
        <div className={styles.findingsSection}>
          {report.redFlags.length > 0 && (
            <div className={`${styles.findingsList} ${styles.redFlagsList}`}>
              <div className={`${styles.findingsListTitle} ${styles.red}`}>
                🚩 {t.redFlags}
              </div>
              {report.redFlags.map((flag, i) => (
                <div key={i} className={styles.findingItem}>
                  <span className={styles.findingBullet}>•</span>
                  {flag}
                </div>
              ))}
            </div>
          )}
          {report.positiveIndicators.length > 0 && (
            <div className={`${styles.findingsList} ${styles.positiveList}`}>
              <div className={`${styles.findingsListTitle} ${styles.green}`}>
                ✅ {t.positiveIndicators}
              </div>
              {report.positiveIndicators.map((indicator, i) => (
                <div key={i} className={styles.findingItem}>
                  <span className={styles.findingBullet}>•</span>
                  {indicator}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Claim-by-Claim Assessment */}
      {report.claimAssessments.length > 0 && (
        <div className={styles.claimsSection}>
          <h3 className={styles.sectionTitle}>🔍 {t.claimsAssessment}</h3>
          {report.claimAssessments.map((assessment, i) => (
            <div key={i} className={styles.claimCard}>
              <div className={styles.claimHeader}>
                <div className={styles.claimText}>
                  &ldquo;{assessment.claim}&rdquo;
                </div>
                <span className={`${styles.claimVerdict} ${getClaimVerdictClass(assessment.verdict)}`}>
                  {assessment.verdict}
                </span>
              </div>
              <p className={styles.claimExplanation}>
                {assessment.explanation}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Meta Footer */}
      <div className={styles.meta}>
        <span>🕐 {t.analyzedAt}: {formatDate(report.analyzedAt, language)}</span>
        <span>⏱️ {t.analysisTime}: {(report.analysisTimeMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
