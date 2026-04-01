import type { DevicePreset } from "@/lib/types";

// Curated device presets for UI auditing
// Based on Playwright's built-in device descriptors + custom desktop presets
export const DEVICE_PRESETS: DevicePreset[] = [
  // ── Phones ──────────────────────────────────────────
  {
    name: "iPhone SE",
    width: 375, height: 667, type: "mobile",
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    defaultBrowserType: "webkit",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "iPhone 14",
    width: 390, height: 844, type: "mobile",
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    defaultBrowserType: "webkit",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "iPhone 14 Pro Max",
    width: 430, height: 932, type: "mobile",
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    defaultBrowserType: "webkit",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Pixel 7",
    width: 412, height: 915, type: "mobile",
    deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
    defaultBrowserType: "chromium",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
  },
  {
    name: "Galaxy S21",
    width: 360, height: 800, type: "mobile",
    deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    defaultBrowserType: "chromium",
    userAgent: "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
  },

  // ── Tablets ─────────────────────────────────────────
  {
    name: "iPad Mini",
    width: 768, height: 1024, type: "tablet",
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    defaultBrowserType: "webkit",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "iPad Pro 11",
    width: 834, height: 1194, type: "tablet",
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    defaultBrowserType: "webkit",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "iPad Pro 11 Landscape",
    width: 1194, height: 834, type: "tablet",
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    defaultBrowserType: "webkit",
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  },
  {
    name: "Galaxy Tab S9",
    width: 753, height: 1135, type: "tablet",
    deviceScaleFactor: 2.25, isMobile: true, hasTouch: true,
    defaultBrowserType: "chromium",
    userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X710B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  },

  // ── Desktops ────────────────────────────────────────
  {
    name: "Desktop 1280",
    width: 1280, height: 800, type: "desktop",
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    defaultBrowserType: "chromium",
  },
  {
    name: "Desktop 1440",
    width: 1440, height: 900, type: "desktop",
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    defaultBrowserType: "chromium",
  },
  {
    name: "Desktop 1920",
    width: 1920, height: 1080, type: "desktop",
    deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    defaultBrowserType: "chromium",
  },
  {
    name: "Desktop HiDPI",
    width: 1280, height: 720, type: "desktop",
    deviceScaleFactor: 2, isMobile: false, hasTouch: false,
    defaultBrowserType: "chromium",
  },
  {
    name: "MacBook Pro 16",
    width: 1728, height: 1117, type: "desktop",
    deviceScaleFactor: 2, isMobile: false, hasTouch: false,
    defaultBrowserType: "chromium",
  },
];

export const DEFAULT_DEVICES = [
  "iPhone 14", "Pixel 7", "iPad Pro 11", "Desktop 1440", "Desktop 1920"
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
