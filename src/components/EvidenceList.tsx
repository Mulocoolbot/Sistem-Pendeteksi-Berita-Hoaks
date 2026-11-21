'use client';

import styles from './EvidenceList.module.css';
import type { InvestigationReport } from '@/lib/types';
import { getDomain } from '@/lib/utils/sanitize';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface EvidenceListProps {
  report: InvestigationReport;
  language: LanguageCode;
}

export default function EvidenceList({ report, language }: EvidenceListProps) {
  const t = TRANSLATIONS[language];
  const { evidenceSources, factCheckResults } = report;

  const getStanceClass = (stance: string) => {
    switch (stance.toLowerCase()) {
      case 'supports': return styles.stanceSupports;
      case 'contradicts': return styles.stanceContradicts;
      default: return styles.stanceNeutral;
    }
  };

  const getBadgeClass = (stance: string) => {
    switch (stance.toLowerCase()) {
      case 'supports': return styles.badgeSupports;
      case 'contradicts': return styles.badgeContradicts;
      default: return styles.badgeNeutral;
    }
  };

  const getStanceLabel = (stance: string) => {
    switch (stance.toLowerCase()) {
      case 'supports': return t.stance_supports;
      case 'contradicts': return t.stance_contradicts;
      default: return t.stance_neutral;
    }
  };

  return (
    <>
      {/* Fact Check Results (if any) */}
      {factCheckResults.length > 0 && (
        <div className={styles.factCheckSection}>
          <h3 className={styles.sectionTitle}>🏛️ {t.officialFactCheck}</h3>
          {factCheckResults.map((fc, i) => (
            <div key={i} className={styles.factCheckCard}>
              <div className={styles.factCheckClaim}>
                &ldquo;{fc.text}&rdquo;
                {fc.claimant && (
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                    {' '}— {fc.claimant}
                  </span>
                )}
              </div>
              {fc.reviews.map((review, j) => (
                <div key={j} className={styles.factCheckReview}>
                  <span className={styles.reviewRating}>{review.rating}</span>
                  <span>{language === 'id' ? 'oleh' : 'by'} {review.publisher}</span>
                  {review.url && (
                    <a
                      href={review.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.reviewLink}
                    >
                      {language === 'id' ? 'Baca' : 'Read'} →
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Evidence Sources */}
      <div className={styles.evidenceSection}>
        <h3 className={styles.sectionTitle}>
          🌐 {t.foundSources} ({evidenceSources.length})
        </h3>

        {evidenceSources.length > 0 ? (
          <div className={styles.evidenceGrid}>
            {evidenceSources.map((source, i) => (
              <a
                key={i}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.evidenceCard}
              >
                <div className={`${styles.stanceIndicator} ${getStanceClass(source.stance)}`} />
                <div className={styles.evidenceContent}>
                  <div className={styles.evidenceHeader}>
                    <div className={styles.evidenceTitle}>{source.title}</div>
                    <span className={`${styles.stanceBadge} ${getBadgeClass(source.stance)}`}>
                      {getStanceLabel(source.stance)}
                    </span>
                  </div>
                  <div className={styles.evidenceMeta}>
                    <span className={styles.evidenceSite}>
                      🌐 {source.siteName || getDomain(source.url)}
                    </span>
                    {source.publishedDate && (
                      <span>📅 {source.publishedDate}</span>
                    )}
                  </div>
                  <div className={styles.evidenceSnippet}>{source.snippet}</div>
                  {source.similarityScore > 0 && (
                    <div className={styles.similarityBar}>
                      <span>{t.similarity}:</span>
                      <div className={styles.similarityTrack}>
                        <div
                          className={styles.similarityFill}
                          style={{
                            width: `${source.similarityScore}%`,
                            background: source.similarityScore > 70
                              ? 'var(--accent-green)'
                              : source.similarityScore > 40
                                ? 'var(--accent-amber)'
                                : 'var(--accent-blue)',
                          }}
                        />
                      </div>
                      <span>{source.similarityScore}%</span>
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {t.noSources}
          </div>
        )}
      </div>
    </>
  );
}
