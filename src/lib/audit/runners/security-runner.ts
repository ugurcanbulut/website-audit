/**
 * Security header audit runner
 *
 * Checks HTTP response headers against security best practices and produces
 * AuditIssueInput records for missing or weak headers.
 */

export interface AuditIssueInput {
  category: string;
  severity: "critical" | "warning" | "info" | "pass";
  ruleId: string;
  title: string;
  description: string;
  elementSelector?: string;
  elementHtml?: string;
  recommendation?: string;
  details?: Record<string, unknown>;
}

export interface SecurityRunnerInput {
  responseHeaders: Record<string, string>;
  url: string;
}

interface HeaderCheck {
  header: string;
  severity: AuditIssueInput["severity"];
  title: string;
  description: string;
  recommendation: string;
  /** Only run this check when the predicate returns true. */
  condition?: (input: SecurityRunnerInput) => boolean;
  /**
   * Optional validator that inspects the header value and returns an issue
   * when the value is present but weak / misconfigured.  Return null if the
   * value is acceptable.
   */
  validateValue?: (
    value: string,
    input: SecurityRunnerInput
  ) => Omit<AuditIssueInput, "category" | "ruleId"> | null;
}

const HEADER_CHECKS: HeaderCheck[] = [
  // -----------------------------------------------------------------------
  // 1. Content-Security-Policy
  // -----------------------------------------------------------------------
  {
    header: "content-security-policy",
    severity: "critical",
    title: "Missing Content-Security-Policy header",
    description:
      "The Content-Security-Policy (CSP) header is not set. CSP is one of the most effective defences against cross-site scripting (XSS) and data injection attacks. Without it, the browser cannot restrict the sources of scripts, styles, and other resources.",
    recommendation:
      "Set a Content-Security-Policy header that restricts resource loading to trusted origins. Start with a strict policy such as \"default-src 'self'\" and iteratively allow required sources.",
  },

  // -----------------------------------------------------------------------
  // 2. Strict-Transport-Security
  // -----------------------------------------------------------------------
  {
    header: "strict-transport-security",
    severity: "warning",
    title: "Missing Strict-Transport-Security header",
    description:
      "The Strict-Transport-Security (HSTS) header is not set. HSTS tells browsers to only communicate with the server over HTTPS, preventing protocol downgrade attacks and cookie hijacking.",
    recommendation:
      'Set the Strict-Transport-Security header with a max-age of at least one year: "max-age=31536000; includeSubDomains".',
    condition: (input) => input.url.startsWith("https"),
    validateValue: (value) => {
      const maxAgeMatch = value.match(/max-age=(\d+)/i);
      if (!maxAgeMatch) {
        return {
          severity: "warning",
          title: "Weak Strict-Transport-Security header",
          description:
            "The Strict-Transport-Security header is present but does not contain a valid max-age directive.",
          recommendation:
            'Set a max-age of at least 31536000 (one year): "max-age=31536000; includeSubDomains".',
        };
      }
      const maxAge = parseInt(maxAgeMatch[1], 10);
      if (maxAge < 31536000) {
        return {
          severity: "info",
          title: "Weak Strict-Transport-Security max-age",
          description: `The HSTS max-age is ${maxAge} seconds (${Math.round(maxAge / 86400)} days). The recommended minimum is 31536000 seconds (one year).`,
          recommendation:
            'Increase max-age to at least 31536000: "max-age=31536000; includeSubDomains".',
        };
      }
      return null;
    },
  },

  // -----------------------------------------------------------------------
  // 3. X-Content-Type-Options
  // -----------------------------------------------------------------------
  {
    header: "x-content-type-options",
    severity: "warning",
    title: "Missing X-Content-Type-Options header",
    description:
      'The X-Content-Type-Options header is not set to "nosniff". Without it, browsers may perform MIME-type sniffing, which can lead to security vulnerabilities such as drive-by downloads.',
    recommendation:
      'Set the X-Content-Type-Options header to "nosniff".',
    validateValue: (value) => {
      if (value.toLowerCase().trim() !== "nosniff") {
        return {
          severity: "warning",
          title: "Invalid X-Content-Type-Options value",
          description: `The X-Content-Type-Options header is set to "${value}" instead of "nosniff".`,
          recommendation:
            'Set the X-Content-Type-Options header to exactly "nosniff".',
        };
      }
      return null;
    },
  },

  // -----------------------------------------------------------------------
  // 4. X-Frame-Options
  // -----------------------------------------------------------------------
  {
    header: "x-frame-options",
    severity: "info",
    title: "Missing X-Frame-Options header",
    description:
      "The X-Frame-Options header is not set. This header prevents the page from being embedded in iframes on other origins, mitigating clickjacking attacks.",
    recommendation:
      'Set X-Frame-Options to "DENY" or "SAMEORIGIN". Note: the CSP frame-ancestors directive is the modern replacement.',
    validateValue: (value) => {
      const normalised = value.toUpperCase().trim();
      if (normalised !== "DENY" && normalised !== "SAMEORIGIN") {
        return {
          severity: "info",
          title: "Weak X-Frame-Options value",
          description: `The X-Frame-Options header is set to "${value}". Only "DENY" and "SAMEORIGIN" are recommended values.`,
          recommendation:
            'Set X-Frame-Options to "DENY" or "SAMEORIGIN".',
        };
      }
      return null;
    },
  },

  // -----------------------------------------------------------------------
  // 5. Referrer-Policy
  // -----------------------------------------------------------------------
  {
    header: "referrer-policy",
    severity: "info",
    title: "Missing Referrer-Policy header",
    description:
      "The Referrer-Policy header is not set. Without it, the browser uses its default policy which may leak the full URL as a referrer to third-party sites.",
    recommendation:
      'Set a Referrer-Policy header such as "strict-origin-when-cross-origin" or "no-referrer".',
  },

  // -----------------------------------------------------------------------
  // 6. Permissions-Policy
  // -----------------------------------------------------------------------
  {
    header: "permissions-policy",
    severity: "info",
    title: "Missing Permissions-Policy header",
    description:
      "The Permissions-Policy header is not set. This header allows you to control which browser features (camera, microphone, geolocation, etc.) can be used by the page and its embedded iframes.",
    recommendation:
      'Set a Permissions-Policy header that disables unused features, e.g. "camera=(), microphone=(), geolocation=()".',
  },

  // -----------------------------------------------------------------------
  // 7. Cross-Origin-Opener-Policy
  // -----------------------------------------------------------------------
  {
    header: "cross-origin-opener-policy",
    severity: "info",
    title: "Missing Cross-Origin-Opener-Policy header",
    description:
      "The Cross-Origin-Opener-Policy (COOP) header is not set. COOP isolates the browsing context, preventing cross-origin documents from accessing the window object and mitigating Spectre-type side-channel attacks.",
    recommendation:
      'Set the Cross-Origin-Opener-Policy header to "same-origin" for maximum isolation.',
  },
];

/**
 * Normalise header keys to lowercase for case-insensitive lookup.
 */
function normaliseHeaders(
  headers: Record<string, string>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(headers)) {
    map.set(key.toLowerCase(), value);
  }
  return map;
}

/**
 * Check HTTP response headers for security best practices.
 *
 * Each check evaluates a specific security header and produces either a
 * "missing" issue when the header is absent, a "weak" issue when the value
 * does not meet best practices, or nothing when the header is acceptable.
 */
export function runSecurityChecks(
  input: SecurityRunnerInput
): AuditIssueInput[] {
  const headers = normaliseHeaders(input.responseHeaders);
  const issues: AuditIssueInput[] = [];

  for (const check of HEADER_CHECKS) {
    // Skip checks whose precondition is not met (e.g. HSTS on non-HTTPS)
    if (check.condition && !check.condition(input)) continue;

    const ruleId = `security-${check.header}`;
    const value = headers.get(check.header);

    if (!value) {
      // Header is absent
      issues.push({
        category: "security",
        severity: check.severity,
        ruleId,
        title: check.title,
        description: check.description,
        recommendation: check.recommendation,
        details: { header: check.header, url: input.url },
      });
      continue;
    }

    // Header is present -- run value validation if available
    if (check.validateValue) {
      const weakness = check.validateValue(value, input);
      if (weakness) {
        issues.push({
          category: "security",
          severity: weakness.severity,
          ruleId,
          title: weakness.title,
          description: weakness.description,
          recommendation: weakness.recommendation,
          details: {
            header: check.header,
            currentValue: value,
            url: input.url,
          },
        });
      }
    }
  }

  return issues;
}
