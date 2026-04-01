import type { DevicePreset } from "@/lib/types";

/**
 * Curated device presets for UI auditing.
 * Mobile and tablet devices use exact Playwright device descriptors.
 * Desktop presets are custom with common resolutions.
 */
export const DEVICE_PRESETS: DevicePreset[] = [
  // ══════════════════════════════════════════════════════════════════
  // PHONES (portrait only) — exact Playwright descriptors
  // ══════════════════════════════════════════════════════════════════

  // iPhone 15 series
  { name: "iPhone 15", width: 393, height: 659, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 15 Plus", width: 430, height: 739, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 15 Pro", width: 393, height: 659, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 15 Pro Max", width: 430, height: 739, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },

  // iPhone 14 series
  { name: "iPhone 14", width: 390, height: 664, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 14 Plus", width: 428, height: 746, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 14 Pro", width: 393, height: 660, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPhone 14 Pro Max", width: 430, height: 740, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },

  // Older iPhones
  { name: "iPhone SE (3rd gen)", width: 375, height: 667, type: "mobile", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/26.0 Mobile/19E241 Safari/602.1" },
  { name: "iPhone 13 Mini", width: 375, height: 629, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },

  // Android
  { name: "Pixel 7", width: 412, height: 839, type: "mobile", deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, defaultBrowserType: "chromium", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Mobile Safari/537.36" },
  { name: "Galaxy S24", width: 360, height: 780, type: "mobile", deviceScaleFactor: 3, isMobile: true, hasTouch: true, defaultBrowserType: "chromium", userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Mobile Safari/537.36" },

  // ══════════════════════════════════════════════════════════════════
  // TABLETS (portrait + landscape) — exact Playwright descriptors
  // ══════════════════════════════════════════════════════════════════

  { name: "iPad Mini", width: 768, height: 1024, type: "tablet", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPad Mini landscape", width: 1024, height: 768, type: "tablet", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },

  { name: "iPad Pro 11", width: 834, height: 1194, type: "tablet", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPad Pro 11 landscape", width: 1194, height: 834, type: "tablet", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },

  { name: "iPad (gen 7)", width: 810, height: 1080, type: "tablet", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },
  { name: "iPad (gen 7) landscape", width: 1080, height: 810, type: "tablet", deviceScaleFactor: 2, isMobile: true, hasTouch: true, defaultBrowserType: "webkit", userAgent: "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1" },

  { name: "Galaxy Tab S4", width: 712, height: 1138, type: "tablet", deviceScaleFactor: 2.25, isMobile: true, hasTouch: true, defaultBrowserType: "chromium", userAgent: "Mozilla/5.0 (Linux; Android 8.1.0; SM-T837A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Safari/537.36" },
  { name: "Galaxy Tab S4 landscape", width: 1138, height: 712, type: "tablet", deviceScaleFactor: 2.25, isMobile: true, hasTouch: true, defaultBrowserType: "chromium", userAgent: "Mozilla/5.0 (Linux; Android 8.1.0; SM-T837A) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.7632.6 Safari/537.36" },

  // ══════════════════════════════════════════════════════════════════
  // DESKTOPS — custom presets
  // ══════════════════════════════════════════════════════════════════

  { name: "Desktop 1280", width: 1280, height: 800, type: "desktop", deviceScaleFactor: 1, isMobile: false, hasTouch: false, defaultBrowserType: "chromium" },
  { name: "Desktop 1440", width: 1440, height: 900, type: "desktop", deviceScaleFactor: 1, isMobile: false, hasTouch: false, defaultBrowserType: "chromium" },
  { name: "Desktop 1920", width: 1920, height: 1080, type: "desktop", deviceScaleFactor: 1, isMobile: false, hasTouch: false, defaultBrowserType: "chromium" },
  { name: "Desktop HiDPI", width: 1280, height: 720, type: "desktop", deviceScaleFactor: 2, isMobile: false, hasTouch: false, defaultBrowserType: "chromium" },
  { name: "MacBook Pro 14\"", width: 1512, height: 982, type: "desktop", deviceScaleFactor: 2, isMobile: false, hasTouch: false, defaultBrowserType: "chromium" },
  { name: "MacBook Pro 16\"", width: 1728, height: 1117, type: "desktop", deviceScaleFactor: 2, isMobile: false, hasTouch: false, defaultBrowserType: "chromium" },
];

/** Default selection: covers key breakpoints */
export const DEFAULT_DEVICES = [
  "iPhone 15 Pro",
  "Pixel 7",
  "iPad Pro 11",
  "Desktop 1440",
  "Desktop 1920",
];

export function getDeviceByName(name: string): DevicePreset | undefined {
  return DEVICE_PRESETS.find((d) => d.name === name);
}

export function getDevicesByNames(names: string[]): DevicePreset[] {
  return names
    .map(getDeviceByName)
    .filter((d): d is DevicePreset => d !== undefined);
}

export function getDevicesGroupedByType(): Record<string, DevicePreset[]> {
  const groups: Record<string, DevicePreset[]> = {
    mobile: [],
    tablet: [],
    desktop: [],
  };
  for (const device of DEVICE_PRESETS) {
    groups[device.type].push(device);
  }
  return groups;
}
