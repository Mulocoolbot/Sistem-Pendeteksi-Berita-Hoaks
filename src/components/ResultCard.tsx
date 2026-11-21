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
  const overallVerdict = report.verdict ?? report.overallVerdict;
  const confidenceScore = report.confidenceScore ?? report.credibilityScore;
  const claims = report.claims ?? [];
  const claimAssessments = report.claimAssessments ?? [];
  const redFlags = report.redFlags ?? [];
  const positiveIndicators = report.positiveIndicators ?? [];
  const evidenceSources = report.evidenceSources ?? [];
  const signals = report.signals;

  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const progress = (report.credibilityScore / 100) * circumference;
  const dashOffset = circumference - progress;

  const getLocalizedVerdict = (verdict: string) => {
    const normalized = verdict.toUpperCase();
    if (
      normalized === 'HOAX' ||
      normalized.includes('HOAKS') ||
      normalized.includes('HOAX') ||
      normalized.includes('FAKE') ||
      normalized.includes('FALSE')
    ) {
      return { label: t.verdict_hoax, statusClass: styles.verdictBadgeDanger };
    }
    if (
      normalized === 'UNVERIFIED' ||
      normalized.includes('UNVERIFIED') ||
      normalized.includes('BELUM TERVERIFIKASI')
    ) {
      return { label: t.verdict_unverified, statusClass: styles.verdictBadgeNeutral };
    }
    if (
      normalized === 'VERIFIED' ||
      normalized.includes('FAKTA') ||
      normalized.includes('FACT') ||
      normalized.includes('TRUE')
    ) {
      return { label: t.verdict_fakta, statusClass: styles.verdictBadgeSuccess };
    }
    if (
      normalized === 'MISLEADING' ||
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
      normalized === 'HOAX' ||
      normalized.includes('HOAKS') ||
      normalized.includes('HOAX') ||
      normalized.includes('FAKE') ||
      normalized.includes('FALSE')
    ) {
      return styles.verdictHOAKS;
    }
    if (
      normalized === 'UNVERIFIED' ||
      normalized.includes('UNVERIFIED') ||
      normalized.includes('BELUM TERVERIFIKASI')
    ) {
      return styles.verdictUNKNOWN;
    }
    if (
      normalized === 'VERIFIED' ||
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

  const verdictConfig = getLocalizedVerdict(overallVerdict);
  const totalClaimsCount = claims.length > 0 ? claims.length : claimAssessments.length;

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
              {getConfidenceLabel(report.confidenceLevel)} ({confidenceScore}%)
            </span>
          </div>
          <div className={styles.scoreDetail}>
            {t.claimsAnalyzed}: <strong>{totalClaimsCount}</strong>
          </div>
          <div className={styles.scoreDetail}>
            {t.sourcesFound}: <strong>{evidenceSources.length}</strong>
          </div>
          {report.cached && (
            <div className={styles.scoreDetail}>
              <span className={`${styles.confidenceBadge} ${styles.confidenceMedium}`}>
                {t.cachedResult}
              </span>
            </div>
          )}
        </div>
      </section>

      <section className={styles.summary} aria-labelledby="summary-title">
        <h3 id="summary-title" className={styles.sectionTitle}>
          {t.summary}
        </h3>
        <p className={styles.summaryText}>{report.summary}</p>
      </section>

      {signals && (
        <section className={styles.claimsSection} aria-labelledby="signals-title">
          <h3 id="signals-title" className={styles.sectionTitle}>
            {t.journalisticSignals}
          </h3>
          <div className={styles.claimCard}>
            <div className={styles.claimHeader}>
              <div className={styles.claimText}>{t.signalClickbait}</div>
              <span
                className={`${styles.claimVerdict} ${
                  signals.clickbait.detected ? styles.verdictMISLEADING : styles.verdictFAKTA
                }`}
              >
                {signals.clickbait.severity}
              </span>
            </div>
            <p className={styles.claimExplanation}>{signals.clickbait.reason}</p>
          </div>
          <div className={styles.claimCard}>
            <div className={styles.claimHeader}>
              <div className={styles.claimText}>{t.signalTemporal}</div>
              <span
                className={`${styles.claimVerdict} ${
                  signals.temporalContext.status === 'CURRENT'
                    ? styles.verdictFAKTA
                    : signals.temporalContext.status === 'OUTDATED_RECYCLED'
                      ? styles.verdictHOAKS
                      : styles.verdictUNKNOWN
                }`}
              >
                {signals.temporalContext.status}
              </span>
            </div>
            <p className={styles.claimExplanation}>
              {signals.temporalContext.publishedDate
                ? `${signals.temporalContext.publishedDate} — `
                : ''}
              {signals.temporalContext.reason}
            </p>
          </div>
          <div className={styles.claimCard}>
            <div className={styles.claimHeader}>
              <div className={styles.claimText}>{t.signalAttribution}</div>
              <span
                className={`${styles.claimVerdict} ${
                  signals.sourceAttribution.clarity === 'CLEAR'
                    ? styles.verdictFAKTA
                    : signals.sourceAttribution.clarity === 'PARTIAL'
                      ? styles.verdictMISLEADING
                      : styles.verdictHOAKS
                }`}
              >
                {signals.sourceAttribution.clarity}
              </span>
            </div>
            <p className={styles.claimExplanation}>{signals.sourceAttribution.reason}</p>
          </div>
        </section>
      )}

      {(redFlags.length > 0 || positiveIndicators.length > 0) && (
        <section className={styles.findingsSection} aria-label={t.summary}>
          {redFlags.length > 0 && (
            <div className={`${styles.findingsList} ${styles.redFlagsList}`}>
              <h3 className={`${styles.findingsListTitle} ${styles.red}`}>{t.redFlags}</h3>
              <ul className={styles.findingsItems}>
                {redFlags.map((flag, i) => (
                  <li key={i} className={styles.findingItem}>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {positiveIndicators.length > 0 && (
            <div className={`${styles.findingsList} ${styles.positiveList}`}>
              <h3 className={`${styles.findingsListTitle} ${styles.green}`}>
                {t.positiveIndicators}
              </h3>
              <ul className={styles.findingsItems}>
                {positiveIndicators.map((indicator, i) => (
                  <li key={i} className={styles.findingItem}>
                    {indicator}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {claims.length > 0 ? (
        <section className={styles.claimsSection} aria-labelledby="claims-title">
          <h3 id="claims-title" className={styles.sectionTitle}>
            {t.claimsAssessment}
          </h3>
          {claims.map((claim) => {
            const localizedStatus = getLocalizedVerdict(claim.status);
            return (
              <article key={claim.id} className={styles.claimCard}>
                <div className={styles.claimHeader}>
                  <div className={styles.claimText}>&ldquo;{claim.statement}&rdquo;</div>
                  <span
                    className={`${styles.claimVerdict} ${getClaimVerdictClass(claim.status)}`}
                  >
                    {localizedStatus.label} ({claim.confidence}%)
                  </span>
                </div>
                <p className={styles.claimExplanation}>{claim.reasoning}</p>
                {claim.searchQuery && (
                  <div className={styles.inputSource}>
                    {t.searchQueryLabel}: {claim.searchQuery}
                  </div>
                )}
                {(claim.supportingUrls ?? []).length > 0 && (
                  <ul className={styles.findingsItems}>
                    {claim.supportingUrls.map((url) => (
                      <li key={url} className={styles.findingItem}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {t.supportingUrlsLabel}: {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        claimAssessments.length > 0 && (
          <section className={styles.claimsSection} aria-labelledby="claims-title">
            <h3 id="claims-title" className={styles.sectionTitle}>
              {t.claimsAssessment}
            </h3>
            {claimAssessments.map((assessment, i) => (
              <article key={i} className={styles.claimCard}>
                <div className={styles.claimHeader}>
                  <div className={styles.claimText}>&ldquo;{assessment.claim}&rdquo;</div>
                  <span
                    className={`${styles.claimVerdict} ${getClaimVerdictClass(assessment.verdict)}`}
                  >
                    {getLocalizedVerdict(assessment.verdict).label}
                  </span>
                </div>
                <p className={styles.claimExplanation}>{assessment.explanation}</p>
              </article>
            ))}
          </section>
        )
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
