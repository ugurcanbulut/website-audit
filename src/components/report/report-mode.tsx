"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Report audience mode.
 *
 * The same scan serves two readers (see the internal-tool product thesis):
 *  - "internal" — the full/raw view: every element, CSS selector, HTML snippet,
 *    AI code-fix. What our team works from.
 *  - "client"   — the clean view handed to the client: findings, severity,
 *    counts, recommendations, screenshots — technical drill-down hidden.
 *
 * The active mode comes from the `?view=client` URL param (server-rendered) and
 * is published via context so any leaf report component can read it without
 * prop-drilling through the tab tree.
 */
export type ReportView = "internal" | "client";

const ReportModeContext = createContext<ReportView>("internal");

export function ReportModeProvider({
  view,
  children,
}: {
  view: ReportView;
  children: ReactNode;
}) {
  return (
    <ReportModeContext.Provider value={view}>
      {children}
    </ReportModeContext.Provider>
  );
}

export function useReportView(): ReportView {
  return useContext(ReportModeContext);
}
