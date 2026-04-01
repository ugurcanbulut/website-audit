export interface SiteTreeNode {
  segment: string;       // URL path segment (e.g., "about", "blog")
  fullPath: string;      // Full URL path (e.g., "/about/team")
  url?: string;          // Full URL if this node was actually crawled
  statusCode?: number;
  title?: string;
  wordCount?: number;
  responseTimeMs?: number;
  inlinksCount?: number;
  children: SiteTreeNode[];
  pageCount: number;     // Total pages in this subtree
}

export function buildSiteTree(pages: Array<{
  url: string;
  statusCode: number | null;
  title: string | null;
  wordCount: number | null;
  responseTimeMs: number | null;
  inlinksCount: number | null;
}>): SiteTreeNode {
  const root: SiteTreeNode = {
    segment: "/",
    fullPath: "/",
    children: [],
    pageCount: 0,
  };

  for (const page of pages) {
    let parsedUrl: URL;
    try { parsedUrl = new URL(page.url); } catch { continue; }

    const segments = parsedUrl.pathname.split("/").filter(Boolean);

    let current = root;
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      currentPath += "/" + segments[i];
      let child = current.children.find(c => c.segment === segments[i]);
      if (!child) {
        child = {
          segment: segments[i],
          fullPath: currentPath,
          children: [],
          pageCount: 0,
        };
        current.children.push(child);
      }
      current = child;
    }

    // Assign page data to the leaf node
    current.url = page.url;
    current.statusCode = page.statusCode ?? undefined;
    current.title = page.title ?? undefined;
    current.wordCount = page.wordCount ?? undefined;
    current.responseTimeMs = page.responseTimeMs ?? undefined;
    current.inlinksCount = page.inlinksCount ?? undefined;

    // If root page (no segments), assign to root
    if (segments.length === 0) {
      root.url = page.url;
      root.statusCode = page.statusCode ?? undefined;
      root.title = page.title ?? undefined;
      root.wordCount = page.wordCount ?? undefined;
      root.responseTimeMs = page.responseTimeMs ?? undefined;
      root.inlinksCount = page.inlinksCount ?? undefined;
    }
  }

  // Calculate page counts bottom-up
  function countPages(node: SiteTreeNode): number {
    let count = node.url ? 1 : 0;
    for (const child of node.children) {
      count += countPages(child);
    }
    node.pageCount = count;
    return count;
  }
  countPages(root);

  // Sort children alphabetically
  function sortChildren(node: SiteTreeNode) {
    node.children.sort((a, b) => a.segment.localeCompare(b.segment));
    for (const child of node.children) sortChildren(child);
  }
  sortChildren(root);

  return root;
}
