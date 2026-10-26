"use client"

import { useEffect, type JSX } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection"
import { mergeRegister } from "@lexical/utils"
import {
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical"
import { Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

export type MediaKind = "image" | "video"

/**
 * Videos are written as image Markdown, `![caption](url)`, so any Markdown
 * renderer degrades to a link and the API stores plain text. A URL that points
 * at Cloudinary's video delivery, or at a video file, is a video.
 */
export function isVideoUrl(url: string) {
  return /\/video\/upload\//.test(url) || /\.(mp4|webm|mov)(\?|#|$)/i.test(url)
}

type SerializedMediaNode = Spread<{ src: string; alt: string }, SerializedLexicalNode>

/** An image or video on its own line. */
export class MediaNode extends DecoratorNode<JSX.Element> {
  __src: string
  __alt: string

  static getType() {
    return "blog-media"
  }

  static clone(node: MediaNode) {
    return new MediaNode(node.__src, node.__alt, node.__key)
  }

  static importJSON({ src, alt }: SerializedMediaNode) {
    return $createMediaNode(src, alt)
  }

  constructor(src: string, alt: string, key?: NodeKey) {
    super(key)
    this.__src = src
    this.__alt = alt
  }

  exportJSON(): SerializedMediaNode {
    return { ...super.exportJSON(), src: this.__src, alt: this.__alt }
  }

  createDOM() {
    const div = document.createElement("div")
    div.className = "my-4"
    return div
  }

  updateDOM() {
    return false
  }

  isInline() {
    return false
  }

  getSrc() {
    return this.__src
  }

  getAlt() {
    return this.__alt
  }

  kind(): MediaKind {
    return isVideoUrl(this.__src) ? "video" : "image"
  }

  setAlt(alt: string) {
    this.getWritable().__alt = alt
  }

  getTextContent() {
    return ""
  }

  decorate() {
    return <MediaView nodeKey={this.__key} src={this.__src} alt={this.__alt} kind={this.kind()} />
  }
}

export function $createMediaNode(src: string, alt = "") {
  return new MediaNode(src, alt)
}

export function $isMediaNode(node: LexicalNode | null | undefined): node is MediaNode {
  return node instanceof MediaNode
}

function MediaView({
  nodeKey,
  src,
  alt,
  kind,
}: {
  nodeKey: NodeKey
  src: string
  alt: string
  kind: MediaKind
}) {
  const [editor] = useLexicalComposerContext()
  const [selected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey)

  const label = kind === "video" ? "video" : "ảnh"

  function remove() {
    editor.update(() => $getNodeByKey(nodeKey)?.remove())
  }

  useEffect(
    () =>
      mergeRegister(
        // Backspace/Delete with the media selected removes it.
        ...[KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND].map((command) =>
          editor.registerCommand(
            command,
            (event: KeyboardEvent) => {
              const selection = $getSelection()
              if (!selected || !$isNodeSelection(selection)) return false
              if (event.target instanceof HTMLInputElement) return false
              event.preventDefault()
              $getNodeByKey(nodeKey)?.remove()
              return true
            },
            COMMAND_PRIORITY_LOW
          )
        )
      ),
    [editor, nodeKey, selected]
  )

  return (
    <figure
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-muted/40",
        selected && "ring-2 ring-primary"
      )}
      onClick={(event) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
        clearSelection()
        setSelected(true)
      }}
    >
      {kind === "video" ? (
        <video src={src} controls preload="metadata" className="max-h-[32rem] w-full bg-black" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary public hosts
        <img src={src} alt={alt} referrerPolicy="no-referrer" className="max-h-[32rem] w-full object-contain" />
      )}
      <figcaption className="flex items-center gap-2 border-t border-border bg-card px-3 py-1.5">
        <input
          value={alt}
          onChange={(event) =>
            editor.update(() => {
              const node = $getNodeByKey(nodeKey)
              if ($isMediaNode(node)) node.setAlt(event.target.value)
            })
          }
          maxLength={200}
          placeholder={kind === "video" ? "Chú thích video" : "Mô tả ảnh"}
          aria-label={kind === "video" ? "Chú thích video" : "Mô tả ảnh"}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Xóa ${label}`}
          onClick={remove}
        >
          <Trash2Icon />
        </Button>
      </figcaption>
    </figure>
  )
}
