# Sistem Pendeteksi Berita Hoaks

[![CI](https://github.com/Mulocoolbot/Sistem-Pendeteksi-Berita-Hoaks/actions/workflows/ci.yml/badge.svg)](https://github.com/Mulocoolbot/Sistem-Pendeteksi-Berita-Hoaks/actions/workflows/ci.yml)
[![Deploy](https://github.com/Mulocoolbot/Sistem-Pendeteksi-Berita-Hoaks/actions/workflows/deploy.yml/badge.svg)](https://github.com/Mulocoolbot/Sistem-Pendeteksi-Berita-Hoaks/actions/workflows/deploy.yml)

Aplikasi web berbasis Next.js (App Router) dengan TypeScript untuk menganalisis kredibilitas berita dari URL artikel maupun unggahan gambar tangkapan layar tanpa ketergantungan Google Cloud Billing. Sistem mengekstrak konten artikel (fast-path Cheerio dengan fallback otomatis ke Jina Reader API) atau teks pada gambar, mengidentifikasi klaim atomik beserta sinyal jurnalistik menggunakan Groq API, memverifikasi klaim secara paralel ke domain pemeriksa fakta terverifikasi serta pencarian berita terkait melalui Tavily Search API (dengan fallback otomatis ke Jina Search API), lalu menyusun laporan investigasi lengkap beserta skor kredibilitas dan metadata `providerStatus`.

## Tech Stack

- **Framework**: Next.js `16.2.10` (App Router)
- **UI Library**: React `19.2.4` dan React DOM `19.2.4`
- **Bahasa**: TypeScript (`^5`)
- **Styling**: CSS Modules dan CSS global
- **AI / LLM**: `groq-sdk` (`^1.3.0`) dengan Task-Based AI Router (`src/lib/services/ai-router.ts`)
  - Ekstraksi klaim & sinyal (`task: 'extract'`): `GROQ_MODEL_FAST` (default: `llama-3.3-70b-versatile`)
  - Sintesis & Self-Critique (`task: 'reason'` & `task: 'audit'`): `GROQ_MODEL_REASONING` (default: `openai/gpt-oss-120b`) dengan fallback otomatis ke `GROQ_MODEL_FAST` pada HTTP `404`/`429`/`503`
  - Analisis gambar (`task: 'vision'`): `GROQ_MODEL_VISION` (default: `meta-llama/llama-4-scout-17b-16e-instruct`)
  - Mendukung custom/fine-tuned endpoint OpenAI-compatible opsional melalui `AI_CUSTOM_BASE_URL`, `AI_CUSTOM_API_KEY`, dan `AI_CUSTOM_MODEL`
- **Semantic Evidence Reranking**: `src/lib/services/reranker.ts` menggunakan Jina Reranker v2 (`https://api.jina.ai/v1/rerank`, `jina-reranker-v2-base-multilingual`) dengan fallback lokal BM25 + token-overlap otomatis tanpa error
- **2-Pass Adversarial Self-Critique**: Pass 1 Synthesizer menghasilkan draf `FinalSynthesisOutput`, lalu Pass 2 Auditor (`AuditCritiqueSchema`) memvalidasi keterikatan bukti dan mencatat metadata `aiAudit` (`modelUsed`, `rerankerUsed`, `selfCritiqueAdjusted`, `auditNote`) pada `InvestigationReport`
- **HTTP Client & HTML Parser**: `axios` (`^1.18.1`) dan `cheerio` (`^1.2.0`)
- **Ekstraksi & Pencarian Eksternal**: Tavily Search API (`https://api.tavily.com/search`), Jina Reader API (`https://r.jina.ai/`), dan Jina Search API (`https://s.jina.ai/`)
- **Linter**: ESLint (`^9`) dengan `eslint-config-next` (`16.2.10`)

## Prasyarat

- Node.js versi 20 atau lebih baru
- npm
- `GROQ_API_KEY` (wajib) dari Groq Console (`https://console.groq.com`)
- `TAVILY_API_KEY` (opsional, disarankan) untuk pencarian berita utama dan verifikasi domain fact-checker melalui Tavily Search API
- `JINA_API_KEY` (opsional) untuk meningkatkan rate limit Jina Reader (`r.jina.ai`) dan Jina Search (`s.jina.ai`) saat fallback

## Langkah Instalasi Lokal

1. Instal dependensi proyek:

   ```bash
   npm install
   ```

2. Salin templat variabel lingkungan ke `.env.local` dan lengkapi nilainya:

   ```bash
   cp .env.example .env.local
   ```

   Minimal isi `GROQ_API_KEY` pada `.env.local`. Tambahkan `TAVILY_API_KEY` dan `JINA_API_KEY` untuk mengaktifkan pencarian utama dan meningkatkan batas rate fallback Jina AI.

3. Jalankan server pengembangan:

   ```bash
   npm run dev
   ```

   Aplikasi berjalan di `http://localhost:3000`.

4. Perintah pemeriksaan tipe, lint, build produksi, evaluasi golden benchmark, dan menjalankan hasil build:

   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   npm run eval
   npm run start
   ```

   > Catatan: `npm run eval` menjalankan `scripts/eval-benchmark.ts` (8 kasus uji: 2 `VERIFIED`, 2 `HOAX`, 2 `MISLEADING`, 2 `UNVERIFIED`) terhadap `http://localhost:3000/api/analyze/url` (dapat dioverride melalui `EVAL_API_URL`) saat server lokal aktif (`npm run dev` atau `npm run start`).

## Daftar Variabel `.env.example`

Seluruh variabel lingkungan berikut dibaca oleh `getEnvConfig()` di `src/lib/config.ts`:

| Variabel | Status | Digunakan Oleh | Keterangan |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | Wajib | `src/lib/services/ai-router.ts` | API key Groq untuk ekstraksi klaim, penyusunan query pencarian, sintesis verifikasi, audit self-critique, dan ekstraksi teks dari gambar. |
| `GROQ_MODEL_FAST` | Opsional | `src/lib/services/ai-router.ts` | Model cepat Groq untuk ekstraksi klaim dan fallback reasoning/audit (default: `llama-3.3-70b-versatile`). |
| `GROQ_MODEL_REASONING` | Opsional | `src/lib/services/ai-router.ts` | Model reasoning utama untuk Pass 1 sintesis dan Pass 2 audit self-critique (default: `openai/gpt-oss-120b`). |
| `GROQ_MODEL_VISION` | Opsional | `src/lib/services/ai-router.ts` | Model vision untuk analisis gambar/OCR (default: `meta-llama/llama-4-scout-17b-16e-instruct`). |
| `AI_CUSTOM_BASE_URL` | Opsional | `src/lib/services/ai-router.ts` | Base URL endpoint OpenAI-compatible untuk menyambungkan custom/fine-tuned LLM pada tugas `reason` dan `audit`. |
| `AI_CUSTOM_API_KEY` | Opsional | `src/lib/services/ai-router.ts` | API key Bearer untuk endpoint `AI_CUSTOM_BASE_URL`. |
| `AI_CUSTOM_MODEL` | Opsional | `src/lib/services/ai-router.ts` | Nama model pada endpoint `AI_CUSTOM_BASE_URL`. |
| `TAVILY_API_KEY` | Opsional (Primary Search & Fact-Check) | `src/lib/services/search.ts`, `src/lib/services/factcheck.ts` | API key Tavily Search (`POST https://api.tavily.com/search`) untuk pencarian berita utama serta pencarian klaim ke domain pemeriksa fakta terverifikasi (`turnbackhoax.id`, `cekfakta.com`, `cekfakta.tempo.co`, `snopes.com`, `politifact.com`, `factcheck.org`, `fullfact.org`). Jika kosong atau gagal (HTTP 4xx/5xx/timeout), sistem otomatis fallback ke Jina Search (`https://s.jina.ai/`). |
| `JINA_API_KEY` | Opsional (Reader, Search Fallback & Semantic Reranker) | `src/lib/services/scraper.ts`, `src/lib/services/search.ts`, `src/lib/services/factcheck.ts`, `src/lib/services/reranker.ts` | API key Jina AI untuk meningkatkan rate limit Jina Reader (`https://r.jina.ai/`), fallback Jina Search (`https://s.jina.ai/`), serta mengaktifkan Jina Reranker v2 (`https://api.jina.ai/v1/rerank`); jika kosong atau gagal, reranker otomatis fallback ke reranker lokal BM25 + token-overlap. |

## CI/CD, GitHub Secrets & Branch Protection

Repositori ini menggunakan GitHub Actions dan Dependabot untuk otomatisasi kualitas kode, deployment produksi ke Vercel, dan pembaruan dependensi:

- **`.github/workflows/ci.yml`**: Berjalan pada `push` ke branch `main` dan `develop`, serta `pull_request` ke `main`. Menjalankan `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, serta blackbox smoke test (`GET /` → HTTP `200` dan `POST /api/analyze/url` dengan `{}` → HTTP `400`).
- **`.github/workflows/deploy.yml`**: Berjalan pada `push` ke branch `main`, tag rilis `v*.*.*`, serta pemicu manual (`workflow_dispatch`). Memvalidasi ketersediaan secret Vercel lalu menjalankan `vercel pull --yes --environment=production`, `vercel build --prod`, dan `vercel deploy --prebuilt --prod`.
- **`.github/dependabot.yml`**: Memeriksa pembaruan dependensi secara mingguan (`weekly`) untuk ekosistem `npm` dan `github-actions`.

### Daftar GitHub Secrets & Environment Produksi

Konfigurasikan `VERCEL_TOKEN`, `VERCEL_ORG_ID`, dan `VERCEL_PROJECT_ID` pada **GitHub Repository → Settings → Secrets and variables → Actions**. Seluruh variabel aplikasi dari `.env.example` di bawah ini harus dikonfigurasikan pada **Vercel Project Settings → Environment Variables (Production)** agar ditarik otomatis saat `vercel pull --yes --environment=production` (dan dapat pula disinkronkan ke GitHub Secrets bila dibutuhkan workflow tambahan):

| Nama Secret / Variabel | Status | Lokasi Konfigurasi | Keterangan |
| --- | --- | --- | --- |
| `VERCEL_TOKEN` | Wajib | GitHub Actions Secret | Personal/team access token Vercel CLI untuk `vercel pull`, `vercel build --prod`, dan `vercel deploy --prebuilt --prod`. |
| `VERCEL_ORG_ID` | Wajib | GitHub Actions Secret | ID organisasi/akun Vercel (diperoleh dari `.vercel/project.json` setelah `vercel link`). |
| `VERCEL_PROJECT_ID` | Wajib | GitHub Actions Secret | ID proyek Vercel target deployment (diperoleh dari `.vercel/project.json` setelah `vercel link`). |
| `GROQ_API_KEY` | Wajib | Vercel Production Env / Secret | API key Groq untuk ekstraksi klaim, penyusunan query, sintesis, audit self-critique, dan ekstraksi teks gambar. |
| `GROQ_MODEL_FAST` | Opsional | Vercel Production Env | Override model cepat Groq (nilai `.env.example`: `llama-3.3-70b-versatile`). |
| `GROQ_MODEL_REASONING` | Opsional | Vercel Production Env | Override model reasoning utama (nilai `.env.example`: `openai/gpt-oss-120b`). |
| `GROQ_MODEL_VISION` | Opsional | Vercel Production Env | Override model vision/OCR (nilai `.env.example`: `meta-llama/llama-4-scout-17b-16e-instruct`). |
| `AI_CUSTOM_BASE_URL` | Opsional | Vercel Production Env | Base URL endpoint OpenAI-compatible kustom untuk tugas `reason` dan `audit`. |
| `AI_CUSTOM_API_KEY` | Opsional | Vercel Production Env / Secret | API key Bearer untuk endpoint `AI_CUSTOM_BASE_URL`. |
| `AI_CUSTOM_MODEL` | Opsional | Vercel Production Env | Nama model pada endpoint `AI_CUSTOM_BASE_URL`. |
| `TAVILY_API_KEY` | Opsional (Disarankan) | Vercel Production Env / Secret | API key Tavily Search untuk pencarian berita utama dan verifikasi domain fact-checker. |
| `JINA_API_KEY` | Opsional | Vercel Production Env / Secret | API key Jina AI untuk rate limit Jina Reader/Search fallback dan Jina Reranker v2. |

### Panduan Singkat Mengaktifkan Branch Protection di `main`

1. Buka **Settings → Branches** pada repositori `Mulocoolbot/Sistem-Pendeteksi-Berita-Hoaks`, lalu klik **Add branch protection rule** (atau gunakan **Settings → Rules → Rulesets**).
2. Isi **Branch name pattern** dengan `main`.
3. Aktifkan **Require a pull request before merging** (disarankan minimal 1 approval dan aktifkan *Dismiss stale pull request approvals when new commits are pushed*).
4. Aktifkan **Require status checks to pass before merging** dan **Require branches to be up to date before merging**, lalu tambahkan required check **`Quality & Blackbox Smoke Test`** (job `quality-and-smoke-test` dari workflow `CI`).
5. Aktifkan **Do not allow bypassing the above settings** (disarankan) serta pastikan **Allow force pushes** dan **Allow deletions** tidak diaktifkan, lalu simpan (**Create / Save changes**).

## Struktur Folder

```text
.
├── .github/
│   ├── dependabot.yml                      # Jadwal pembaruan mingguan npm & github-actions
│   └── workflows/
│       ├── ci.yml                          # Pipeline CI: lint, typecheck, build & smoke test
│       └── deploy.yml                      # Pipeline deploy produksi ke Vercel
├── .env.example                            # Templat variabel lingkungan
├── .gitignore                              # Aturan pengabaian file Git
├── eslint.config.mjs                       # Konfigurasi ESLint
├── next.config.ts                          # Konfigurasi Next.js
├── package.json                            # Manifest dependensi dan skrip npm
├── package-lock.json                       # Lockfile npm
├── tsconfig.json                           # Konfigurasi TypeScript dan alias @/*
├── public/                                 # Direktori aset statis publik
├── scripts/
│   └── eval-benchmark.ts                   # Skrip evaluasi golden benchmark (npm run eval)
└── src/
    ├── app/
    │   ├── api/
    │   │   └── analyze/
    │   │       ├── image/route.ts          # Endpoint POST analisis gambar/OCR
    │   │       └── url/route.ts            # Endpoint POST analisis URL artikel
    │   ├── favicon.ico                     # Ikon aplikasi
    │   ├── globals.css                     # Styling global dan design tokens
    │   ├── layout.tsx                      # Root layout dan metadata aplikasi
    │   └── page.tsx                        # Halaman utama antarmuka pengguna
    ├── components/                         # Komponen UI dan CSS Modules
    │   ├── AnalysisTimeline.module.css
    │   ├── AnalysisTimeline.tsx
    │   ├── EvidenceList.module.css
    │   ├── EvidenceList.tsx
    │   ├── HeroSection.module.css
    │   ├── HeroSection.tsx
    │   ├── InputPanel.module.css
    │   ├── InputPanel.tsx
    │   ├── LanguageSelector.module.css
    │   ├── LanguageSelector.tsx
    │   ├── ResultCard.module.css
    │   └── ResultCard.tsx
    ├── hooks/
    │   └── useAnalysis.ts                  # Hook state manajemen proses analisis
    └── lib/
        ├── config.ts                       # Konfigurasi env, model AI, endpoint, timeout, dan limit
        ├── types.ts                        # Definisi tipe TypeScript & metadata providerStatus
        ├── schemas/
        │   └── analysis.ts                 # Skema validasi Zod untuk input/output analisis & provider
        ├── services/
        │   ├── ai-router.ts                # Router model berbasis tugas + fallback 404/429/503
        │   ├── analyzer.ts                 # Orkestrasi pipeline investigasi, reranking & 2-pass audit
        │   ├── factcheck.ts                # Klien paralel verifikasi domain fact-checker (Tavily -> Jina Search)
        │   ├── groq.ts                     # Wrapper panggilan AI terstruktur melalui ai-router
        │   ├── reranker.ts                 # Semantic evidence reranker (Jina v2 -> BM25 lokal)
        │   ├── scraper.ts                  # Ekstraksi artikel (Cheerio fast-path -> Jina Reader fallback)
        │   └── search.ts                   # Pencarian berita (Tavily primary -> Jina Search fallback)
        └── utils/
            ├── cache.ts                    # Cache LRU + TTL in-memory untuk laporan investigasi
            ├── credibility.ts              # Klasifikasi kredibilitas domain TIER_1/TIER_2/TIER_3
            ├── errors.ts                   # Utilitas AppError dan respons JSON API
            ├── prompts.ts                  # Generator prompt untuk model AI
            ├── sanitize.ts                 # Validasi URL, parsing JSON aman, dan konversi base64
            └── translations.ts             # Kamus terjemahan antarmuka multibahasa
```
