'use client';

import styles from './LanguageSelector.module.css';
import { LANGUAGES, TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface LanguageSelectorProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

export default function LanguageSelector({
  currentLanguage,
  onLanguageChange,
}: LanguageSelectorProps) {
  const t = TRANSLATIONS[currentLanguage];

  return (
    <nav className={styles.wrapper} aria-label={t.langNavLabel}>
      <div className={styles.toggleGroup} role="group" aria-label={t.langNavLabel}>
        {LANGUAGES.map((lang, index) => {
          const isActive = lang.code === currentLanguage;
          return (
            <span key={lang.code} className={styles.item}>
              {index > 0 && (
                <span className={styles.divider} aria-hidden="true">
                  |
                </span>
              )}
              <button
                type="button"
                onClick={() => onLanguageChange(lang.code)}
                className={`${styles.toggleButton} ${isActive ? styles.toggleButtonActive : ''}`}
                aria-pressed={isActive}
                aria-label={lang.name}
                title={lang.name}
              >
                {lang.code.toUpperCase()}
              </button>
            </span>
          );
        })}
      </div>
    </nav>
  );
}
