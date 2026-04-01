import type { ViewportConfig } from "@/lib/types";
import { DEVICE_PRESETS, getDeviceByName, getDevicesByNames as getDevicesByNamesInternal } from "./devices";

// Backward-compatible viewport presets (mapped from device presets)
export const VIEWPORT_PRESETS: ViewportConfig[] = DEVICE_PRESETS.map((d) => ({
  name: d.name,
  width: d.width,
  height: d.height,
  type: d.type,
}));

export const DEFAULT_VIEWPORTS = VIEWPORT_PRESETS.map((v) => v.name);

export function getViewportByName(name: string): ViewportConfig | undefined {
  const device = getDeviceByName(name);
  if (!device) return undefined;
  return { name: device.name, width: device.width, height: device.height, type: device.type };
}

export function getViewportsByNames(names: string[]): ViewportConfig[] {
  return getDevicesByNamesInternal(names).map((d) => ({
    name: d.name,
    width: d.width,
    height: d.height,
    type: d.type,
  }));
}

// Re-export device functions
export { DEVICE_PRESETS, getDeviceByName, getDevicesByNames } from "./devices";
