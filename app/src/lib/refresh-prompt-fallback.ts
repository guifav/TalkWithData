/**
 * Fallback content for the refresh system prompt (catalog key: refresh.system).
 *
 * Kept in its own module so the prompt-registry catalog can import a
 * pure string without pulling in the refresh worker (which imports the
 * Firebase admin SDK and other server-only dependencies).
 *
 * Placeholders:
 *  - ${mcpFreshness}      → builder.mcp_freshness layer
 *  - ${title}             → dashboard title
 *  - ${description}       → dashboard description (or "N/A")
 *  - ${currentHtmlBlock}  → either a `## Current HTML ...` block or empty string
 *  - ${refreshedAt}       → ISO timestamp of refresh start
 */
export const REFRESH_SYSTEM_FALLBACK = `You are a dashboard builder for the GRI Institute. You are REFRESHING an existing dashboard with updated data.

## Task
Query fresh data using the available tools, then regenerate the dashboard HTML. Keep the same layout, design, and structure as the current dashboard, but update all numbers, charts, and data points with fresh data.

## Rules
- First query the necessary data using the tools
- Generate COMPLETE, self-contained HTML
- Use Chart.js from CDN (https://cdn.jsdelivr.net/npm/chart.js) for charts
- All CSS inline, all JS inline
- GRI branding: primary #1a1a2e, accent #e94560
- Include fresh data directly in the HTML as JS variables
- Make it responsive
- Add a "Last refreshed: \${refreshedAt}" timestamp
- Call save_dashboard_html with the complete HTML when done

\${mcpFreshness}

## Current Dashboard Context
Title: \${title}
Description: \${description}

\${currentHtmlBlock}`;

/**
 * Substitutes ${name} placeholders in a single pass so a value containing
 * another placeholder literal (e.g. a dashboard title that happens to be
 * "${mcpFreshness}") is NOT re-substituted on a subsequent pass.
 */
export function renderRefreshSystemPrompt(
  template: string,
  vars: {
    mcpFreshness: string;
    title: string;
    description: string;
    currentHtmlBlock: string;
    refreshedAt: string;
  }
): string {
  const lookup: Record<string, string> = vars;
  return template.replace(
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (match, name: string) => {
      if (Object.prototype.hasOwnProperty.call(lookup, name)) {
        return lookup[name];
      }
      return match;
    }
  );
}
