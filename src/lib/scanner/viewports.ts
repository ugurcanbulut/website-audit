import type { ViewportConfig } from "@/lib/types";

export const VIEWPORT_PRESETS: ViewportConfig[] = [
  { name: "Mobile S", width: 360, height: 800, type: "mobile" },
  { name: "Mobile L", width: 414, height: 896, type: "mobile" },
  { name: "Tablet Portrait", width: 768, height: 1024, type: "tablet" },
  { name: "Tablet Landscape", width: 1024, height: 768, type: "tablet" },
  { name: "Desktop", width: 1280, height: 800, type: "desktop" },
  { name: "Desktop L", width: 1440, height: 900, type: "desktop" },
  { name: "Desktop XL", width: 1920, height: 1080, type: "desktop" },
];

export const DEFAULT_VIEWPORTS = VIEWPORT_PRESETS.map((v) => v.name);

export function getViewportByName(name: string): ViewportConfig | undefined {
  return VIEWPORT_PRESETS.find((v) => v.name === name);
}

export function getViewportsByNames(names: string[]): ViewportConfig[] {
  return names
    .map(getViewportByName)
    .filter((v): v is ViewportConfig => v !== undefined);
}
