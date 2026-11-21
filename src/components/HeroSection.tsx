import styles from './HeroSection.module.css';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface HeroSectionProps {
  language: LanguageCode;
}

export default function HeroSection({ language }: HeroSectionProps) {
  const t = TRANSLATIONS[language];

  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.badge}>{t.badge}</div>

      <h1 id="hero-heading" className={styles.title}>
        {t.titleMain}
        <br />
        <span className={styles.titleEmphasis}>{t.titleSub}</span>
      </h1>

      <p className={styles.subtitle}>{t.subtitle}</p>

      <ul className={styles.features}>
        <li className={styles.feature}>{t.featureUrl}</li>
        <li className={styles.feature}>{t.featureImg}</li>
        <li className={styles.feature}>{t.featureLang}</li>
        <li className={styles.feature}>{t.featureEngine}</li>
      </ul>
    </section>
  );
}
