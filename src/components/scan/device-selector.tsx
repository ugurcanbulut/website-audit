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
    <div>
      <div className="-mb-2 flex justify-end">
        <button
          type="button"
          onClick={allSelected ? deselectAll : selectAll}
          aria-label={allSelected ? "Deselect all devices" : "Select all devices"}
          className="rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-[var(--brand-soft)]"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {(["mobile", "tablet", "desktop"] as ViewportType[]).map((type) => {
        const Icon = typeIcons[type];
        const devices = grouped[type];
        if (devices.length === 0) return null;
        const groupSelected = devices.filter((d) => selected.includes(d.name)).length;

        return (
          <div key={type} className="mt-3.5">
            <div className="mb-2 flex items-center gap-1.5">
              <Icon className="size-[15px] text-muted-foreground" />
              <span className="text-[13px] font-bold text-[var(--ink-2)]">
                {typeLabels[type]}
              </span>
              <span className="text-[11.5px] text-[var(--faint)]">
                · {groupSelected}/{devices.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {devices.map((device) => {
                const isSelected = selected.includes(device.name);
                return (
                  <button
                    key={device.name}
                    type="button"
                    onClick={() => toggle(device.name)}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[11px] border-[1.5px] px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-[var(--brand-soft)]"
                        : "border-input bg-card hover:bg-muted/50"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-[13px] leading-snug font-bold",
                          isSelected ? "text-primary" : "text-foreground"
                        )}
                      >
                        {device.name}
                      </p>
                      <p className="mt-px font-mono text-[11.5px] leading-snug text-muted-foreground">
                        {device.width}×{device.height}
                        {device.deviceScaleFactor && device.deviceScaleFactor > 1
                          ? ` @${device.deviceScaleFactor}x`
                          : ""}
                        {device.defaultBrowserType === "webkit" ? " · Safari" : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px]",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-input bg-transparent"
                      )}
                    >
                      {isSelected && (
                        <Check className="size-[13px] text-white" strokeWidth={3} />
                      )}
                    </span>
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
