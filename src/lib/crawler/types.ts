export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  crawlRate: number; // ms between requests
  includePatterns?: string[];
  excludePatterns?: string[];
  respectRobotsTxt: boolean;
  followSitemaps: boolean;
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxPages: 100,
  maxDepth: 5,
  crawlRate: 1000,
  respectRobotsTxt: true,
  followSitemaps: true,
};

export interface PageData {
  url: string;
  statusCode: number;
  redirectUrl?: string;
  contentType?: string;
  responseTimeMs: number;
  contentSize: number;
  title?: string;
  metaDescription?: string;
  metaRobots?: string;
  canonicalUrl?: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  internalLinks: LinkData[];
  externalLinks: LinkData[];
  images: ImageData[];
  structuredData: unknown[];
  ogTags: Record<string, string>;
  hreflang: HreflangData[];
  securityHeaders: Record<string, string>;
  errors: string[];
  contentHash?: string;
  redirectChain?: Array<{ url: string; statusCode: number }>;
}

export interface LinkData {
  href: string;
  anchor: string;
  nofollow: boolean;
}

export interface ImageData {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface HreflangData {
  lang: string;
  href: string;
}
