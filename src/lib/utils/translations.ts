export type LanguageCode = 'en' | 'id';

interface Language {
  code: LanguageCode;
  name: string;
}

interface TranslationDictionary {
  deskLabel: string;
  editionLabel: string;
  langNavLabel: string;
  badge: string;
  titleMain: string;
  titleSub: string;
  subtitle: string;
  featuresLabel: string;
  featureUrl: string;
  featureImg: string;
  featureLang: string;
  featureEngine: string;

  deskKicker: string;
  maxSizeBadge: string;
  tabListLabel: string;
  tabUrl: string;
  tabImg: string;
  urlPlaceholder: string;
  dragText: string;
  dragSubtext: string;
  btnInvestigate: string;
  btnInvestigating: string;
  removeImage: string;
  errEmptyUrl: string;
  errEmptyImg: string;
  errInvalidImgType: string;
  errMaxImgSize: string;
  errGeneric: string;

  dispatchKicker: string;
  timelineTitle: string;
  step_extracting: string;
  step_extracting_desc: string;
  step_analyzing: string;
  step_analyzing_desc: string;
  step_searching: string;
  step_searching_desc: string;
  step_factcheck: string;
  step_factcheck_desc: string;
  step_comparing: string;
  step_comparing_desc: string;
  step_report: string;
  step_report_desc: string;
  statusDone: string;
  statusActive: string;
  statusQueued: string;
  statusFailed: string;
  complete: string;
  error: string;

  reportKicker: string;
  credibilityScore: string;
  confidence: string;
  claimsAnalyzed: string;
  sourcesFound: string;
  summary: string;
  redFlags: string;
  positiveIndicators: string;
  claimsAssessment: string;
  claimLabel: string;
  journalisticSignals: string;
  signalClickbait: string;
  signalTemporal: string;
  signalAttribution: string;
  severity_low: string;
  severity_medium: string;
  severity_high: string;
  temporal_current: string;
  temporal_outdated: string;
  temporal_undated: string;
  temporal_unclear: string;
  attr_clear: string;
  attr_partial: string;
  attr_missing: string;
  tier_1_label: string;
  tier_2_label: string;
  tier_3_label: string;
  aiAuditTitle: string;
  auditModel: string;
  auditReranker: string;
  auditSelfCritique: string;
  auditAdjustedYes: string;
  auditAdjustedNo: string;
  auditNoteLabel: string;
  providerWarningsTitle: string;
  providerSearchLabel: string;
  providerScraperLabel: string;
  providerFactcheckLabel: string;
  searchQueryLabel: string;
  supportingUrlsLabel: string;
  cachedResult: string;
  analyzedAt: string;
  analysisTime: string;
  verdict_hoax: string;
  verdict_fakta: string;
  verdict_neutral: string;
  verdict_unverified: string;
  confidence_low: string;
  confidence_medium: string;
  confidence_high: string;

  officialFactCheck: string;
  foundSources: string;
  stance_supports: string;
  stance_contradicts: string;
  stance_neutral: string;
  similarity: string;
  noSources: string;
  reviewedBy: string;
  readFullSource: string;

  disclaimer: string;
  poweredBy: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'id', name: 'Bahasa Indonesia' },
];

export const TRANSLATIONS: Record<LanguageCode, TranslationDictionary> = {
  en: {
    deskLabel: 'Verification Desk',
    editionLabel: 'Independent Digital Edition',
    langNavLabel: 'Edition language',
    badge: 'Independent Verification Desk',
    titleMain: 'Fact Check',
    titleSub: 'News & Claim Verification Desk',
    subtitle:
      'Submit a published article URL or news screenshot. Our editorial verification engine extracts atomic claims, cross-examines primary sources, and audits journalistic integrity.',
    featuresLabel: 'Editorial capabilities',
    featureUrl: 'Article URL Verification',
    featureImg: 'Screenshot OCR Analysis',
    featureLang: 'Bilingual Desk (EN / ID)',
    featureEngine: 'Multi-Claim Audit',

    deskKicker: 'SUBMIT FOR VERIFICATION',
    maxSizeBadge: 'MAX 5MB',
    tabListLabel: 'Submission format',
    tabUrl: 'Article URL',
    tabImg: 'Screenshot Image',
    urlPlaceholder: 'https://www.example.com/2026/news-article-slug',
    dragText: 'Drop a news screenshot here, or click to select file',
    dragSubtext: 'Accepted formats: PNG, JPG, JPEG, WebP — Maximum size 5MB',
    btnInvestigate: 'Run Verification',
    btnInvestigating: 'Verifying Claims...',
    removeImage: 'Remove',
    errEmptyUrl: 'Please enter an article URL to verify.',
    errEmptyImg: 'Please select a screenshot image to verify.',
    errInvalidImgType: 'File must be an image (PNG, JPEG, or WebP).',
    errMaxImgSize: 'Image exceeds the 5MB maximum file size limit.',
    errGeneric: 'Verification could not be completed.',

    dispatchKicker: 'VERIFICATION DISPATCH LOG',
    timelineTitle: 'Editorial Verification in Progress',
    step_extracting: 'Extracting Source Material',
    step_extracting_desc: 'Parsing headline, publication metadata, and body copy from input...',
    step_analyzing: 'Isolating Atomic Claims',
    step_analyzing_desc: 'Decomposing narrative assertions into independently testable claims...',
    step_searching: 'Cross-Checking News Indices',
    step_searching_desc: 'Querying live web coverage and corroborating reporting across outlets...',
    step_factcheck: 'Inspecting Fact-Check Archives',
    step_factcheck_desc: 'Checking prior fact-check records and independent verification bureaus...',
    step_comparing: 'Scoring Evidence & Stance',
    step_comparing_desc: 'Weighting source credibility tiers and alignment against each claim...',
    step_report: 'Compiling Editorial Report',
    step_report_desc: 'Finalizing verdict, journalistic signals, and AI self-critique audit...',
    statusDone: 'DONE',
    statusActive: 'ACTIVE',
    statusQueued: 'QUEUED',
    statusFailed: 'FAILED',
    complete: 'Complete',
    error: 'Verification Interrupted',

    reportKicker: 'VERIFICATION REPORT',
    credibilityScore: 'Credibility Score',
    confidence: 'Confidence',
    claimsAnalyzed: 'Claims Examined',
    sourcesFound: 'Corroborating Sources',
    summary: 'Executive Summary',
    redFlags: 'Editorial Red Flags',
    positiveIndicators: 'Corroborated Indicators',
    claimsAssessment: 'Atomic Claim Breakdown',
    claimLabel: 'CLAIM',
    journalisticSignals: 'Journalistic Signals',
    signalClickbait: 'Headline & Clickbait',
    signalTemporal: 'Temporal Context',
    signalAttribution: 'Source Attribution',
    severity_low: 'LOW',
    severity_medium: 'MEDIUM',
    severity_high: 'HIGH',
    temporal_current: 'CURRENT',
    temporal_outdated: 'OUTDATED / RECYCLED',
    temporal_undated: 'UNDATED',
    temporal_unclear: 'UNCLEAR',
    attr_clear: 'CLEAR',
    attr_partial: 'PARTIAL',
    attr_missing: 'ANONYMOUS / MISSING',
    tier_1_label: 'Tier 1 · Primary & Wire',
    tier_2_label: 'Tier 2 · Mainstream Press',
    tier_3_label: 'Tier 3 · General Web',
    aiAuditTitle: 'AI Verification Audit',
    auditModel: 'Synthesis Model',
    auditReranker: 'Evidence Reranker',
    auditSelfCritique: 'Self-Critique Adjustment',
    auditAdjustedYes: 'Adjusted',
    auditAdjustedNo: 'Verified Pass',
    auditNoteLabel: 'Auditor Note',
    providerWarningsTitle: 'Retrieval & Provider Notices',
    providerSearchLabel: 'Search',
    providerScraperLabel: 'Extractor',
    providerFactcheckLabel: 'Fact-Check',
    searchQueryLabel: 'Verification Query',
    supportingUrlsLabel: 'Primary Reference',
    cachedResult: 'Archived Dispatch',
    analyzedAt: 'Published',
    analysisTime: 'Duration',
    verdict_hoax: 'FALSE / HOAX',
    verdict_fakta: 'VERIFIED',
    verdict_neutral: 'MISLEADING',
    verdict_unverified: 'UNVERIFIED',
    confidence_low: 'LOW',
    confidence_medium: 'MEDIUM',
    confidence_high: 'HIGH',

    officialFactCheck: 'Fact-Check Archive Matches',
    foundSources: 'Evidence & Source Index',
    stance_supports: 'CORROBORATES',
    stance_contradicts: 'CONTRADICTS',
    stance_neutral: 'NEUTRAL',
    similarity: 'Relevance',
    noSources: 'No external corroborating sources were returned from search indices.',
    reviewedBy: 'Reviewed by',
    readFullSource: 'Inspect Source',

    disclaimer:
      'Fact Check is an automated editorial verification desk. Automated assessments should be read alongside primary cited evidence.',
    poweredBy: 'Fact Check Verification Desk • Multi-Claim Evidence Synthesis & Journalistic Audit',
  },
  id: {
    deskLabel: 'Meja Verifikasi',
    editionLabel: 'Edisi Digital Independen',
    langNavLabel: 'Bahasa edisi',
    badge: 'Meja Verifikasi Independen',
    titleMain: 'Fact Check',
    titleSub: 'Meja Verifikasi Berita & Klaim',
    subtitle:
      'Masukkan URL artikel berita atau tangkapan layar. Mesin verifikasi editorial kami mengekstrak klaim atomik, memeriksa silang sumber primer, dan mengaudit integritas jurnalistik.',
    featuresLabel: 'Kapabilitas editorial',
    featureUrl: 'Verifikasi URL Artikel',
    featureImg: 'Analisis OCR Tangkapan Layar',
    featureLang: 'Meja Dwibahasa (EN / ID)',
    featureEngine: 'Audit Multi-Klaim',

    deskKicker: 'PENGAJUAN VERIFIKASI',
    maxSizeBadge: 'MAKS 5MB',
    tabListLabel: 'Format pengajuan',
    tabUrl: 'URL Artikel',
    tabImg: 'Tangkapan Layar',
    urlPlaceholder: 'https://www.contoh.com/2026/judul-artikel-berita',
    dragText: 'Seret tangkapan layar berita ke sini, atau klik untuk memilih file',
    dragSubtext: 'Format didukung: PNG, JPG, JPEG, WebP — Ukuran maksimum 5MB',
    btnInvestigate: 'Mulai Verifikasi',
    btnInvestigating: 'Memverifikasi Klaim...',
    removeImage: 'Hapus',
    errEmptyUrl: 'Masukkan URL artikel terlebih dahulu.',
    errEmptyImg: 'Pilih gambar tangkapan layar terlebih dahulu.',
    errInvalidImgType: 'File harus berupa gambar (PNG, JPEG, atau WebP).',
    errMaxImgSize: 'Ukuran gambar melebihi batas maksimum 5MB.',
    errGeneric: 'Verifikasi gagal diselesaikan.',

    dispatchKicker: 'LOG PROSES VERIFIKASI',
    timelineTitle: 'Verifikasi Editorial Sedang Berlangsung',
    step_extracting: 'Mengekstrak Materi Sumber',
    step_extracting_desc: 'Membaca judul, metadata publikasi, dan isi teks dari masukan...',
    step_analyzing: 'Memilah Klaim Atomik',
    step_analyzing_desc: 'Mengurai narasi berita menjadi klaim-klaim yang dapat diuji terpisah...',
    step_searching: 'Melacak Indeks Berita',
    step_searching_desc: 'Menelusuri pemberitaan lintas media dan sumber pembanding langsung...',
    step_factcheck: 'Memeriksa Arsip Periksa Fakta',
    step_factcheck_desc: 'Mencocokkan catatan periksa fakta resmi dari lembaga independen...',
    step_comparing: 'Menilai Bobot & Sikap Bukti',
    step_comparing_desc: 'Menimbang tingkat kredibilitas sumber terhadap setiap klaim...',
    step_report: 'Menyusun Laporan Editorial',
    step_report_desc: 'Menetapkan vonis akhir, sinyal jurnalistik, dan audit mandiri AI...',
    statusDone: 'SELESAI',
    statusActive: 'PROSES',
    statusQueued: 'ANTRE',
    statusFailed: 'GAGAL',
    complete: 'Selesai',
    error: 'Verifikasi Terhenti',

    reportKicker: 'LAPORAN VERIFIKASI',
    credibilityScore: 'Skor Kredibilitas',
    confidence: 'Tingkat Keyakinan',
    claimsAnalyzed: 'Klaim Diperiksa',
    sourcesFound: 'Sumber Pembanding',
    summary: 'Ringkasan Eksekutif',
    redFlags: 'Indikator Mencurigakan',
    positiveIndicators: 'Indikator Terkonfirmasi',
    claimsAssessment: 'Rincian Klaim Atomik',
    claimLabel: 'KLAIM',
    journalisticSignals: 'Sinyal Jurnalistik',
    signalClickbait: 'Judul & Clickbait',
    signalTemporal: 'Konteks Waktu',
    signalAttribution: 'Atribusi Sumber',
    severity_low: 'RENDAH',
    severity_medium: 'SEDANG',
    severity_high: 'TINGGI',
    temporal_current: 'TERKINI',
    temporal_outdated: 'KEDALUWARSA / DAUR ULANG',
    temporal_undated: 'TANPA TANGGAL',
    temporal_unclear: 'TIDAK JELAS',
    attr_clear: 'JELAS',
    attr_partial: 'SEBAGIAN',
    attr_missing: 'ANONIM / HILANG',
    tier_1_label: 'Tier 1 · Resmi & Primer',
    tier_2_label: 'Tier 2 · Media Arus Utama',
    tier_3_label: 'Tier 3 · Sumber Umum',
    aiAuditTitle: 'Audit Verifikasi AI',
    auditModel: 'Model Sintesis',
    auditReranker: 'Perangking Bukti',
    auditSelfCritique: 'Koreksi Audit Mandiri',
    auditAdjustedYes: 'Disesuaikan',
    auditAdjustedNo: 'Lolos Tanpa Revisi',
    auditNoteLabel: 'Catatan Auditor',
    providerWarningsTitle: 'Catatan Sistem & Penyedia',
    providerSearchLabel: 'Pencarian',
    providerScraperLabel: 'Ekstraktor',
    providerFactcheckLabel: 'Periksa Fakta',
    searchQueryLabel: 'Kueri Verifikasi',
    supportingUrlsLabel: 'Rujukan Pendukung',
    cachedResult: 'Arsip Tersimpan',
    analyzedAt: 'Diterbitkan',
    analysisTime: 'Durasi',
    verdict_hoax: 'SALAH / HOAKS',
    verdict_fakta: 'TERVERIFIKASI',
    verdict_neutral: 'MENYESATKAN',
    verdict_unverified: 'BELUM TERVERIFIKASI',
    confidence_low: 'RENDAH',
    confidence_medium: 'SEDANG',
    confidence_high: 'TINGGI',

    officialFactCheck: 'Arsip Periksa Fakta Resmi',
    foundSources: 'Indeks Bukti & Sumber',
    stance_supports: 'MENDUKUNG',
    stance_contradicts: 'MEMBANTAH',
    stance_neutral: 'NETRAL',
    similarity: 'Relevansi',
    noSources: 'Tidak ditemukan sumber pembanding eksternal dari indeks pencarian.',
    reviewedBy: 'Diperiksa oleh',
    readFullSource: 'Buka Sumber',

    disclaimer:
      'Fact Check adalah meja verifikasi editorial otomatis. Penilaian otomatis harus dibaca bersama bukti primer yang dirujuk.',
    poweredBy: 'Meja Verifikasi Fact Check • Sintesis Bukti Multi-Klaim & Audit Jurnalistik',
  },
};
