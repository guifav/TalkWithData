/**
 * Extract readable text from HTML content by stripping tags.
 * Lightweight — no external dependencies.
 */
export function extractTextFromHtml(html: string): string {
  return (
    html
      // Remove script and style blocks
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, " ")
      // Replace tags with space (preserves word boundaries)
      .replace(/<[^>]+>/g, " ")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Max bytes to store in searchableText field (100KB) */
export const MAX_SEARCHABLE_TEXT = 100_000;
