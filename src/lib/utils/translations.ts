export type LanguageCode = 'en' | 'id';

interface Language {
  code: LanguageCode;
  name: string;
}

interface TranslationDictionary {
  deskLabel: string;
  langNavLabel: string;
  titleMain: string;

  maxSizeBadge: string;
  tabListLabel: string;
  tabUrl: string;
  tabImg: string;
  urlPlaceholder: string;
  dragText: string;
  btnInvestigate: string;
  btnInvestigating: string;
  removeImage: string;
  errEmptyUrl: string;
  errEmptyImg: string;
  errInvalidImgType: string;
  errMaxImgSize: string;
  errGeneric: string;

  timelineTitle: string;
  step_extracting: string;
  step_analyzing: string;
  step_searching: string;
  step_factcheck: string;
  step_comparing: string;
  step_report: string;
  statusDone: string;
  statusActive: string;
  statusQueued: string;
  statusFailed: string;
  error: string;

  credibilityScore: string;
  confidence: string;
  claimsAnalyzed: string;
  sourcesFound: string;
  summary: string;
  redFlags: string;
  positiveIndicators: string;
  claimsAssessment: string;
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
  cachedResult: string;
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
    langNavLabel: 'Edition language',
    titleMain: 'Fact Check',

    maxSizeBadge: 'Max 5MB',
    tabListLabel: 'Submission format',
    tabUrl: 'Article URL',
    tabImg: 'Screenshot',
    urlPlaceholder: 'Paste article URL (https://...)',
    dragText: 'Drop screenshot or click to upload',
    btnInvestigate: 'Verify',
    btnInvestigating: 'Verifying...',
    removeImage: 'Remove',
    errEmptyUrl: 'Enter an article URL.',
    errEmptyImg: 'Select a screenshot image.',
    errInvalidImgType: 'File must be PNG, JPEG, or WebP.',
    errMaxImgSize: 'Image exceeds 5MB limit.',
    errGeneric: 'Verification failed.',

    timelineTitle: 'Verifying Source',
    step_extracting: 'Extracting article content',
    step_analyzing: 'Isolating atomic claims',
    step_searching: 'Searching corroborating news',
    step_factcheck: 'Checking fact-check archives',
    step_comparing: 'Evaluating evidence & stance',
    step_report: 'Compiling verification report',
    statusDone: 'DONE',
    statusActive: 'ACTIVE',
    statusQueued: 'QUEUED',
    statusFailed: 'FAILED',
    error: 'Interrupted',

    credibilityScore: 'Credibility',
    confidence: 'Confidence',
    claimsAnalyzed: 'claims',
    sourcesFound: 'sources',
    summary: 'Executive Summary',
    redFlags: 'Red Flags',
    positiveIndicators: 'Supporting Signals',
    claimsAssessment: 'Atomic Claims',
    journalisticSignals: 'Journalistic Signals',
    signalClickbait: 'Clickbait',
    signalTemporal: 'Temporal Context',
    signalAttribution: 'Source Attribution',
    severity_low: 'LOW',
    severity_medium: 'MEDIUM',
    severity_high: 'HIGH',
    temporal_current: 'CURRENT',
    temporal_outdated: 'OUTDATED',
    temporal_undated: 'UNDATED',
    temporal_unclear: 'UNCLEAR',
    attr_clear: 'CLEAR',
    attr_partial: 'PARTIAL',
    attr_missing: 'MISSING',
    tier_1_label: 'Tier 1 · Primary',
    tier_2_label: 'Tier 2 · Mainstream',
    tier_3_label: 'Tier 3 · Web',
    aiAuditTitle: 'AI Audit Details',
    auditModel: 'Model',
    auditReranker: 'Reranker',
    auditSelfCritique: 'Self-Critique',
    auditAdjustedYes: 'Adjusted',
    auditAdjustedNo: 'Unchanged',
    auditNoteLabel: 'Note',
    providerWarningsTitle: 'System Notices',
    providerSearchLabel: 'Search',
    providerScraperLabel: 'Extractor',
    providerFactcheckLabel: 'Fact-Check',
    cachedResult: 'Archived',
    verdict_hoax: 'FALSE / HOAX',
    verdict_fakta: 'VERIFIED',
    verdict_neutral: 'MISLEADING',
    verdict_unverified: 'UNVERIFIED',
    confidence_low: 'Low',
    confidence_medium: 'Medium',
    confidence_high: 'High',

    officialFactCheck: 'Fact-Check Matches',
    foundSources: 'Evidence Sources',
    stance_supports: 'SUPPORTS',
    stance_contradicts: 'CONTRADICTS',
    stance_neutral: 'NEUTRAL',
    similarity: 'match',
    noSources: 'No corroborating sources found.',
    readFullSource: 'Source',

    disclaimer:
      'Automated editorial verification. Review cited primary sources before drawing conclusions.',
    poweredBy: 'Fact Check · Verification Desk',
  },
  id: {
    deskLabel: 'Meja Verifikasi',
    langNavLabel: 'Bahasa edisi',
    titleMain: 'Fact Check',

    maxSizeBadge: 'Maks 5MB',
    tabListLabel: 'Format pengajuan',
    tabUrl: 'URL Artikel',
    tabImg: 'Tangkapan Layar',
    urlPlaceholder: 'Tempel URL artikel (https://...)',
    dragText: 'Tarik tangkapan layar atau klik untuk unggah',
    btnInvestigate: 'Verifikasi',
    btnInvestigating: 'Memverifikasi...',
    removeImage: 'Hapus',
    errEmptyUrl: 'Masukkan URL artikel.',
    errEmptyImg: 'Pilih gambar tangkapan layar.',
    errInvalidImgType: 'File harus berupa PNG, JPEG, atau WebP.',
    errMaxImgSize: 'Ukuran gambar melebihi batas 5MB.',
    errGeneric: 'Verifikasi gagal.',

    timelineTitle: 'Memverifikasi Sumber',
    step_extracting: 'Mengekstrak konten sumber',
    step_analyzing: 'Memilah klaim atomik',
    step_searching: 'Mencari berita pembanding',
    step_factcheck: 'Memeriksa arsip periksa fakta',
    step_comparing: 'Menilai bobot bukti',
    step_report: 'Menyusun laporan akhir',
    statusDone: 'SELESAI',
    statusActive: 'PROSES',
    statusQueued: 'ANTRE',
    statusFailed: 'GAGAL',
    error: 'Terhenti',

    credibilityScore: 'Kredibilitas',
    confidence: 'Keyakinan',
    claimsAnalyzed: 'klaim',
    sourcesFound: 'sumber',
    summary: 'Ringkasan Eksekutif',
    redFlags: 'Indikator Risiko',
    positiveIndicators: 'Indikator Pendukung',
    claimsAssessment: 'Klaim Atomik',
    journalisticSignals: 'Sinyal Jurnalistik',
    signalClickbait: 'Clickbait',
    signalTemporal: 'Konteks Waktu',
    signalAttribution: 'Atribusi Sumber',
    severity_low: 'RENDAH',
    severity_medium: 'SEDANG',
    severity_high: 'TINGGI',
    temporal_current: 'TERKINI',
    temporal_outdated: 'KEDALUWARSA',
    temporal_undated: 'TANPA TANGGAL',
    temporal_unclear: 'TIDAK JELAS',
    attr_clear: 'JELAS',
    attr_partial: 'SEBAGIAN',
    attr_missing: 'TIDAK ADA',
    tier_1_label: 'Tier 1 · Primer',
    tier_2_label: 'Tier 2 · Arus Utama',
    tier_3_label: 'Tier 3 · Umum',
    aiAuditTitle: 'Rincian Audit AI',
    auditModel: 'Model',
    auditReranker: 'Perangking',
    auditSelfCritique: 'Audit Mandiri',
    auditAdjustedYes: 'Disesuaikan',
    auditAdjustedNo: 'Tanpa Revisi',
    auditNoteLabel: 'Catatan',
    providerWarningsTitle: 'Catatan Sistem',
    providerSearchLabel: 'Pencarian',
    providerScraperLabel: 'Ekstraktor',
    providerFactcheckLabel: 'Periksa Fakta',
    cachedResult: 'Arsip',
    verdict_hoax: 'SALAH / HOAKS',
    verdict_fakta: 'TERVERIFIKASI',
    verdict_neutral: 'MENYESATKAN',
    verdict_unverified: 'BELUM TERVERIFIKASI',
    confidence_low: 'Rendah',
    confidence_medium: 'Sedang',
    confidence_high: 'Tinggi',

    officialFactCheck: 'Arsip Periksa Fakta',
    foundSources: 'Sumber Bukti',
    stance_supports: 'MENDUKUNG',
    stance_contradicts: 'MEMBANTAH',
    stance_neutral: 'NETRAL',
    similarity: 'relevan',
    noSources: 'Tidak ada sumber pembanding ditemukan.',
    readFullSource: 'Sumber',

    disclaimer:
      'Verifikasi editorial otomatis. Tinjau sumber primer yang dirujuk sebelum menyimpulkan.',
    poweredBy: 'Fact Check · Meja Verifikasi',
  },
};
