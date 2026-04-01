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
        rules.allowedPaths.push(value);
      } else if (directive === "disallow") {
        rules.disallowedPaths.push(value);
      } else if (directive === "crawl-delay") {
        rules.crawlDelay = parseInt(value, 10) * 1000;
      }
    }
  }

  return rules;
}

export function isPathAllowed(path: string, rules: RobotsRules): boolean {
  // Check allow first (more specific wins)
  for (const allowed of rules.allowedPaths) {
    if (path.startsWith(allowed)) return true;
  }
  for (const disallowed of rules.disallowedPaths) {
    if (disallowed === "" || disallowed === "/") {
      // Disallow all, but check if specifically allowed
      const hasSpecificAllow = rules.allowedPaths.some(a => path.startsWith(a) && a !== "");
      if (!hasSpecificAllow) return false;
    }
    if (path.startsWith(disallowed)) return false;
  }
  return true;
}
