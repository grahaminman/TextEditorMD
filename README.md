# TextEditorMD

> **⚠️ BETA SOFTWARE** — early preview for testing. Not a finished product.  
> Features may change or break.

Desktop **Markdown** editor with a live **[CommonMark](https://commonmark.org/)** preview.

Built with **Electron**, **TypeScript**, **CodeMirror 6**, and the reference **commonmark.js** renderer.

![Status](https://img.shields.io/badge/status-1.0.0-blue)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)

**Repository:** https://github.com/grahaminman/TextEditorMD

## Features

| Feature | Description |
|--------|-------------|
| **Markdown editor** | CodeMirror 6 with Markdown language support and fenced-code languages |
| **CommonMark preview** | Live HTML preview via [commonmark.js](https://github.com/commonmark/commonmark.js) (CommonMark spec) |
| **Themes** | Light, Dark, and System |
| **Syntax highlighting** | Toggleable; presets (default / high contrast / soft) + custom colours |
| **Settings** | Font size, typewriter mode, preview follow cursor, syntax colours |
| **Find / replace** | Built-in CodeMirror search panel |
| **Files** | Open/save `.md` / `.markdown` / `.txt`; export standalone **HTML** |
| **Starter template** | Helpful CommonMark sample on first run / New |
| **Installers** | Windows NSIS, macOS DMG, Linux AppImage + deb (via CI) |

## CommonMark

Preview and HTML export use the **reference CommonMark implementation** so rendering matches the [CommonMark specification](https://commonmark.org/). This is standard Markdown — not a screenplay format, and not GitHub-Flavored Markdown extensions unless they also appear in CommonMark.

## Quick start

```bash
git clone https://github.com/grahaminman/TextEditorMD.git
cd TextEditorMD
npm install
npm run dev
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Compile main / preload / renderer |
| `npm test` | Vitest unit tests |
| `npm run typecheck` | TypeScript checks |
| `npm run dist` | Installers for the host platform |
| `npm run dist:linux` / `dist:win` / `dist:mac` | Platform packages |

## Project layout

```
TextEditorMD/
├── src/
│   ├── main/          # Electron main process
│   ├── preload/       # contextBridge API
│   ├── renderer/      # Editor + preview UI
│   └── shared/        # CommonMark helpers, constants
├── resources/templates/
├── tests/
└── .github/workflows/build.yml
```

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+N` | New |
| `Ctrl/Cmd+O` | Open |
| `Ctrl/Cmd+S` | Save |
| `Ctrl/Cmd+Shift+S` | Save As |
| `Ctrl/Cmd+F` | Find |
| `Ctrl/Cmd+P` | Toggle preview |
| `Ctrl/Cmd+=` / `-` | Font size |

## License

MIT — see [LICENSE](./LICENSE).
