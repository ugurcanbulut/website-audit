"use client";

import { Smartphone, Tablet, Monitor, Check } from "lucide-react";
import { DEVICE_PRESETS } from "@/lib/scanner/devices";
import type { DevicePreset, ViewportType } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeIcons: Record<ViewportType, typeof Smartphone> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

const typeLabels: Record<ViewportType, string> = {
  mobile: "Phones",
  tablet: "Tablets",
  desktop: "Desktops",
};

interface DeviceSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function DeviceSelector({ selected, onChange }: DeviceSelectorProps) {
  const grouped: Record<ViewportType, DevicePreset[]> = { mobile: [], tablet: [], desktop: [] };
  for (const device of DEVICE_PRESETS) {
    grouped[device.type].push(device);
  }

  function toggle(name: string) {
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  function selectAll() {
    onChange(DEVICE_PRESETS.map((d) => d.name));
  }

  function deselectAll() {
    onChange([]);
  }

  const allSelected = selected.length === DEVICE_PRESETS.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-base text-muted-foreground">
          {selected.length} of {DEVICE_PRESETS.length} devices selected
        </p>
        <button
          type="button"
          onClick={allSelected ? deselectAll : selectAll}
          className="text-sm text-primary hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {(["mobile", "tablet", "desktop"] as ViewportType[]).map((type) => {
        const Icon = typeIcons[type];
        const devices = grouped[type];
        if (devices.length === 0) return null;

        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="size-4 text-muted-foreground" />
              <span className="text-base font-medium">{typeLabels[type]}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {devices.map((device) => {
                const isSelected = selected.includes(device.name);
                return (
                  <button
                    key={device.name}
                    type="button"
                    onClick={() => toggle(device.name)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 text-left text-base transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-medium truncate", isSelected && "text-primary")}>
                        {device.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {device.width}x{device.height}
                        {device.deviceScaleFactor && device.deviceScaleFactor > 1
                          ? ` @${device.deviceScaleFactor}x`
                          : ""}
                        {device.defaultBrowserType === "webkit" ? " · Safari" : ""}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
