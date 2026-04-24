export interface RobotsRules {
  allowedPaths: string[];
  disallowedPaths: string[];
  sitemaps: string[];
  crawlDelay?: number;
}

export function parseRobotsTxt(content: string, userAgent = "*"): RobotsRules {
  const rules: RobotsRules = {
    allowedPaths: [],
    disallowedPaths: [],
    sitemaps: [],
  };

  let currentAgent = "";
  let isRelevantAgent = false;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === "user-agent") {
      currentAgent = value.toLowerCase();
      isRelevantAgent = currentAgent === "*" || currentAgent === userAgent.toLowerCase();
    } else if (directive === "sitemap") {
      rules.sitemaps.push(value);
    } else if (isRelevantAgent) {
      if (directive === "allow") {
        // Empty Allow is a no-op per RFC 9309.
        if (value !== "") rules.allowedPaths.push(value);
      } else if (directive === "disallow") {
        // Per RFC 9309 §2.2.2, `Disallow:` with an empty value means
        // "nothing is disallowed" — skip rather than push "", which would
        // otherwise match every path via startsWith("") and silently block
        // all crawling. americas.land's robots.txt exhibits this pattern.
        if (value !== "") rules.disallowedPaths.push(value);
      } else if (directive === "crawl-delay") {
        rules.crawlDelay = parseInt(value, 10) * 1000;
      }
    }
  }

  return rules;
}

export function isPathAllowed(path: string, rules: RobotsRules): boolean {
  // RFC 9309 §2.2.2: the most specific match wins, with specificity measured
  // by the length of the matching pattern. On ties, Allow wins.
  let longestDisallow = -1;
  for (const d of rules.disallowedPaths) {
    if (path.startsWith(d) && d.length > longestDisallow) {
      longestDisallow = d.length;
    }
  }
  if (longestDisallow < 0) return true;

  let longestAllow = -1;
  for (const a of rules.allowedPaths) {
    if (path.startsWith(a) && a.length > longestAllow) {
      longestAllow = a.length;
    }
  }
  return longestAllow >= longestDisallow;
}
