/**
 * Simple markdown-to-HTML converter. No external dependencies.
 * Supports: bold, italic, inline code, code blocks, tables, lists, headers, links, line breaks.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function processInline(text: string): string {
  let result = escapeHtml(text);
  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // Italic: *text* or _text_
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // Links: [text](url) — sanitize href to prevent javascript: injection
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match: string, text: string, url: string) => {
      const trimmed = url.trim().toLowerCase();
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) {
        return text; // Strip dangerous link, keep text
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="md-link">${text}</a>`;
    }
  );
  return result;
}

export function formatMarkdown(md: string): string {
  const lines = md.split("\n");
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks: ```
    if (line.trimStart().startsWith("```")) {
      // Sanitize language: only allow alphanumeric + hyphens
      const rawLang = line.trimStart().slice(3).trim();
      const lang = /^[a-zA-Z0-9-]+$/.test(rawLang) ? rawLang : "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      html.push(
        `<pre class="md-code-block"><code${lang ? ` class="language-${lang}"` : ""}>${codeLines.join("\n")}</code></pre>`
      );
      continue;
    }

    // Tables: lines starting with |
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const tableRows: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        tableRows.push(lines[i].trim());
        i++;
      }

      if (tableRows.length >= 2) {
        // Check for separator row (| --- | --- |)
        const isSeparator = (row: string) =>
          row
            .split("|")
            .filter(Boolean)
            .every((c) => /^[\s:-]+$/.test(c));

        let headerRow: string | null = null;
        let bodyRows: string[] = [];

        if (tableRows.length >= 2 && isSeparator(tableRows[1])) {
          headerRow = tableRows[0];
          bodyRows = tableRows.slice(2);
        } else {
          bodyRows = tableRows;
        }

        const parseCells = (row: string) =>
          row
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim());

        let tableHtml = '<div class="md-table-wrapper"><table class="md-table">';
        if (headerRow) {
          tableHtml += "<thead><tr>";
          for (const cell of parseCells(headerRow)) {
            tableHtml += `<th>${processInline(cell)}</th>`;
          }
          tableHtml += "</tr></thead>";
        }
        tableHtml += "<tbody>";
        for (const row of bodyRows) {
          tableHtml += "<tr>";
          for (const cell of parseCells(row)) {
            tableHtml += `<td>${processInline(cell)}</td>`;
          }
          tableHtml += "</tr>";
        }
        tableHtml += "</tbody></table></div>";
        html.push(tableHtml);
      }
      continue;
    }

    // Headers: # to ######
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      html.push(`<h${level} class="md-h${level}">${processInline(headerMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Unordered list: - or *
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      html.push(
        `<ul class="md-ul">${listItems.map((item) => `<li>${processInline(item)}</li>`).join("")}</ul>`
      );
      continue;
    }

    // Ordered list: 1. 2. etc
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      html.push(
        `<ol class="md-ol">${listItems.map((item) => `<li>${processInline(item)}</li>`).join("")}</ol>`
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      html.push('<hr class="md-hr" />');
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph
    html.push(`<p class="md-p">${processInline(line)}</p>`);
    i++;
  }

  return html.join("");
}
