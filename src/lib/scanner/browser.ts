import { randomInt } from "node:crypto";
import type { Browser } from "playwright";
import type { BrowserEngine } from "@/lib/types";

export interface BrowserSession {
  browser: Browser;
  engine: BrowserEngine;
  debuggingPort?: number;
}

// Allocate a fresh Chromium debugging port per launch. Lighthouse connects
// to this port, and two browsers cannot share a port. A shared module-level
// port (the old design) made concurrent scans impossible.
function allocateDebuggingPort(): number {
  // 9222 is the Chromium default; spread around it to avoid clashes with any
  // dev-tools instance a user might be running on the host.
  return 9222 + randomInt(1, 10000);
}

export async function launchBrowser(
  engine: BrowserEngine = "chromium",
): Promise<BrowserSession> {
  const pw = await import(/* webpackIgnore: true */ "playwright");

  const launcher = {
    chromium: pw.chromium,
    firefox: pw.firefox,
    webkit: pw.webkit,
  }[engine];

  const debuggingPort =
    engine === "chromium" ? allocateDebuggingPort() : undefined;

  const args =
    engine === "chromium"
      ? [
          // --no-sandbox is required when the container runs as a non-root
          // user without proper user-namespace config. SSRF and URL guard
          // (src/lib/security/url-guard.ts) are the primary defense; sandbox
          // removal is tracked as follow-up (docker userns config).
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--autoplay-policy=no-user-gesture-required",
          "--use-gl=angle",
          "--use-angle=swiftshader",
          `--remote-debugging-port=${debuggingPort}`,
        ]
      : [];

  const browser = await launcher.launch({
    headless: true,
    args,
  });

  return { browser, engine, debuggingPort };
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  try {
    await session.browser.close();
  } catch {
    // Browser may already be closed; ignore.
  }
}
