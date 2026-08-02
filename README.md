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
| **Markdown preview** | Live HTML: CommonMark core + **GFM tables** (pipe tables render as real tables) |
| **Themes** | Light, Dark, and System |
| **Syntax highlighting** | Toggleable; presets (default / high contrast / soft) + custom colours |
| **Settings** | Font size, typewriter mode, preview follow, syntax colours, **autosave** |
| **Autosave** | On by default every **5 minutes** (1 min–1 hr); optional **autosave on close** when a file path exists |
| **Find / replace** | Built-in CodeMirror search panel |
| **Files** | Open/save `.md` / `.markdown` / `.txt`; export standalone **HTML** |
| **Starter template** | Helpful CommonMark sample on first run / New |
| **Installers** | Windows NSIS, macOS DMG, Linux AppImage + deb (via CI) |

## Markdown dialect

Preview and HTML export are **CommonMark**-based, with **GitHub-style pipe tables** enabled so blocks like:

```md
| Feature | Status |
| ------- | ------ |
| Tables  | Yes    |
```

render as formatted tables in the preview (not plain text). Editor highlighting also understands GFM tables.

Spec: [CommonMark](https://commonmark.org/) · tables: [GFM tables](https://github.github.com/gfm/#tables-extension-)

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
| `Ctrl/Cmd+,` | Settings (autosave, etc.) |

## License

MIT — see [LICENSE](./LICENSE).
