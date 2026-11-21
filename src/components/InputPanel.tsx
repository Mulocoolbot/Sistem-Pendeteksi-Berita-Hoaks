'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './InputPanel.module.css';
import { TRANSLATIONS, type LanguageCode } from '@/lib/utils/translations';

interface InputPanelProps {
  language: LanguageCode;
  onAnalyzeUrl: (url: string) => Promise<void>;
  onAnalyzeImage: (file: File) => Promise<void>;
  isAnalyzing: boolean;
}

export default function InputPanel({
  language,
  onAnalyzeUrl,
  onAnalyzeImage,
  isAnalyzing,
}: InputPanelProps) {
  const t = TRANSLATIONS[language];
  const [activeTab, setActiveTab] = useState<'url' | 'image'>('url');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = useCallback(async () => {
    if (!url.trim()) {
      setError(
        language === 'id'
          ? 'Masukkan URL berita terlebih dahulu.'
          : 'Please enter a news URL first.'
      );
      return;
    }

    setError(null);
    try {
      await onAnalyzeUrl(url.trim());
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : language === 'id'
            ? 'Terjadi kesalahan.'
            : 'An error occurred.';
      setError(message);
    }
  }, [url, language, onAnalyzeUrl]);

  const handleImageSubmit = useCallback(async () => {
    if (!imageFile) {
      setError(
        language === 'id'
          ? 'Upload gambar berita terlebih dahulu.'
          : 'Please upload a news image first.'
      );
      return;
    }

    setError(null);
    try {
      await onAnalyzeImage(imageFile);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : language === 'id'
            ? 'Terjadi kesalahan.'
            : 'An error occurred.';
      setError(message);
    }
  }, [imageFile, language, onAnalyzeImage]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(
        language === 'id'
          ? 'File harus berupa gambar (PNG, JPEG, atau WebP).'
          : 'File must be an image (PNG, JPEG, or WebP).'
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(
        language === 'id' ? 'Ukuran file maksimal 10MB.' : 'Maximum file size is 10MB.'
      );
      return;
    }
    setError(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAnalyzing) return;
    if (activeTab === 'url') {
      void handleUrlSubmit();
    } else {
      void handleImageSubmit();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <section className={styles.panel} aria-label={activeTab === 'url' ? t.tabUrl : t.tabImg}>
      <div className={styles.tabBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'url'}
          className={`${styles.tab} ${activeTab === 'url' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('url');
            setError(null);
          }}
          disabled={isAnalyzing}
        >
          {t.tabUrl}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'image'}
          className={`${styles.tab} ${activeTab === 'image' ? styles.tabActive : ''}`}
          onClick={() => {
            setActiveTab('image');
            setError(null);
          }}
          disabled={isAnalyzing}
        >
          {t.tabImg}
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {activeTab === 'url' && (
          <div className={styles.inputGroup}>
            <label htmlFor="url-input" className={styles.fieldLabel}>
              {t.tabUrl}
            </label>
            <input
              type="url"
              className={styles.urlInput}
              placeholder={t.urlPlaceholder}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isAnalyzing}
              id="url-input"
            />
          </div>
        )}

        {activeTab === 'image' && (
          <div className={styles.inputGroup}>
            <label htmlFor="image-input" className="sr-only">
              {t.tabImg}
            </label>
            {!imageFile ? (
              <div
                role="button"
                tabIndex={0}
                aria-label={t.dragText}
                className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <p className={styles.dropzoneText}>{t.dragText}</p>
                <p className={styles.dropzoneHint}>{t.dragSubtext}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className={styles.fileInput}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  id="image-input"
                />
              </div>
            ) : (
              <div className={styles.preview}>
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt={imageFile.name}
                    className={styles.previewImage}
                  />
                )}
                <div className={styles.previewInfo}>
                  <div className={styles.previewName}>{imageFile.name}</div>
                  <div className={styles.previewSize}>{formatFileSize(imageFile.size)}</div>
                </div>
                {!isAnalyzing && (
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                  >
                    {language === 'id' ? 'Hapus' : 'Remove'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className={styles.submitWrapper}>
          <button
            type="submit"
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={isAnalyzing || (activeTab === 'url' ? !url.trim() : !imageFile)}
            id="submit-btn"
          >
            {isAnalyzing ? (
              <>
                <svg className={styles.spinnerSvg} viewBox="0 0 50 50" aria-hidden="true">
                  <circle
                    className={styles.spinnerPath}
                    cx="25"
                    cy="25"
                    r="20"
                    fill="none"
                    strokeWidth="5"
                  />
                </svg>
                {t.btnInvestigating}
              </>
            ) : (
              t.btnInvestigate
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className={styles.error} role="alert" aria-live="assertive">
          {error}
        </div>
      )}
    </section>
  );
}
