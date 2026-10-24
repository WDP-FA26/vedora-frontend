/**
 * The API's `excerpt` is the first 280 characters of the Markdown source with
 * whitespace collapsed, so it still holds `##`, `**`, `[text](url)` and the
 * like. This drops that syntax for display; the result is still shown as
 * plain text, never rendered.
 */
export function plainExcerpt(excerpt: string) {
  return (
    excerpt
      // Images and links keep their text: ![alt](url), [text](url). A URL may
      // hold one level of parentheses, and may be cut off by the 280-char limit.
      .replace(/!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)?/g, "$1")
      // Headings and quotes wherever a collapsed line break may have been. A
      // list marker only at the very start: "a - b" mid-text is prose.
      .replace(/(^|\s)(#{1,6}|>)\s+/g, "$1")
      .replace(/^([-*+]|\d+[.)])\s+/, "")
      // Code, and emphasis markers touching a word ("5 * 3" keeps its star).
      .replace(/`{1,3}|~~/g, "")
      .replace(/(\*{1,3}|_{2,3})(?=\S)|(?<=\S)(\*{1,3}|_{2,3})/g, "")
      .replace(/(^|\s)_(\S)/g, "$1$2")
      .replace(/(\S)_(\s|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim()
  )
}
