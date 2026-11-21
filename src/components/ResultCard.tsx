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

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = (report.credibilityScore / 100) * circumference;
  const dashOffset = circumference - progress;

  const getLocalizedVerdict = (verdict: string) => {
    const normalized = verdict.toUpperCase();
    if (
      normalized.includes('HOAKS') ||
      normalized.includes('HOAX') ||
      normalized.includes('FAKE') ||
      normalized.includes('FALSE')
    ) {
      return { label: t.verdict_hoax, statusClass: styles.verdictBadgeDanger };
    }
    if (
      normalized.includes('FAKTA') ||
      normalized.includes('FACT') ||
      normalized.includes('TRUE')
    ) {
      return { label: t.verdict_fakta, statusClass: styles.verdictBadgeSuccess };
    }
    if (
      normalized.includes('MISLEADING') ||
      normalized.includes('CAMPURAN') ||
      normalized.includes('NETRAL') ||
      normalized.includes('MIXED') ||
      normalized.includes('NEUTRAL')
    ) {
      return { label: t.verdict_neutral, statusClass: styles.verdictBadgeWarning };
    }
    return { label: t.verdict_unverified, statusClass: styles.verdictBadgeNeutral };
  };

  const getClaimVerdictClass = (verdict: string) => {
    const normalized = verdict.toUpperCase();
    if (
      normalized.includes('HOAKS') ||
      normalized.includes('HOAX') ||
      normalized.includes('FAKE') ||
      normalized.includes('FALSE')
    ) {
      return styles.verdictHOAKS;
    }
    if (
      normalized.includes('FAKTA') ||
      normalized.includes('FACT') ||
      normalized.includes('TRUE')
    ) {
      return styles.verdictFAKTA;
    }
    if (normalized.includes('MISLEADING') || normalized.includes('MENYESATKAN')) {
      return styles.verdictMISLEADING;
    }
    return styles.verdictUNKNOWN;
  };

  const getConfidenceClass = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high':
        return styles.confidenceHigh;
      case 'medium':
        return styles.confidenceMedium;
      default:
        return styles.confidenceLow;
    }
  };

  const getConfidenceLabel = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high':
        return t.confidence_high;
      case 'medium':
        return t.confidence_medium;
      default:
        return t.confidence_low;
    }
  };

  const verdictConfig = getLocalizedVerdict(report.overallVerdict);

  return (
    <article className={styles.resultCard} id="result-card" aria-labelledby="result-title">
      <header className={styles.verdictHeader}>
        <div className={`${styles.verdictBadge} ${verdictConfig.statusClass}`}>
          {verdictConfig.label}
        </div>
        <h2 id="result-title" className={styles.articleTitle}>
          {report.articleTitle}
        </h2>
        <div className={styles.inputSource}>{report.inputValue}</div>
      </header>

      <section className={styles.scoreSection} aria-label={t.credibilityScore}>
        <div
          className={styles.gauge}
          role="img"
          aria-label={`${t.credibilityScore}: ${report.credibilityScore}/100`}
        >
          <svg className={styles.gaugeCircle} viewBox="0 0 160 160" aria-hidden="true">
            <circle className={styles.gaugeBg} cx="80" cy="80" r={radius} />
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
            {t.credibilityScore}: <strong>{report.credibilityScore}/100</strong>
          </div>
          <div className={styles.scoreDetail}>
            {t.confidence}:{' '}
            <span
              className={`${styles.confidenceBadge} ${getConfidenceClass(report.confidenceLevel)}`}
            >
              {getConfidenceLabel(report.confidenceLevel)}
            </span>
          </div>
          <div className={styles.scoreDetail}>
            {t.claimsAnalyzed}: <strong>{report.claimAssessments.length}</strong>
          </div>
          <div className={styles.scoreDetail}>
            {t.sourcesFound}: <strong>{report.evidenceSources.length}</strong>
          </div>
        </div>
      </section>

      <section className={styles.summary} aria-labelledby="summary-title">
        <h3 id="summary-title" className={styles.sectionTitle}>
          {t.summary}
        </h3>
        <p className={styles.summaryText}>{report.summary}</p>
      </section>

      {(report.redFlags.length > 0 || report.positiveIndicators.length > 0) && (
        <section className={styles.findingsSection} aria-label={t.summary}>
          {report.redFlags.length > 0 && (
            <div className={`${styles.findingsList} ${styles.redFlagsList}`}>
              <h3 className={`${styles.findingsListTitle} ${styles.red}`}>{t.redFlags}</h3>
              <ul className={styles.findingsItems}>
                {report.redFlags.map((flag, i) => (
                  <li key={i} className={styles.findingItem}>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.positiveIndicators.length > 0 && (
            <div className={`${styles.findingsList} ${styles.positiveList}`}>
              <h3 className={`${styles.findingsListTitle} ${styles.green}`}>
                {t.positiveIndicators}
              </h3>
              <ul className={styles.findingsItems}>
                {report.positiveIndicators.map((indicator, i) => (
                  <li key={i} className={styles.findingItem}>
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {report.claimAssessments.length > 0 && (
        <section className={styles.claimsSection} aria-labelledby="claims-title">
          <h3 id="claims-title" className={styles.sectionTitle}>
            {t.claimsAssessment}
          </h3>
          {report.claimAssessments.map((assessment, i) => (
            <article key={i} className={styles.claimCard}>
              <div className={styles.claimHeader}>
                <div className={styles.claimText}>&ldquo;{assessment.claim}&rdquo;</div>
                <span
                  className={`${styles.claimVerdict} ${getClaimVerdictClass(assessment.verdict)}`}
                >
                  {assessment.verdict}
                </span>
              </div>
              <p className={styles.claimExplanation}>{assessment.explanation}</p>
            </article>
          ))}
        </section>
      )}

      <footer className={styles.meta}>
        <span>
          {t.analyzedAt}: {formatDate(report.analyzedAt, language)}
        </span>
        <span>
          {t.analysisTime}: {(report.analysisTimeMs / 1000).toFixed(1)}s
        </span>
      </footer>
    </article>
  );
}
