import type { CredibilityTier } from '@/lib/types';

export interface DomainCredibility {
  domain: string;
  tier: CredibilityTier;
  weight: number;
  label: string;
}

const TIER_1_LABEL = 'Terverifikasi / Kredibilitas Tinggi';
const TIER_2_LABEL = 'Media Umum';
const TIER_3_LABEL = 'Sumber Belum Terverifikasi / UGC';

const TIER_1_FACT_CHECKERS: readonly string[] = [
  'turnbackhoax.id',
  'cekfakta.com',
  'mafindo.or.id',
  'snopes.com',
  'politifact.com',
  'factcheck.org',
  'fullfact.org',
  'afp.com',
  'leadstories.com',
];

const TIER_1_OFFICIAL_DOMAINS: readonly string[] = [
  'who.int',
  'bps.go.id',
  'bmkg.go.id',
  'un.org',
  'unicef.org',
  'bi.go.id',
  'ojk.go.id',
  'kpu.go.id',
  'bawaslu.go.id',
  'brin.go.id',
];

const TIER_1_OFFICIAL_SUFFIXES: readonly string[] = [
  '.go.id',
  '.gov',
  '.edu',
  '.ac.id',
  '.gov.uk',
  '.gov.au',
  '.edu.au',
];

const TIER_1_MAINSTREAM_MEDIA: readonly string[] = [
  'kompas.com',
  'kompas.id',
  'tempo.co',
  'antaranews.com',
  'detik.com',
  'cnnindonesia.com',
  'rri.co.id',
  'bbc.com',
  'bbc.co.uk',
  'reuters.com',
  'apnews.com',
  'nytimes.com',
  'theguardian.com',
];

const TIER_3_UGC_AND_SOCIAL_DOMAINS: readonly string[] = [
  'blogspot.com',
  'blogspot.co.id',
  'wordpress.com',
  'medium.com',
  'substack.com',
  'tumblr.com',
  'wixsite.com',
  'weebly.com',
  'kompasiana.com',
  'facebook.com',
  'fb.com',
  'instagram.com',
  'x.com',
  'twitter.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'threads.net',
  'reddit.com',
  'quora.com',
  'kaskus.co.id',
  't.me',
  'telegram.org',
  'whatsapp.com',
  'pinterest.com',
  'linkedin.com',
];

const TIER_2_GENERAL_NEWS_DOMAINS: readonly string[] = [
  'liputan6.com',
  'tribunnews.com',
  'sindonews.com',
  'okezone.com',
  'merdeka.com',
  'viva.co.id',
  'suara.com',
  'jpnn.com',
  'pikiran-rakyat.com',
  'republika.co.id',
  'mediaindonesia.com',
  'jawapos.com',
  'kumparan.com',
  'idntimes.com',
  'tirto.id',
  'katadata.co.id',
  'cnbcindonesia.com',
  'bisnis.com',
  'kontan.co.id',
  'metrotvnews.com',
  'tvonenews.com',
  'inews.id',
  'beritasatu.com',
  'rmol.id',
  'solopos.com',
  'harianjogja.com',
  'suarasurabaya.net',
  'cnn.com',
  'cnbc.com',
  'bloomberg.com',
  'forbes.com',
  'washingtonpost.com',
  'aljazeera.com',
  'channelnewsasia.com',
  'dw.com',
  'voaindonesia.com',
  'time.com',
  'newsweek.com',
  'npr.org',
  'straitstimes.com',
];

export function normalizeHostname(rawUrlOrHost: string): string {
  const trimmed = rawUrlOrHost.trim();
  if (!trimmed) return '';

  let hostname = '';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    hostname = new URL(withProtocol).hostname;
  } catch {
    hostname = trimmed.split('/')[0]?.split('?')[0]?.split('#')[0] ?? '';
  }

  return hostname.toLowerCase().replace(/^www\./, '').replace(/\.+$/, '');
}

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchesAnyDomain(hostname: string, domains: readonly string[]): boolean {
  return domains.some((domain) => matchesDomain(hostname, domain));
}

function matchesAnySuffix(hostname: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => hostname.endsWith(suffix));
}

function looksLikeGeneralNewsPortal(hostname: string): boolean {
  const labels = hostname.split('.');
  const primaryLabel = labels[0] ?? '';
  return (
    /(news|berita|tribun|pos|harian|koran|jurnal|times|post|daily|press|media|tv|radio)/.test(
      primaryLabel
    ) && !hostname.includes('blog')
  );
}

export function classifyDomain(url: string): DomainCredibility {
  const domain = normalizeHostname(url);

  if (!domain) {
    return {
      domain: 'unknown',
      tier: 'TIER_3',
      weight: 0.25,
      label: TIER_3_LABEL,
    };
  }

  if (
    matchesAnyDomain(domain, TIER_1_FACT_CHECKERS) ||
    matchesAnyDomain(domain, TIER_1_OFFICIAL_DOMAINS) ||
    matchesAnySuffix(domain, TIER_1_OFFICIAL_SUFFIXES) ||
    matchesAnyDomain(domain, TIER_1_MAINSTREAM_MEDIA)
  ) {
    return {
      domain,
      tier: 'TIER_1',
      weight: 1.0,
      label: TIER_1_LABEL,
    };
  }

  if (matchesAnyDomain(domain, TIER_3_UGC_AND_SOCIAL_DOMAINS)) {
    return {
      domain,
      tier: 'TIER_3',
      weight: 0.25,
      label: TIER_3_LABEL,
    };
  }

  if (matchesAnyDomain(domain, TIER_2_GENERAL_NEWS_DOMAINS) || looksLikeGeneralNewsPortal(domain)) {
    return {
      domain,
      tier: 'TIER_2',
      weight: 0.6,
      label: TIER_2_LABEL,
    };
  }

  return {
    domain,
    tier: 'TIER_3',
    weight: 0.25,
    label: TIER_3_LABEL,
  };
}
