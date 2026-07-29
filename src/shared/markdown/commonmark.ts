/**
 * CommonMark rendering via the reference commonmark.js implementation.
 * Spec: https://commonmark.org/
 *
 * Safe-by-default: raw HTML in source is not enabled as trusted content
 * beyond what the CommonMark HtmlRenderer emits for standard constructs.
 */

import { Parser, HtmlRenderer } from 'commonmark'

const parser = new Parser()
const renderer = new HtmlRenderer({ softbreak: '\n' })

/** Parse Markdown source to a CommonMark AST (document node). */
export function parseCommonMark(source: string) {
  return parser.parse(source ?? '')
}

/**
 * Render Markdown source to an HTML fragment string using CommonMark rules.
 */
export function renderCommonMarkHtml(source: string): string {
  const ast = parseCommonMark(source ?? '')
  return renderer.render(ast)
}

/** Count words in Markdown source (plain text approximation from AST). */
export function countWords(source: string): number {
  const text = plainTextFromMarkdown(source)
  const parts = text.trim().split(/\s+/).filter(Boolean)
  return parts.length
}

/** Extract plain text from Markdown (strips markup via AST walk). */
export function plainTextFromMarkdown(source: string): string {
  const ast = parseCommonMark(source ?? '')
  const chunks: string[] = []

  const walker = ast.walker()
  let event
  while ((event = walker.next())) {
    if (!event.entering) continue
    const node = event.node
    if (node.type === 'text' || node.type === 'code' || node.type === 'code_block') {
      if (node.literal) chunks.push(node.literal)
    } else if (node.type === 'softbreak' || node.type === 'linebreak') {
      chunks.push(' ')
    }
  }
  return chunks.join(' ')
}

/** Character count of source (including whitespace). */
export function countCharacters(source: string): number {
  return (source ?? '').length
}

/** Rough reading time in minutes (200 wpm). */
export function estimateReadingMinutes(source: string): number {
  const words = countWords(source)
  return Math.max(1, Math.ceil(words / 200))
}
