import type { EditorThemeClasses } from "lexical"

export const blogTheme: EditorThemeClasses = {
  paragraph: "my-3 leading-7",
  heading: {
    h1: "mt-8 mb-3 font-heading text-3xl font-semibold tracking-tight",
    h2: "mt-7 mb-2 font-heading text-2xl font-semibold tracking-tight",
    h3: "mt-6 mb-2 font-heading text-xl font-semibold",
  },
  quote: "my-4 border-l-4 border-primary/40 pl-4 text-muted-foreground italic",
  list: {
    ul: "my-3 list-disc pl-6",
    ol: "my-3 list-decimal pl-6",
    listitem: "my-1 leading-7",
    nested: { listitem: "list-none" },
  },
  link: "text-primary underline underline-offset-4",
  code: "my-4 block overflow-x-auto rounded-xl bg-muted p-4 font-mono text-sm",
  text: {
    bold: "font-semibold",
    italic: "italic",
    strikethrough: "line-through",
    code: "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
  },
  hr: "my-8 border-border",
}
