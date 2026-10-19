/**
 * The editor's formatting buttons. Each one rewrites part of the Markdown
 * source around the selection, so authors get headings, bold or lists
 * without knowing the syntax; the API still receives plain Markdown.
 */

export type MarkdownFormat = "heading" | "bold" | "italic" | "bullets" | "numbers" | "link"

/** Replace `text[from, to)` with `insert`, then select `[selectionStart, selectionEnd)` of the result. */
export type MarkdownEdit = {
  from: number
  to: number
  insert: string
  selectionStart: number
  selectionEnd: number
}

const WRAPS = {
  bold: { marker: "**", placeholder: "chữ đậm" },
  italic: { marker: "*", placeholder: "chữ nghiêng" },
} as const

const LIST_MARKER = /^([-*+]|\d+\.) /

/** `pattern` says a line already has this format; `replaces` is what applying it removes first. */
const LINE_PREFIXES = {
  heading: { pattern: /^#{1,6} /, replaces: /^#{1,6} /, prefix: () => "## " },
  bullets: { pattern: /^[-*+] /, replaces: LIST_MARKER, prefix: () => "- " },
  numbers: { pattern: /^\d+\. /, replaces: LIST_MARKER, prefix: (index: number) => `${index + 1}. ` },
} as const

const LINK_PLACEHOLDER = "chữ hiển thị"
const LINK_URL = "https://"

/** Bold or italic: wraps the selection, or unwraps it when the markers are already around it. */
function wrap(text: string, from: number, to: number, format: keyof typeof WRAPS): MarkdownEdit {
  const { marker, placeholder } = WRAPS[format]
  const m = marker.length
  // Markdown ignores `**word **`, and a double-click on Windows selects the
  // space after a word, so whitespace at either end stays outside the markers.
  // Only spaces selected: keep them and insert the placeholder after them.
  const selected = text.slice(from, to)
  const start = selected.trim() ? from + (selected.length - selected.trimStart().length) : to
  const end = selected.trim() ? to - (selected.length - selected.trimEnd().length) : to
  if (start >= m && text.slice(start - m, start) === marker && text.slice(end, end + m) === marker) {
    const inner = text.slice(start, end)
    return { from: start - m, to: end + m, insert: inner, selectionStart: start - m, selectionEnd: end - m }
  }
  const inner = text.slice(start, end) || placeholder
  return {
    from: start,
    to: end,
    insert: `${marker}${inner}${marker}`,
    selectionStart: start + m,
    selectionEnd: start + m + inner.length,
  }
}

/**
 * Headings and lists act on whole lines; pressing again on formatted lines
 * removes it, and switching list kinds swaps the markers.
 */
function prefixLines(
  text: string,
  start: number,
  end: number,
  format: keyof typeof LINE_PREFIXES
): MarkdownEdit {
  const { pattern, replaces, prefix } = LINE_PREFIXES[format]
  const from = text.lastIndexOf("\n", start - 1) + 1
  const lineEnd = text.indexOf("\n", end > start && text[end - 1] === "\n" ? end - 1 : end)
  const to = lineEnd === -1 ? text.length : lineEnd
  const lines = text.slice(from, to).split("\n")
  const remove = lines.every((line) => pattern.test(line))
  const insert = lines
    .map((line, index) => (remove ? line.replace(pattern, "") : prefix(index) + line.replace(replaces, "")))
    .join("\n")
  // A selection stays on the lines, so pressing again (or another list kind)
  // applies to all of them; a bare caret goes to the end of its line.
  const selectionEnd = from + insert.length
  return { from, to, insert, selectionStart: start === end ? selectionEnd : from, selectionEnd }
}

/** `[chữ](https://)` with the URL part selected, ready for the author to paste the link over it. */
function link(text: string, start: number, end: number): MarkdownEdit {
  const label = text.slice(start, end) || LINK_PLACEHOLDER
  const insert = `[${label}](${LINK_URL})`
  const urlStart = start + label.length + 3
  return { from: start, to: end, insert, selectionStart: urlStart, selectionEnd: urlStart + LINK_URL.length }
}

export function formatMarkdown(
  text: string,
  start: number,
  end: number,
  format: MarkdownFormat
): MarkdownEdit {
  if (format === "bold" || format === "italic") return wrap(text, start, end, format)
  if (format === "link") return link(text, start, end)
  return prefixLines(text, start, end, format)
}
