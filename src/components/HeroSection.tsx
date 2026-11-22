'use client';

import { useSyncExternalStore } from 'react';
import BrandMark from '@/components/BrandMark';
import LanguageSelector from '@/components/LanguageSelector';
import styles from './HeroSection.module.css';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface HeroSectionProps {
  language: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
}

const emptySubscribe = () => () => {};

function formatEditionDate(date: Date, language: LanguageCode): string {
  const locale = language === 'id' ? 'id-ID' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function HeroSection({ language, onLanguageChange }: HeroSectionProps) {
  const t = TRANSLATIONS[language];
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const editionDate = isClient ? formatEditionDate(new Date(), language) : '';

  return (
    <section className={styles.masthead} aria-labelledby="hero-heading">
      <div className={styles.mastheadGrid}>
        <div className={styles.zoneLeft}>
          <time className={styles.editionDate} suppressHydrationWarning>
            {editionDate || '\u00A0'}
          </time>
          <span className={styles.deskLabel}>{t.deskLabel}</span>
        </div>

        <div className={styles.zoneCenter}>
          <div className={styles.brandRow}>
            <BrandMark size={44} className={styles.brandMark} />
            <h1 id="hero-heading" className={styles.title}>
              {t.titleMain}
            </h1>
          </div>
          <p className={styles.titleSub}>{t.titleSub}</p>
        </div>

        <div className={styles.zoneRight}>
          {onLanguageChange && (
            <LanguageSelector
              currentLanguage={language}
              onLanguageChange={onLanguageChange}
            />
          )}
          <span className={styles.editionLabel}>{t.editionLabel}</span>
        </div>
      </div>

      <div className={styles.deckBand}>
        <p className={styles.subtitle}>{t.subtitle}</p>
        <ul className={styles.features} aria-label={t.featuresLabel}>
          <li className={styles.feature}>{t.featureUrl}</li>
          <li className={styles.feature}>{t.featureImg}</li>
          <li className={styles.feature}>{t.featureLang}</li>
          <li className={styles.feature}>{t.featureEngine}</li>
        </ul>
      </div>

      <div className={styles.doubleRule} aria-hidden="true" />
    </section>
  );
}
