'use client';

import styles from './HeroSection.module.css';

export default function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.badge}>
        <span className={styles.badgeDot} />
        AI-Powered Fact Checker
      </div>

      <h1 className={styles.title}>
        Deteksi{' '}
        <span className={styles.titleGradient}>Berita Hoaks</span>
        <br />
        dalam Hitungan Detik
      </h1>

      <p className={styles.subtitle}>
        Masukkan URL berita atau upload gambar berita yang mencurigakan.
        Sistem AI kami akan menganalisis, mencari sumber terpercaya,
        dan memberikan investigasi mendalam tentang keaslian berita tersebut.
      </p>

      <div className={styles.features}>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🔗</span>
          Analisis URL
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🖼️</span>
          Deteksi Gambar
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🌐</span>
          Multi-Bahasa
        </div>
        <div className={styles.feature}>
          <span className={styles.featureIcon}>🤖</span>
          Groq AI
        </div>
      </div>
    </section>
  );
}
