'use client';

import styles from './EvidenceList.module.css';
import type { CredibilityTier, InvestigationReport } from '@/lib/types';
import { getDomain } from '@/lib/utils/sanitize';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface EvidenceListProps {
  report: InvestigationReport;
  language: LanguageCode;
}

export default function EvidenceList({ report, language }: EvidenceListProps) {
  const t = TRANSLATIONS[language];
  const evidenceSources = report.evidenceSources ?? [];
  const factCheckResults = report.factCheckResults ?? [];

  const getStanceBadgeClass = (stance: string) => {
    switch (stance.toLowerCase()) {
      case 'supports':
        return styles.badgeSupports;
      case 'contradicts':
        return styles.badgeContradicts;
      default:
        return styles.badgeNeutral;
    }
  };

  const getCredibilityBadgeClass = (tier?: CredibilityTier) => {
    switch (tier) {
      case 'TIER_1':
        return styles.badgeTier1;
      case 'TIER_2':
        return styles.badgeTier2;
      default:
        return styles.badgeTier3;
    }
  };

  const getTierLabel = (tier?: CredibilityTier, fallbackLabel?: string) => {
    switch (tier) {
      case 'TIER_1':
        return t.tier_1_label;
      case 'TIER_2':
        return t.tier_2_label;
      case 'TIER_3':
        return t.tier_3_label;
      default:
        return fallbackLabel || '';
    }
  };

  const getStanceLabel = (stance: string) => {
    switch (stance.toLowerCase()) {
      case 'supports':
        return t.stance_supports;
      case 'contradicts':
        return t.stance_contradicts;
      default:
        return t.stance_neutral;
    }
  };

  return (
    <div className={styles.evidenceWrapper}>
      {factCheckResults.length > 0 && (
        <section className={styles.sectionBlock} aria-labelledby="factcheck-title">
          <h3 id="factcheck-title" className={styles.kickerHeading}>
            {t.officialFactCheck}
          </h3>
          <div className={styles.listStack}>
            {factCheckResults.map((fc, i) => (
              <article key={i} className={styles.factCheckItem}>
                <p className={styles.factCheckClaim}>
                  &ldquo;{fc.text}&rdquo;
                  {fc.claimant && (
                    <span className={styles.factCheckClaimant}> — {fc.claimant}</span>
                  )}
                </p>
                {fc.reviews.map((review, j) => (
                  <div key={j} className={styles.factCheckReview}>
                    <span className={styles.reviewRating}>{review.rating}</span>
                    <span className={styles.reviewPublisher}>
                      {t.reviewedBy} {review.publisher}
                    </span>
                    {(review.credibilityTier || review.credibilityLabel) && (
                      <span
                        className={`${styles.metaBadge} ${getCredibilityBadgeClass(
                          review.credibilityTier
                        )}`}
                      >
                        {getTierLabel(review.credibilityTier, review.credibilityLabel)}
                      </span>
                    )}
                    {review.url && (
                      <a
                        href={review.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.externalLink}
                      >
                        {t.readFullSource}
                      </a>
                    )}
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className={styles.sectionBlock} aria-labelledby="evidence-title">
        <div className={styles.sectionHeaderRow}>
          <h3 id="evidence-title" className={styles.kickerHeading}>
            {t.foundSources}
          </h3>
          <span className={styles.countMeta}>({evidenceSources.length})</span>
        </div>

        {evidenceSources.length > 0 ? (
          <ol className={styles.evidenceList}>
            {evidenceSources.map((source, i) => {
              const domainLabel = source.siteName || getDomain(source.url);
              const tierLabel = getTierLabel(source.credibilityTier, source.credibilityLabel);

              return (
                <li key={`${source.url}-${i}`} className={styles.evidenceItem}>
                  <div className={styles.badgeRow}>
                    <span className={`${styles.metaBadge} ${getStanceBadgeClass(source.stance)}`}>
                      {getStanceLabel(source.stance)}
                    </span>
                    <span
                      className={`${styles.metaBadge} ${getCredibilityBadgeClass(
                        source.credibilityTier
                      )}`}
                    >
                      {tierLabel}
                    </span>
                  </div>

                  <h4 className={styles.evidenceTitle}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.externalLink}
                    >
                      {source.title}
                    </a>
                  </h4>

                  <div className={styles.evidenceMeta}>
                    <span className={styles.evidenceSite}>{domainLabel}</span>
                    {source.publishedDate && (
                      <span className={styles.evidenceDate}>{source.publishedDate}</span>
                    )}
                    {source.similarityScore > 0 && (
                      <span className={styles.similarityScore}>
                        {t.similarity}: {source.similarityScore}%
                      </span>
                    )}
                  </div>

                  {source.snippet && (
                    <p className={styles.evidenceSnippet}>{source.snippet}</p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className={styles.emptyState}>{t.noSources}</div>
        )}
      </section>
    </div>
  );
}
