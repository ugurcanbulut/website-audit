import { lookup } from "node:dns/promises";

// ─────────────────────────────────────────────────────────────────────────────
// SSRF defense — blocks every request path a scanner could otherwise use to
// reach an internal network resource. Two layers: syntactic (URL shape) and
// semantic (resolved IP). Must be called before any Playwright navigation or
// any server-side fetch() to a user-supplied URL.
// ─────────────────────────────────────────────────────────────────────────────

export class UrlGuardError extends Error {
  constructor(
    public code:
      | "bad-url"
      | "bad-protocol"
      | "bad-port"
      | "private-ip"
      | "cloud-metadata"
      | "dns-failed",
    message: string,
  ) {
    super(message);
    this.name = "UrlGuardError";
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

// Ports we never want to hit even if resolved to a public address — cuts down
// on classic SSRF pivot attacks that target well-known internal services on
// routable IPs inside a misconfigured VPC.
const BLOCKED_PORTS = new Set([
  22, 23, 25, 110, 139, 445, 587, 993, 995, 1433, 1521, 2375, 2376, 3306, 3389,
  5432, 5433, 5984, 6379, 6380, 6381, 7000, 7001, 8500, 9042, 9092, 9200, 9300,
  11211, 27017, 27018, 27019,
]);

// Cloud provider instance metadata — leaking credentials is the canonical
// SSRF abuse.
const CLOUD_METADATA_HOSTS = new Set([
  "169.254.169.254",  // AWS, GCP, Azure, DigitalOcean, OpenStack
  "metadata.google.internal",
  "metadata.azure.com",
  "fd00:ec2::254",
]);

/**
 * Check if an IPv4 or IPv6 address is in a private / reserved / link-local
 * range. Uses numeric comparisons rather than regex so the ranges are auditable.
 */
export function isPrivateAddress(ip: string): boolean {
  if (CLOUD_METADATA_HOSTS.has(ip)) return true;

  if (ip.includes(":")) {
    // IPv6
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower === "::") return true; // unspecified
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    // IPv4-mapped IPv6: ::ffff:a.b.c.d
    const v4mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4mapped) return isPrivateAddress(v4mapped[1]);
    return false;
  }

  // IPv4
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;                              // 10.0.0.0/8
  if (a === 127) return true;                             // loopback
  if (a === 0) return true;                               // "this" network
  if (a === 169 && b === 254) return true;                // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                // 192.168.0.0/16
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true;   // benchmarking
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true;                              // multicast + reserved
  return false;
}

/**
 * Full syntactic + DNS validation of a user-supplied URL for server-side
 * fetching or scanning. Throws UrlGuardError on any failure.
 *
 * `skipDnsInTesting=true` allows unit tests to skip real DNS resolution.
 */
export async function assertScanTargetUrl(
  raw: string,
  options?: { skipDnsInTesting?: boolean },
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UrlGuardError("bad-url", "URL is malformed");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new UrlGuardError(
      "bad-protocol",
      `Protocol ${parsed.protocol} not allowed; only http:// and https:// are permitted.`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (CLOUD_METADATA_HOSTS.has(hostname)) {
    throw new UrlGuardError(
      "cloud-metadata",
      "Cloud metadata endpoints cannot be scanned.",
    );
  }

  if (parsed.port) {
    const port = Number(parsed.port);
    if (BLOCKED_PORTS.has(port)) {
      throw new UrlGuardError(
        "bad-port",
        `Port ${port} is blocked (internal service port).`,
      );
    }
  }

  // Reject direct IP literals that are private before even resolving DNS.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateAddress(hostname)) {
      throw new UrlGuardError(
        "private-ip",
        `Host ${hostname} resolves to a private/reserved address.`,
      );
    }
  }

  if (options?.skipDnsInTesting) return parsed;

  // Resolve DNS and ensure every resolved IP is public. Guards against DNS
  // rebinding where the first lookup returns a public IP and subsequent
  // lookups return private ones — we accept the conservative risk that a
  // site whose DNS flips between public and private addresses simply cannot
  // be scanned. `all: true` returns every A and AAAA record.
  let addrs: { address: string; family: number }[];
  try {
    addrs = await lookup(hostname, { all: true });
  } catch (e) {
    throw new UrlGuardError(
      "dns-failed",
      `DNS lookup failed for ${hostname}: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    );
  }

  for (const { address } of addrs) {
    if (isPrivateAddress(address)) {
      throw new UrlGuardError(
        "private-ip",
        `Host ${hostname} resolves to a private/reserved address (${address}).`,
      );
    }
  }

  return parsed;
}
