/**
 * Live CommonMark HTML preview pane.
 */

import { renderCommonMarkHtml } from '../../shared/markdown/commonmark'

export interface PreviewHandle {
  setSource: (md: string) => void
  setZoom: (scale: number) => void
  scrollToLine: (line: number, totalLines: number) => void
  destroy: () => void
}

export function createPreview(root: HTMLElement): PreviewHandle {
  root.classList.add('md-preview')
  root.innerHTML = `
    <div class="md-preview-scroll">
      <article class="md-preview-body"></article>
    </div>
  `
  const scroll = root.querySelector('.md-preview-scroll') as HTMLElement
  const body = root.querySelector('.md-preview-body') as HTMLElement

  let lastHtml = ''

  return {
    setSource(md: string) {
      const html = renderCommonMarkHtml(md)
      if (html === lastHtml) return
      lastHtml = html
      body.innerHTML = html || '<p class="md-preview-empty">Preview will appear here…</p>'
    },
    setZoom(scale: number) {
      body.style.fontSize = `${Math.round(16 * scale)}px`
    },
    scrollToLine(line: number, totalLines: number) {
      if (totalLines <= 1) {
        scroll.scrollTop = 0
        return
      }
      const ratio = Math.max(0, Math.min(1, (line - 1) / (totalLines - 1)))
      const max = scroll.scrollHeight - scroll.clientHeight
      scroll.scrollTop = max * ratio
    },
    destroy() {
      root.innerHTML = ''
    }
  }
}
