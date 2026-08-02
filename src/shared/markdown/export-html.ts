/**
 * Wrap a CommonMark HTML fragment in a minimal standalone document.
 */

import { renderCommonMarkHtml } from './commonmark'

export function markdownToStandaloneHtml(
  source: string,
  options?: { title?: string }
): string {
  const body = renderCommonMarkHtml(source)
  const title = escapeHtml(options?.title ?? 'Document')
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 48rem;
      margin: 2rem auto;
      padding: 0 1.25rem;
      color: #1a1a1a;
      background: #fff;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #e8e8e8; background: #121212; }
      a { color: #80cbc4; }
      code, pre { background: #1e1e1e; }
    }
    pre {
      overflow: auto;
      padding: 0.75rem 1rem;
      border-radius: 6px;
      background: #f4f4f5;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
      padding: 0.1em 0.35em;
      border-radius: 4px;
      background: #f4f4f5;
    }
    pre code { padding: 0; background: transparent; }
    blockquote {
      margin-left: 0;
      padding-left: 1rem;
      border-left: 3px solid #90a4ae;
      color: #546e7a;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; display: block; overflow-x: auto; }
    thead { background: #eef6fb; }
    th, td { border: 1px solid #ccc; padding: 0.45rem 0.7rem; text-align: left; vertical-align: top; }
    th { font-weight: 700; }
    tbody tr:nth-child(even) { background: #fafafa; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1.5rem 0; }
    @media (prefers-color-scheme: dark) {
      thead { background: #1e2a33; }
      th, td { border-color: #444; }
      tbody tr:nth-child(even) { background: #1a1a1a; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>
`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
