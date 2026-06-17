"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Loader2,
  Play,
} from "lucide-react";
import type { SiteTreeNode } from "@/lib/crawler/site-tree";
import { urlsInSubtree } from "@/lib/crawler/site-tree";
import { submitSelection } from "@/app/site-audit/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function collectDirPaths(node: SiteTreeNode, depth: number, maxDepth: number, acc: string[]) {
  if (node.children.length > 0 && depth <= maxDepth) acc.push(node.fullPath);
  if (depth < maxDepth) for (const c of node.children) collectDirPaths(c, depth + 1, maxDepth, acc);
}

function TreeRow({
  node,
  depth,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
}: {
  node: SiteTreeNode;
  depth: number;
  selected: Set<string>;
  expanded: Set<string>;
  onToggleSelect: (node: SiteTreeNode) => void;
  onToggleExpand: (path: string) => void;
}) {
  const subtreeUrls = useMemo(() => urlsInSubtree(node), [node]);
  const selectedCount = subtreeUrls.filter((u) => selected.has(u)).length;
  const checked = subtreeUrls.length > 0 && selectedCount === subtreeUrls.length;
  const indeterminate = selectedCount > 0 && !checked;
  const isDir = node.children.length > 0;
  const isOpen = expanded.has(node.fullPath);

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50"
        style={{ paddingLeft: depth * 18 + 4 }}
      >
        <button
          type="button"
          onClick={() => isDir && onToggleExpand(node.fullPath)}
          className={cn("flex size-5 shrink-0 items-center justify-center", !isDir && "invisible")}
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <input
          type="checkbox"
          checked={checked}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate;
          }}
          onChange={() => onToggleSelect(node)}
          className="size-4 shrink-0 accent-primary"
        />
        {isDir ? (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-sm font-medium">
          {node.fullPath === "/" ? "/ (home)" : node.segment}
        </span>
        {node.title && (
          <span className="truncate text-xs text-muted-foreground">— {node.title}</span>
        )}
        {isDir && (
          <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
            {node.pageCount}
          </span>
        )}
      </div>
      {isDir && isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.fullPath}
            node={child}
            depth={depth + 1}
            selected={selected}
            expanded={expanded}
            onToggleSelect={onToggleSelect}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </>
  );
}

export function SiteTreeSelect({
  siteAuditId,
  tree,
}: {
  siteAuditId: string;
  tree: SiteTreeNode;
}) {
  const router = useRouter();
  const allUrls = useMemo(() => urlsInSubtree(tree), [tree]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const dirs: string[] = [];
    collectDirPaths(tree, 0, 1, dirs); // expand the first couple of levels
    return new Set(dirs);
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleSelect(node: SiteTreeNode) {
    const urls = urlsInSubtree(node);
    const allOn = urls.length > 0 && urls.every((u) => selected.has(u));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) urls.forEach((u) => next.delete(u));
      else urls.forEach((u) => next.add(u));
      return next;
    });
  }

  function toggleExpand(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitSelection(siteAuditId, [...selected]);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="text-sm">
          <span className="font-bold tabular-nums">{selected.size}</span>
          <span className="text-muted-foreground"> of {allUrls.length} pages selected</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(allUrls))}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Select all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-[460px] overflow-y-auto p-2">
        {tree.url && (
          <TreeRow
            node={{ ...tree, children: [] }}
            depth={0}
            selected={selected}
            expanded={expanded}
            onToggleSelect={toggleSelect}
            onToggleExpand={toggleExpand}
          />
        )}
        {tree.children.map((child) => (
          <TreeRow
            key={child.fullPath}
            node={child}
            depth={0}
            selected={selected}
            expanded={expanded}
            onToggleSelect={toggleSelect}
            onToggleExpand={toggleExpand}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
        {error ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tip: tick a folder to select its whole branch — skip template-duplicate pages.
          </p>
        )}
        <Button onClick={submit} disabled={pending || selected.size === 0} className="font-bold">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Audit {selected.size} page{selected.size === 1 ? "" : "s"}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
