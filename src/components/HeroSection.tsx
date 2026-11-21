import styles from './HeroSection.module.css';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface HeroSectionProps {
  language: LanguageCode;
}

export default function HeroSection({ language }: HeroSectionProps) {
  const t = TRANSLATIONS[language];

  return (
    <section className={styles.hero}>
      <div className={styles.badge}>
        <span className={styles.badgeDot} />
        {t.badge}
      </div>

      <h1 className={styles.title}>
        {t.titleMain}
        <br />
        <span className={styles.titleGradient}>{t.titleSub}</span>
      </h1>

      <p className={styles.subtitle}>{t.subtitle}</p>

      <div className={styles.features}>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🔗</span>
          {t.featureUrl}
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🖼️</span>
          {t.featureImg}
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🌐</span>
          {t.featureLang}
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🤖</span>
          {t.featureEngine}
        </div>
      </div>
    </section>
  );
}
