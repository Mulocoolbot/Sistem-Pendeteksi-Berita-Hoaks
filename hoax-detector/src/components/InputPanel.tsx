'use client';

import { useState, useRef, useCallback } from 'react';
import styles from './InputPanel.module.css';
import { fileToBase64 } from '@/lib/utils/sanitize';
import type { InvestigationReport } from '@/lib/types';

interface InputPanelProps {
  onAnalysisStart: () => void;
  onAnalysisComplete: (report: InvestigationReport) => void;
  onAnalysisError: (error: string) => void;
  onStepChange: (step: string) => void;
  isAnalyzing: boolean;
}

export default function InputPanel({
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  onStepChange,
  isAnalyzing,
}: InputPanelProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'image'>('url');
  const [url, setUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL submission
  const handleUrlSubmit = useCallback(async () => {
    if (!url.trim()) {
      setError('Masukkan URL berita terlebih dahulu.');
      return;
    }

    setError(null);
    onAnalysisStart();

    try {
      onStepChange('extracting');
      const response = await fetch('/api/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analisis gagal.');
      }

      onStepChange('complete');
      onAnalysisComplete(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(message);
      onAnalysisError(message);
    }
  }, [url, onAnalysisStart, onAnalysisComplete, onAnalysisError, onStepChange]);

  // Handle Image submission
  const handleImageSubmit = useCallback(async () => {
    if (!imageFile) {
      setError('Upload gambar berita terlebih dahulu.');
      return;
    }

    setError(null);
    onAnalysisStart();

    try {
      onStepChange('extracting');
      const base64 = await fileToBase64(imageFile);

      const response = await fetch('/api/analyze/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: imageFile.type,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analisis gambar gagal.');
      }

      onStepChange('complete');
      onAnalysisComplete(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(message);
      onAnalysisError(message);
    }
  }, [imageFile, onAnalysisStart, onAnalysisComplete, onAnalysisError, onStepChange]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (PNG, JPEG, atau WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran file maksimal 10MB.');
      return;
    }
    setError(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers
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

  const handleSubmit = () => {
    if (activeTab === 'url') {
      handleUrlSubmit();
    } else {
      handleImageSubmit();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className={styles.panel}>
      {/* Tab Bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'url' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('url'); setError(null); }}
          disabled={isAnalyzing}
        >
          🔗 URL Berita
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'image' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('image'); setError(null); }}
          disabled={isAnalyzing}
        >
          🖼️ Gambar Berita
        </button>
      </div>

      {/* URL Input */}
      {activeTab === 'url' && (
        <div className={styles.inputGroup}>
          <div className={styles.urlWrapper}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span className={styles.urlIcon}>🔍</span>
              <input
                type="url"
                className={styles.urlInput}
                placeholder="Masukkan URL berita... (contoh: https://example.com/berita)"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isAnalyzing && handleSubmit()}
                disabled={isAnalyzing}
                id="url-input"
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Upload */}
      {activeTab === 'image' && (
        <div className={styles.inputGroup}>
          {!imageFile ? (
            <div
              className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className={styles.dropzoneIcon}>📷</span>
              <p className={styles.dropzoneText}>
                <strong>Klik untuk upload</strong> atau seret gambar ke sini
              </p>
              <p className={styles.dropzoneHint}>
                PNG, JPEG, WebP — Maks 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={e => {
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
                  alt="Preview"
                  className={styles.previewImage}
                />
              )}
              <div className={styles.previewInfo}>
                <div className={styles.previewName}>{imageFile.name}</div>
                <div className={styles.previewSize}>
                  {formatFileSize(imageFile.size)}
                </div>
              </div>
              {!isAnalyzing && (
                <button
                  className={styles.previewRemove}
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                >
                  ✕ Hapus
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <div className={styles.submitWrapper}>
        <button
          className={`btn btn-primary ${styles.submitBtn}`}
          onClick={handleSubmit}
          disabled={isAnalyzing || (activeTab === 'url' ? !url.trim() : !imageFile)}
          id="submit-btn"
        >
          {isAnalyzing ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              Menganalisis...
            </>
          ) : (
            <>
              🔍 Investigasi Sekarang
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
