'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './LanguageSelector.module.css';
import { LANGUAGES, type LanguageCode } from '@/lib/utils/translations';

interface LanguageSelectorProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

export default function LanguageSelector({
  currentLanguage,
  onLanguageChange,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={styles.selectorButton}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={styles.flag}>{activeLang.flag}</span>
        <span>{activeLang.name}</span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                onLanguageChange(lang.code);
                setIsOpen(false);
              }}
              className={`${styles.option} ${
                lang.code === currentLanguage ? styles.optionActive : ''
              }`}
              role="option"
              aria-selected={lang.code === currentLanguage}
            >
              <span className={styles.flag}>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
