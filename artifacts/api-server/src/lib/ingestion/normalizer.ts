const HTML_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;
const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&hellip;": "…",
  "&mdash;": "—", "&ndash;": "–", "&lsquo;": "'", "&rsquo;": "'",
  "&ldquo;": "\u201C", "&rdquo;": "\u201D",
};

export function stripHtml(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(HTML_TAG_RE, " ");

  text = text.replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY_MAP[entity] ?? " ");
  return text.replace(WHITESPACE_RE, " ").trim();
}

export function truncate(text: string, maxLength = 2000): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

export function normalizeBody(raw: string): string {
  return truncate(stripHtml(raw));
}

export function normalizeTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return stripHtml(raw).slice(0, 500).trim() || null;
}
