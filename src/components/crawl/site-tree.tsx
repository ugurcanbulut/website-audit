"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getHttpStatusColor } from "@/lib/ui-constants";
import type { SiteTreeNode } from "@/lib/crawler/site-tree";

interface SiteTreeProps {
  tree: SiteTreeNode;
}

function TreeNode({ node, depth = 0 }: { node: SiteTreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isPage = !!node.url;

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        {...(hasChildren ? { "aria-expanded": expanded } : {})}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-2 text-left text-base hover:bg-muted/50 rounded transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          isPage && "font-medium",
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          expanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className="size-3.5 shrink-0" />
        )}

        {/* Node icon */}
        {hasChildren ? (
          expanded ? <FolderOpen className="size-4 shrink-0 text-amber-500" /> : <Folder className="size-4 shrink-0 text-amber-500" />
        ) : (
          <FileText className="size-4 shrink-0 text-muted-foreground" />
        )}

        {/* Segment name */}
        <span className="truncate flex-1">{node.segment === "/" ? "(root)" : node.segment}</span>

        {/* Status code */}
        {node.statusCode && (
          <span className={cn("text-sm tabular-nums shrink-0", getHttpStatusColor(node.statusCode))}>
            {node.statusCode}
          </span>
        )}

        {/* Page count for folders */}
        {hasChildren && (
          <Badge variant="secondary" className="text-sm shrink-0">{node.pageCount}</Badge>
        )}

        {/* Response time */}
        {node.responseTimeMs != null && (
          <span className="text-sm text-muted-foreground tabular-nums shrink-0">
            {node.responseTimeMs}ms
          </span>
        )}
      </button>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.fullPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteTree({ tree }: SiteTreeProps) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <p className="text-base font-medium">Site Structure</p>
        <Badge variant="secondary">{tree.pageCount} pages</Badge>
      </div>
      <div className="max-h-[600px] overflow-y-auto p-1">
        <TreeNode node={tree} />
      </div>
    </div>
  );
}
