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
  const buttonRef = useRef<HTMLButtonElement>(null);

  const activeLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <nav className={styles.wrapper} aria-label="Language selection">
      <div className={styles.selectorContainer} ref={dropdownRef}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={styles.selectorButton}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Language: ${activeLang.name}`}
        >
          <span className={styles.langCode}>{activeLang.code.toUpperCase()}</span>
          <span>{activeLang.name}</span>
          <svg
            className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {isOpen && (
          <div className={styles.dropdown} role="listbox">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
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
                <span className={styles.langCode}>{lang.code.toUpperCase()}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
