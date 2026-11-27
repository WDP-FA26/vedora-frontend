export function plainExcerpt(excerpt: string) {
  return (
    excerpt
      .replace(/!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)?/g, "$1")
      .replace(/(^|\s)(#{1,6}|>)\s+/g, "$1")
      .replace(/^([-*+]|\d+[.)])\s+/, "")
      .replace(/`{1,3}|~~/g, "")
      .replace(/(\*{1,3}|_{2,3})(?=\S)|(?<=\S)(\*{1,3}|_{2,3})/g, "")
      .replace(/(^|\s)_(\S)/g, "$1$2")
      .replace(/(\S)_(\s|$)/g, "$1$2")
      .replace(/\s+/g, " ")
      .trim()
  )
}
