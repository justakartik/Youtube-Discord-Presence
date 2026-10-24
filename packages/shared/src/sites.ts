/**
 * Privacy-safe activity labels for non-YouTube websites.
 *
 * Only the *host* and the first path segment are ever looked at, and the result is one of the fixed
 * labels below. Page titles, usernames, contact names, message text, query strings and full URLs are
 * never read, stored or sent.
 */

export type ActivityType = 0 | 2 | 3; // Playing | Listening | Watching

export type SiteRule = { prefix: string; label: string; type?: ActivityType };

/** Streaming sites: how to find the title of what is playing. Best-effort; every step has a fallback. */
export type PlayerHints = {
  /** Only treat the page as a player when the path starts with one of these (default: any path). */
  paths?: string[];
  /** Elements that hold the current title, tried in order. */
  titleSelectors?: string[];
  /** Patterns removed from document.title to leave just the title. */
  strip?: RegExp[];
};

export type SiteProfile = {
  id: string;
  name: string;
  player?: PlayerHints;
  /** Registrable hosts; subdomains match too. */
  hosts: string[];
  type: ActivityType;
  defaultLabel: string;
  rules: SiteRule[];
};

export const SITES: SiteProfile[] = [
  {
    id: "instagram", name: "Instagram", hosts: ["instagram.com"], type: 0, defaultLabel: "Scrolling the feed",
    rules: [
      { prefix: "/reels", label: "Watching Reels", type: 3 },
      { prefix: "/reel/", label: "Watching Reels", type: 3 },
      { prefix: "/stories", label: "Watching Stories", type: 3 },
      { prefix: "/direct", label: "Chatting" },
      { prefix: "/explore", label: "Exploring" },
    ],
  },
  {
    id: "facebook", name: "Facebook", hosts: ["facebook.com"], type: 0, defaultLabel: "Scrolling the feed",
    rules: [
      { prefix: "/watch", label: "Watching videos", type: 3 },
      { prefix: "/reel", label: "Watching Reels", type: 3 },
      { prefix: "/messages", label: "Chatting" },
      { prefix: "/marketplace", label: "Browsing Marketplace" },
      { prefix: "/groups", label: "In a group" },
    ],
  },
  { id: "messenger", name: "Messenger", hosts: ["messenger.com"], type: 0, defaultLabel: "Chatting", rules: [] },
  { id: "whatsapp", name: "WhatsApp", hosts: ["web.whatsapp.com"], type: 0, defaultLabel: "Chatting", rules: [] },
  { id: "telegram", name: "Telegram", hosts: ["web.telegram.org"], type: 0, defaultLabel: "Chatting", rules: [] },
  { id: "snapchat", name: "Snapchat", hosts: ["web.snapchat.com"], type: 0, defaultLabel: "Chatting", rules: [] },
  {
    id: "discord", name: "Discord", hosts: ["discord.com"], type: 0, defaultLabel: "Browsing Discord",
    rules: [{ prefix: "/channels", label: "Chatting" }, { prefix: "/app", label: "Chatting" }],
  },
  {
    id: "x", name: "X", hosts: ["x.com", "twitter.com"], type: 0, defaultLabel: "Scrolling the timeline",
    rules: [{ prefix: "/messages", label: "Chatting" }],
  },
  { id: "reddit", name: "Reddit", hosts: ["reddit.com"], type: 0, defaultLabel: "Browsing Reddit", rules: [] },
  {
    id: "tiktok", name: "TikTok", hosts: ["tiktok.com"], type: 3, defaultLabel: "Watching TikToks",
    rules: [{ prefix: "/messages", label: "Chatting", type: 0 }],
  },
  {
    id: "twitch", name: "Twitch", hosts: ["twitch.tv"], type: 3, defaultLabel: "Watching a stream",
    rules: [{ prefix: "/directory", label: "Browsing streams", type: 0 }],
  },
  {
    id: "netflix", name: "Netflix", hosts: ["netflix.com"], type: 3, defaultLabel: "Watching Netflix",
    rules: [{ prefix: "/browse", label: "Choosing something to watch", type: 0 }],
    player: {
      paths: ["/watch/"],
      titleSelectors: ['[data-uia="video-title"] h4', '[data-uia="video-title"]', ".video-title h4", ".video-title"],
      strip: [/\s*[-|]\s*Netflix$/i, /^Netflix\s*[-|:]\s*/i],
    },
  },
  { id: "primevideo", name: "Prime Video", hosts: ["primevideo.com"], type: 3, defaultLabel: "Watching Prime Video", rules: [],
    player: {
      titleSelectors: [".atvwebplayersdk-title-text", 'h1[data-automation-id="title"]'],
      strip: [/^Prime Video:\s*/i, /\s*[-|]\s*Prime Video$/i, /^Watch\s+/i],
    },
  },
  { id: "hotstar", name: "JioHotstar", hosts: ["hotstar.com", "jiohotstar.com"], type: 3, defaultLabel: "Watching JioHotstar", rules: [],
    player: { strip: [/\s*[-|]\s*(Jio)?Hotstar.*$/i, /^Watch\s+/i, /\s+Online( Free)?$/i] },
  },
  { id: "disneyplus", name: "Disney+", hosts: ["disneyplus.com"], type: 3, defaultLabel: "Watching Disney+", rules: [],
    player: { strip: [/^Watch\s+/i, /^Play\s+/i, /\s*[-|]\s*Disney\+.*$/i, /^Disney\+\s*[-|:]\s*/i] },
  },
  { id: "hulu", name: "Hulu", hosts: ["hulu.com"], type: 3, defaultLabel: "Watching Hulu", rules: [], player: { strip: [/\s*[-|]\s*Hulu$/i, /^Watch\s+/i] } },
  { id: "max", name: "Max", hosts: ["max.com", "hbomax.com"], type: 3, defaultLabel: "Watching Max", rules: [], player: { strip: [/\s*[-|]\s*Max$/i, /^Watch\s+/i] } },
  { id: "crunchyroll", name: "Crunchyroll", hosts: ["crunchyroll.com"], type: 3, defaultLabel: "Watching Crunchyroll", rules: [], player: { strip: [/\s*[-|]\s*Crunchyroll$/i, /^Watch\s+/i] } },
  { id: "sonyliv", name: "SonyLIV", hosts: ["sonyliv.com"], type: 3, defaultLabel: "Watching SonyLIV", rules: [], player: { strip: [/\s*[-|]\s*SonyLIV.*$/i, /^Watch\s+/i] } },
  { id: "zee5", name: "ZEE5", hosts: ["zee5.com"], type: 3, defaultLabel: "Watching ZEE5", rules: [], player: { strip: [/\s*[-|]\s*ZEE5.*$/i, /^Watch\s+/i, /\s+Online( Free)?$/i] } },
  { id: "appletv", name: "Apple TV", hosts: ["tv.apple.com"], type: 3, defaultLabel: "Watching Apple TV", rules: [], player: { strip: [/\s*[-\u2013|]\s*Apple\s*TV.*$/i, /^Watch\s+/i] } },
  { id: "spotify", name: "Spotify", hosts: ["open.spotify.com"], type: 2, defaultLabel: "Listening to music", rules: [] },
  { id: "github", name: "GitHub", hosts: ["github.com"], type: 0, defaultLabel: "Browsing code", rules: [] },
  { id: "stackoverflow", name: "Stack Overflow", hosts: ["stackoverflow.com"], type: 0, defaultLabel: "Looking for answers", rules: [] },
  { id: "chatgpt", name: "ChatGPT", hosts: ["chatgpt.com", "chat.openai.com"], type: 0, defaultLabel: "Chatting with an AI", rules: [] },
  { id: "claude", name: "Claude", hosts: ["claude.ai"], type: 0, defaultLabel: "Chatting with an AI", rules: [] },
  {
    id: "linkedin", name: "LinkedIn", hosts: ["linkedin.com"], type: 0, defaultLabel: "Browsing LinkedIn",
    rules: [{ prefix: "/messaging", label: "Chatting" }],
  },
  { id: "pinterest", name: "Pinterest", hosts: ["pinterest.com"], type: 0, defaultLabel: "Browsing ideas", rules: [] },
  { id: "wikipedia", name: "Wikipedia", hosts: ["wikipedia.org"], type: 0, defaultLabel: "Reading", rules: [] },
];

export const OTHER_SITE_ID = "other";
const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com"];

export const siteById = (id: string | undefined): SiteProfile | undefined => SITES.find((s) => s.id === id);

export const hostMatches = (host: string, base: string): boolean => host === base || host.endsWith(`.${base}`);

/** Chrome match patterns that grant access to a site (and its subdomains). */
export function originPatterns(site: SiteProfile): string[] {
  return site.hosts.map((h) => `https://*.${h}/*`);
}

export const ALL_SITES_PATTERN = "https://*/*";

/** Hosts that must never be shared, even when "all other websites" is enabled. */
const SENSITIVE_HOST = new RegExp(
  [
    "bank", "paypal", "stripe", "razorpay", "paytm", "phonepe", "gpay", "upi", "wallet", "coinbase", "binance",
    "(^|\\.)(mail|webmail|outlook|proton|tutanota|yahoo)\\.", "gmail", "icloud", "(^|\\.)(accounts?|login|signin|auth|sso|id)\\.",
    "health", "medical", "clinic", "hospital", "pharma", "therapy", "(^|\\.)gov(\\.|$)", "tax", "insurance",
    "porn", "xvideos", "xnxx", "xhamster", "onlyfans", "dating", "tinder", "bumble",
  ].join("|"),
  "i",
);

export function isPublicHost(host: string): boolean {
  if (!host || host.length > 100) return false;
  if (!host.includes(".")) return false; // localhost, intranet names
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false; // IPs
  if (/\.(local|internal|lan|corp|home|localdomain)$/i.test(host)) return false;
  return true;
}

export function isSensitiveHost(host: string): boolean {
  return SENSITIVE_HOST.test(host);
}

export type WebActivity = {
  siteId: string;
  siteName: string;
  label: string;
  type: ActivityType;
  /** domain used for the favicon image */
  domain: string;
};

const stripWww = (h: string) => h.replace(/^www\./, "");

/** Classify a page for a curated site. Returns null for anything not on the curated list. */
export function classify(url: URL): WebActivity | null {
  if (url.protocol !== "https:") return null;
  const host = stripWww(url.hostname.toLowerCase());
  for (const site of SITES) {
    const base = site.hosts.find((h) => hostMatches(host, h));
    if (!base) continue;
    const path = url.pathname.toLowerCase();
    const rule = site.rules.find((r) => path.startsWith(r.prefix));
    return {
      siteId: site.id,
      siteName: site.name,
      label: rule?.label ?? site.defaultLabel,
      type: rule?.type ?? site.type,
      domain: base,
    };
  }
  return null;
}

/** For "all other websites": the domain only, never the title or path. */
export function classifyGeneric(url: URL): WebActivity | null {
  if (url.protocol !== "https:") return null;
  const host = stripWww(url.hostname.toLowerCase());
  if (!isPublicHost(host) || isSensitiveHost(host)) return null;
  if (YOUTUBE_HOSTS.some((h) => hostMatches(host, h))) return null; // handled by the media providers
  if (SITES.some((s) => s.hosts.some((h) => hostMatches(host, h)))) return null; // curated site, handled by classify()
  return { siteId: OTHER_SITE_ID, siteName: host.slice(0, 40), label: "Browsing the web", type: 0, domain: host };
}

export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}
