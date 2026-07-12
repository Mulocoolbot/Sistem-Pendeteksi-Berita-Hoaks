'use client';

import styles from './ResultCard.module.css';
import type { InvestigationReport } from '@/lib/types';
import { getVerdictConfig, getScoreColor, formatDate } from '@/lib/utils/sanitize';

interface ResultCardProps {
  report: InvestigationReport;
}

export default function ResultCard({ report }: ResultCardProps) {
  const verdictConfig = getVerdictConfig(report.overallVerdict);
  const scoreColor = getScoreColor(report.credibilityScore);

  // SVG gauge calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = (report.credibilityScore / 100) * circumference;
  const dashOffset = circumference - progress;

  const getClaimVerdictClass = (verdict: string) => {
    switch (verdict) {
      case 'HOAKS': return styles.verdictHOAKS;
      case 'FAKTA': return styles.verdictFAKTA;
      case 'MISLEADING': return styles.verdictMISLEADING;
      default: return styles.verdictUNKNOWN;
    }
  };

  const getConfidenceClass = (level: string) => {
    switch (level) {
      case 'high': return styles.confidenceHigh;
      case 'medium': return styles.confidenceMedium;
      default: return styles.confidenceLow;
    }
  };

  const getConfidenceLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Tinggi';
      case 'medium': return 'Sedang';
      default: return 'Rendah';
    }
  };

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
            <span className={styles.gaugeLabel}>Kredibilitas</span>
          </div>
        </div>

        <div className={styles.scoreDetails}>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>📊</span>
            Skor Kredibilitas: <strong>{report.credibilityScore}/100</strong>
          </div>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>🎯</span>
            Keyakinan:{' '}
            <span className={`${styles.confidenceBadge} ${getConfidenceClass(report.confidenceLevel)}`}>
              {getConfidenceLabel(report.confidenceLevel)}
            </span>
          </div>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>📰</span>
            Klaim dianalisis: <strong>{report.claimAssessments.length}</strong>
          </div>
          <div className={styles.scoreDetail}>
            <span className={styles.scoreDetailIcon}>🔗</span>
            Sumber ditemukan: <strong>{report.evidenceSources.length}</strong>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summary}>
        <h3 className={styles.sectionTitle}>📋 Ringkasan Investigasi</h3>
        <p className={styles.summaryText}>{report.summary}</p>
      </div>

      {/* Key Findings / Red Flags */}
      {(report.redFlags.length > 0 || report.positiveIndicators.length > 0) && (
        <div className={styles.findingsSection}>
          {report.redFlags.length > 0 && (
            <div className={`${styles.findingsList} ${styles.redFlagsList}`}>
              <div className={`${styles.findingsListTitle} ${styles.red}`}>
                🚩 Red Flags
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
                ✅ Indikator Positif
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
          <h3 className={styles.sectionTitle}>🔍 Penilaian Per Klaim</h3>
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
        <span>🕐 Dianalisis: {formatDate(report.analyzedAt)}</span>
        <span>⏱️ Waktu analisis: {(report.analysisTimeMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
