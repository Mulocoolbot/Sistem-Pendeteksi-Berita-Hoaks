'use client';

import EvidenceList from '@/components/EvidenceList';
import styles from './ResultCard.module.css';
import type { InvestigationReport } from '@/lib/types';
import { formatDate } from '@/lib/utils/sanitize';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface ResultCardProps {
  report: InvestigationReport;
  language: LanguageCode;
}

function formatCompactUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    const combined = `${host}${path}`;
    return combined.length > 64 ? `${combined.slice(0, 61)}...` : combined;
  } catch {
    return rawUrl;
  }
}

export default function ResultCard({ report, language }: ResultCardProps) {
  const t = TRANSLATIONS[language];
  const overallVerdict = report.verdict ?? report.overallVerdict;
  const confidenceScore = report.confidenceScore ?? report.credibilityScore;
  const claims = report.claims ?? [];
  const claimAssessments = report.claimAssessments ?? [];
  const redFlags = report.redFlags ?? [];
  const positiveIndicators = report.positiveIndicators ?? [];
  const evidenceSources = report.evidenceSources ?? [];
  const signals = report.signals;
  const aiAudit = report.aiAudit;
  const providerStatus = report.providerStatus;

  const getLocalizedVerdict = (verdict: string) => {
    const normalized = verdict.toUpperCase();
    if (
      normalized === 'HOAX' ||
      normalized.includes('HOAKS') ||
      normalized.includes('HOAX') ||
      normalized.includes('FAKE') ||
      normalized.includes('FALSE')
    ) {
      return { label: t.verdict_hoax, statusClass: styles.verdictHoax };
    }
    if (
      normalized === 'UNVERIFIED' ||
      normalized.includes('UNVERIFIED') ||
      normalized.includes('BELUM TERVERIFIKASI')
    ) {
      return { label: t.verdict_unverified, statusClass: styles.verdictUnverified };
    }
    if (
      normalized === 'VERIFIED' ||
      normalized.includes('FAKTA') ||
      normalized.includes('FACT') ||
      normalized.includes('TRUE')
    ) {
      return { label: t.verdict_fakta, statusClass: styles.verdictVerified };
    }
    if (
      normalized === 'MISLEADING' ||
      normalized.includes('MISLEADING') ||
      normalized.includes('CAMPURAN') ||
      normalized.includes('NETRAL') ||
      normalized.includes('MIXED') ||
      normalized.includes('NEUTRAL')
    ) {
      return { label: t.verdict_neutral, statusClass: styles.verdictMisleading };
    }
    return { label: t.verdict_unverified, statusClass: styles.verdictUnverified };
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

  const getSeverityLabel = (severity: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (severity) {
      case 'HIGH':
        return t.severity_high;
      case 'MEDIUM':
        return t.severity_medium;
      default:
        return t.severity_low;
    }
  };

  const getTemporalLabel = (
    status: 'CURRENT' | 'OUTDATED_RECYCLED' | 'UNDATED' | 'UNCLEAR'
  ) => {
    switch (status) {
      case 'CURRENT':
        return t.temporal_current;
      case 'OUTDATED_RECYCLED':
        return t.temporal_outdated;
      case 'UNDATED':
        return t.temporal_undated;
      default:
        return t.temporal_unclear;
    }
  };

  const getAttributionLabel = (
    clarity: 'CLEAR' | 'PARTIAL' | 'ANONYMOUS_OR_MISSING'
  ) => {
    switch (clarity) {
      case 'CLEAR':
        return t.attr_clear;
      case 'PARTIAL':
        return t.attr_partial;
      default:
        return t.attr_missing;
    }
  };

  const verdictConfig = getLocalizedVerdict(overallVerdict);
  const totalClaimsCount = claims.length > 0 ? claims.length : claimAssessments.length;

  return (
    <article
      className={`${styles.broadsheet} fc-fade-up`}
      id="result-card"
      aria-labelledby="result-title"
    >
      <div className={styles.mainColumn}>
        <header className={styles.reportHeader}>
          <div className={styles.verdictStrip}>
            <span className={`${styles.verdictStamp} ${verdictConfig.statusClass}`}>
              {verdictConfig.label}
            </span>
            <div className={styles.scoreMetrics}>
              <span className={styles.metricPill}>
                {t.confidence}: <strong>{confidenceScore}%</strong> (
                {getConfidenceLabel(report.confidenceLevel)})
              </span>
              <span className={styles.metricPill}>
                {t.credibilityScore}: <strong>{report.credibilityScore}/100</strong>
              </span>
            </div>
            {report.cached && (
              <span className={styles.cachedBadge}>{t.cachedResult}</span>
            )}
          </div>

          <h2 id="result-title" className={styles.articleTitle}>
            {report.articleTitle}
          </h2>

          <div className={styles.datelineBar}>
            <span>{formatDate(report.analyzedAt, language)}</span>
            <span>{(report.analysisTimeMs / 1000).toFixed(1)}s</span>
            <span>
              {totalClaimsCount} {t.claimsAnalyzed}
            </span>
            <span>
              {evidenceSources.length} {t.sourcesFound}
            </span>
          </div>

          <div className={styles.inputSource}>{report.inputValue}</div>
        </header>

        <section className={styles.summarySection} aria-labelledby="summary-title">
          <h3 id="summary-title" className={styles.sectionKicker}>
            {t.summary}
          </h3>
          <p className={styles.summaryText}>{report.summary}</p>
        </section>

        {(redFlags.length > 0 || positiveIndicators.length > 0) && (
          <section className={styles.indicatorsGrid} aria-label={t.summary}>
            {redFlags.length > 0 && (
              <div className={`${styles.indicatorBox} ${styles.indicatorDanger}`}>
                <h3 className={`${styles.indicatorTitle} ${styles.indicatorTitleDanger}`}>
                  {t.redFlags}
                </h3>
                <ul className={styles.indicatorList}>
                  {redFlags.map((flag, i) => (
                    <li key={i} className={styles.indicatorItem}>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {positiveIndicators.length > 0 && (
              <div className={`${styles.indicatorBox} ${styles.indicatorSuccess}`}>
                <h3 className={`${styles.indicatorTitle} ${styles.indicatorTitleSuccess}`}>
                  {t.positiveIndicators}
                </h3>
                <ul className={styles.indicatorList}>
                  {positiveIndicators.map((indicator, i) => (
                    <li key={i} className={styles.indicatorItem}>
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
            <h3 id="claims-title" className={styles.sectionHeading}>
              {t.claimsAssessment}
            </h3>
            <ol className={styles.claimsList}>
              {claims.map((claim, index) => {
                const localizedStatus = getLocalizedVerdict(claim.status);
                const claimNumber = String(index + 1).padStart(2, '0');
                return (
                  <li key={claim.id} className={styles.claimItem}>
                    <div className={styles.claimMetaRow}>
                      <span className={styles.claimNumber}>{claimNumber}</span>
                      <div className={styles.claimBadges}>
                        <span
                          className={`${styles.claimStatusStamp} ${localizedStatus.statusClass}`}
                        >
                          {localizedStatus.label}
                        </span>
                        <span className={styles.claimConfidence}>
                          {claim.confidence}%
                        </span>
                      </div>
                    </div>

                    <h4 className={styles.claimStatement}>
                      &ldquo;{claim.statement}&rdquo;
                    </h4>

                    <p className={styles.claimReasoning}>{claim.reasoning}</p>

                    {(claim.supportingUrls ?? []).length > 0 && (
                      <ul className={styles.supportingLinks}>
                        {claim.supportingUrls.map((url) => (
                          <li key={url} className={styles.supportingLinkItem}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.supportingLink}
                              title={url}
                            >
                              {formatCompactUrl(url)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          claimAssessments.length > 0 && (
            <section className={styles.claimsSection} aria-labelledby="claims-title">
              <h3 id="claims-title" className={styles.sectionHeading}>
                {t.claimsAssessment}
              </h3>
              <ol className={styles.claimsList}>
                {claimAssessments.map((assessment, index) => {
                  const localizedStatus = getLocalizedVerdict(assessment.verdict);
                  const claimNumber = String(index + 1).padStart(2, '0');
                  return (
                    <li key={index} className={styles.claimItem}>
                      <div className={styles.claimMetaRow}>
                        <span className={styles.claimNumber}>{claimNumber}</span>
                        <span
                          className={`${styles.claimStatusStamp} ${localizedStatus.statusClass}`}
                        >
                          {localizedStatus.label}
                        </span>
                      </div>
                      <h4 className={styles.claimStatement}>
                        &ldquo;{assessment.claim}&rdquo;
                      </h4>
                      <p className={styles.claimReasoning}>{assessment.explanation}</p>
                    </li>
                  );
                })}
              </ol>
            </section>
          )
        )}
      </div>

      <aside className={styles.sidebarColumn} aria-label={t.foundSources}>
        <EvidenceList report={report} language={language} />

        {signals && (
          <details className={styles.editorialDetails}>
            <summary className={styles.editorialSummary}>
              <span>{t.journalisticSignals}</span>
              <span className={styles.detailsChevron} aria-hidden="true" />
            </summary>
            <div className={styles.detailsBody}>
              <div className={styles.signalRow}>
                <div className={styles.signalHeader}>
                  <span className={styles.signalName}>{t.signalClickbait}</span>
                  <span
                    className={`${styles.signalBadge} ${
                      signals.clickbait.detected
                        ? styles.verdictMisleading
                        : styles.verdictVerified
                    }`}
                  >
                    {getSeverityLabel(signals.clickbait.severity)}
                  </span>
                </div>
                <p className={styles.signalReason}>{signals.clickbait.reason}</p>
              </div>

              <div className={styles.signalRow}>
                <div className={styles.signalHeader}>
                  <span className={styles.signalName}>{t.signalTemporal}</span>
                  <span
                    className={`${styles.signalBadge} ${
                      signals.temporalContext.status === 'CURRENT'
                        ? styles.verdictVerified
                        : signals.temporalContext.status === 'OUTDATED_RECYCLED'
                          ? styles.verdictHoax
                          : styles.verdictUnverified
                    }`}
                  >
                    {getTemporalLabel(signals.temporalContext.status)}
                  </span>
                </div>
                <p className={styles.signalReason}>
                  {signals.temporalContext.publishedDate
                    ? `${signals.temporalContext.publishedDate} — `
                    : ''}
                  {signals.temporalContext.reason}
                </p>
              </div>

              <div className={styles.signalRow}>
                <div className={styles.signalHeader}>
                  <span className={styles.signalName}>{t.signalAttribution}</span>
                  <span
                    className={`${styles.signalBadge} ${
                      signals.sourceAttribution.clarity === 'CLEAR'
                        ? styles.verdictVerified
                        : signals.sourceAttribution.clarity === 'PARTIAL'
                          ? styles.verdictMisleading
                          : styles.verdictHoax
                    }`}
                  >
                    {getAttributionLabel(signals.sourceAttribution.clarity)}
                  </span>
                </div>
                <p className={styles.signalReason}>{signals.sourceAttribution.reason}</p>
              </div>
            </div>
          </details>
        )}

        {aiAudit && (
          <details className={styles.editorialDetails}>
            <summary className={styles.editorialSummary}>
              <span>{t.aiAuditTitle}</span>
              <span className={styles.detailsChevron} aria-hidden="true" />
            </summary>
            <div className={styles.detailsBody}>
              <dl className={styles.auditList}>
                <div className={styles.auditItem}>
                  <dt className={styles.auditTerm}>{t.auditModel}</dt>
                  <dd className={styles.auditValue}>{aiAudit.modelUsed}</dd>
                </div>
                <div className={styles.auditItem}>
                  <dt className={styles.auditTerm}>{t.auditReranker}</dt>
                  <dd className={styles.auditValue}>{aiAudit.rerankerUsed.toUpperCase()}</dd>
                </div>
                <div className={styles.auditItem}>
                  <dt className={styles.auditTerm}>{t.auditSelfCritique}</dt>
                  <dd className={styles.auditValue}>
                    {aiAudit.selfCritiqueAdjusted ? t.auditAdjustedYes : t.auditAdjustedNo}
                  </dd>
                </div>
              </dl>
              {aiAudit.auditNote && (
                <div className={styles.auditNoteBox}>
                  <span className={styles.auditNoteLabel}>{t.auditNoteLabel}</span>
                  <p className={styles.auditNoteText}>{aiAudit.auditNote}</p>
                </div>
              )}
            </div>
          </details>
        )}

        {providerStatus && providerStatus.warnings.length > 0 && (
          <details className={`${styles.editorialDetails} ${styles.editorialDetailsWarning}`}>
            <summary className={styles.editorialSummary}>
              <span>
                {t.providerWarningsTitle} ({providerStatus.warnings.length})
              </span>
              <span className={styles.detailsChevron} aria-hidden="true" />
            </summary>
            <div className={styles.detailsBody}>
              <div className={styles.providerMetaRow}>
                <span>
                  {t.providerSearchLabel}: {providerStatus.search}
                </span>
                <span>
                  {t.providerScraperLabel}: {providerStatus.scraper}
                </span>
                <span>
                  {t.providerFactcheckLabel}: {providerStatus.factcheck}
                </span>
              </div>
              <ul className={styles.warningList}>
                {providerStatus.warnings.map((warning, idx) => (
                  <li key={idx} className={styles.warningItem}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </aside>
    </article>
  );
}
