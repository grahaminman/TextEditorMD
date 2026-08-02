/**
 * Markdown → HTML for preview/export.
 *
 * Core syntax follows CommonMark. Tables (and a few other conveniences)
 * use GitHub-Flavoured Markdown rules via markdown-it, so pasted pipe
 * tables render as real HTML tables in the preview.
 *
 * Spec references:
 * - https://commonmark.org/
 * - https://github.github.com/gfm/#tables-extension-
 */

import MarkdownIt from 'markdown-it'
import { Parser } from 'commonmark'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false
  // default preset includes tables + strikethrough
})

const plainParser = new Parser()

/**
 * Render Markdown source to an HTML fragment.
 * CommonMark body + GFM tables (pipe tables).
 */
export function renderCommonMarkHtml(source: string): string {
  try {
    return md.render(source ?? '')
  } catch {
    return `<pre>${escapeHtml(source ?? '')}</pre>`
  }
}

/** Alias used by callers that want explicit GFM naming. */
export const renderMarkdownHtml = renderCommonMarkHtml

/** Parse with commonmark.js AST (for plain-text / word stats). */
export function parseCommonMark(source: string) {
  return plainParser.parse(source ?? '')
}

/** Count words in Markdown source (plain text approximation from AST). */
export function countWords(source: string): number {
  const text = plainTextFromMarkdown(source)
  const parts = text.trim().split(/\s+/).filter(Boolean)
  return parts.length
}

/** Extract plain text from Markdown (strips markup via AST walk). */
export function plainTextFromMarkdown(source: string): string {
  // Prefer stripping simple table pipes so cell text still counts
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
