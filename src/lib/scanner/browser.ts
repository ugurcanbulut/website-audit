import type { Browser } from "playwright";
import type { BrowserEngine } from "@/lib/types";

export interface BrowserSession {
  browser: Browser;
  engine: BrowserEngine;
  debuggingPort?: number;
}

const activeSessions = new Map<string, BrowserSession>();

export async function launchBrowser(engine: BrowserEngine = "chromium"): Promise<BrowserSession> {
  // Check for existing session
  const existing = activeSessions.get(engine);
  if (existing && existing.browser.isConnected()) {
    return existing;
  }

  const pw = await import(/* webpackIgnore: true */ "playwright");

  const launcher = {
    chromium: pw.chromium,
    firefox: pw.firefox,
    webkit: pw.webkit,
  }[engine];

  // For Chromium: use a fixed debugging port for Lighthouse
  const DEBUGGING_PORT = 9222;

  const args = engine === "chromium"
    ? [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        `--remote-debugging-port=${DEBUGGING_PORT}`,
      ]
    : [];

  const browser = await launcher.launch({
    headless: true,
    args,
  });

  const session: BrowserSession = {
    browser,
    engine,
    debuggingPort: engine === "chromium" ? DEBUGGING_PORT : undefined,
  };

  activeSessions.set(engine, session);
  return session;
}

export async function closeBrowser(session?: BrowserSession): Promise<void> {
  if (session) {
    try {
      await session.browser.close();
    } catch {
      // Browser may already be closed
    }
    activeSessions.delete(session.engine);
  } else {
    // Close all sessions
    for (const [key, s] of activeSessions) {
      try {
        await s.browser.close();
      } catch {
        // Ignore
      }
      activeSessions.delete(key);
    }
  }
}
