/**
 * CodeMirror 6 Markdown editor with syntax highlighting, find, and typewriter mode.
 */

import {
  EditorView,
  keymap,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  drawSelection,
  rectangularSelection,
  crosshairCursor
} from '@codemirror/view'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands'
import {
  foldGutter,
  foldKeymap,
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
  defaultHighlightStyle
} from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { GFM } from '@lezer/markdown'
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from '@codemirror/search'
import { autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { tags } from '@lezer/highlight'
import { FONT_SIZE_DEFAULT } from '../../shared/constants/app'

export interface EditorHandle {
  view: EditorView
  getValue: () => string
  setValue: (text: string, asUserEdit?: boolean) => void
  focus: () => void
  setTheme: (dark: boolean) => void
  setFontSize: (px: number) => void
  setTypewriterMode: (on: boolean) => void
  setSyntaxHighlighting: (on: boolean) => void
  openFind: () => void
  openReplace: () => void
  destroy: () => void
}

const themeCompartment = new Compartment()
const fontCompartment = new Compartment()
const typewriterCompartment = new Compartment()
const syntaxCompartment = new Compartment()

/**
 * Selection is drawn on a layer *behind* line backgrounds (drawSelection).
 * Active-line colours must stay translucent or they fully hide the highlight.
 */
const lightTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#fafafa', color: '#1a1a1a' },
    '.cm-content': { caretColor: '#1565c0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1565c0' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#1565c0' },
    /* Layer path used by drawSelection() */
    '.cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(25, 118, 210, 0.35)'
    },
    '&.cm-focused .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground':
      {
        backgroundColor: 'rgba(25, 118, 210, 0.45)'
      },
    /* Keep translucent so selection remains visible underneath */
    '.cm-activeLine': { backgroundColor: 'rgba(21, 101, 192, 0.08)' },
    '.cm-gutters': {
      backgroundColor: '#f0f0f0',
      color: '#78909c',
      border: 'none'
    },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(21, 101, 192, 0.12)' }
  },
  { dark: false }
)

const darkTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#1e1e1e', color: '#e0e0e0' },
    '.cm-content': { caretColor: '#90caf9' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#90caf9' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#90caf9' },
    '.cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'rgba(100, 181, 246, 0.4)'
    },
    '&.cm-focused .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground':
      {
        backgroundColor: 'rgba(100, 181, 246, 0.55)'
      },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.045)' },
    '.cm-gutters': {
      backgroundColor: '#1a1a1a',
      color: '#78909c',
      border: 'none'
    },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255, 255, 255, 0.06)' }
  },
  { dark: true }
)

/** Highlight style bound to CSS variables set by syntax colour presets. */
const mdHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.heading1, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.heading2, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.heading3, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.heading4, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.heading5, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.heading6, color: 'var(--syn-heading)', fontWeight: 'bold' },
  { tag: tags.emphasis, color: 'var(--syn-emphasis)', fontStyle: 'italic' },
  { tag: tags.strong, color: 'var(--syn-strong)', fontWeight: 'bold' },
  { tag: tags.link, color: 'var(--syn-link)' },
  { tag: tags.url, color: 'var(--syn-link)' },
  { tag: tags.monospace, color: 'var(--syn-code)' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.quote, color: 'var(--syn-quote)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--syn-list)' },
  { tag: tags.contentSeparator, color: 'var(--syn-hr)' },
  { tag: tags.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--syn-meta)' },
  { tag: tags.processingInstruction, color: 'var(--syn-meta)' },
  { tag: tags.atom, color: 'var(--syn-meta)' }
])

function fontExt(px: number): Extension {
  return EditorView.theme({
    '.cm-content': {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: `${px}px`,
      lineHeight: '1.55'
    },
    '.cm-gutters': { fontSize: `${Math.max(11, px - 1)}px` }
  })
}

function typewriterExt(on: boolean): Extension {
  if (!on) return []
  return EditorView.theme({
    '.cm-scroller': {
      paddingTop: '40vh',
      paddingBottom: '40vh'
    }
  })
}

function syntaxExt(on: boolean): Extension {
  if (!on) return syntaxHighlighting(defaultHighlightStyle, { fallback: true })
  return syntaxHighlighting(mdHighlightStyle)
}

export interface CreateEditorOptions {
  parent: HTMLElement
  doc?: string
  dark?: boolean
  fontSize?: number
  typewriterMode?: boolean
  syntaxHighlighting?: boolean
  onChange?: (text: string) => void
  onCursor?: (line: number, col: number) => void
  onHistory?: (canUndo: boolean, canRedo: boolean) => void
}

export function createEditor(opts: CreateEditorOptions): EditorHandle {
  const fontSize = opts.fontSize ?? FONT_SIZE_DEFAULT

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      opts.onChange?.(update.state.doc.toString())
    }
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      opts.onCursor?.(line.number, pos - line.from + 1)
    }
    if (update.transactions.some((t) => t.isUserEvent('undo') || t.isUserEvent('redo') || t.docChanged)) {
      // history availability is approximate via history facet; notify parent often
      opts.onHistory?.(true, true)
    }
  })

  const state = EditorState.create({
    doc: opts.doc ?? '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      foldGutter(),
      // Custom selection layer (native ::selection is suppressed by CM)
      drawSelection({ cursorBlinkRate: 1200 }),
      rectangularSelection(),
      crosshairCursor(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      history(),
      // GFM includes pipe tables so table syntax is highlighted in the source
      markdown({ codeLanguages: languages, extensions: GFM }),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...searchKeymap,
        indentWithTab
      ]),
      themeCompartment.of(opts.dark ? darkTheme : lightTheme),
      fontCompartment.of(fontExt(fontSize)),
      typewriterCompartment.of(typewriterExt(Boolean(opts.typewriterMode))),
      syntaxCompartment.of(syntaxExt(opts.syntaxHighlighting !== false)),
      updateListener,
      EditorView.lineWrapping,
      // Prefer CM selection drawing over OS-native selection painting
      EditorView.contentAttributes.of({ spellcheck: 'false' })
    ]
  })

  const view = new EditorView({
    state,
    parent: opts.parent
  })

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (text, asUserEdit = false) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        annotations: asUserEdit ? undefined : undefined
      })
    },
    focus: () => view.focus(),
    setTheme: (dark) => {
      view.dispatch({
        effects: themeCompartment.reconfigure(dark ? darkTheme : lightTheme)
      })
    },
    setFontSize: (px) => {
      view.dispatch({ effects: fontCompartment.reconfigure(fontExt(px)) })
    },
    setTypewriterMode: (on) => {
      view.dispatch({
        effects: typewriterCompartment.reconfigure(typewriterExt(on))
      })
      if (on) {
        const pos = view.state.selection.main.head
        view.dispatch({
          effects: EditorView.scrollIntoView(pos, { y: 'center' })
        })
      }
    },
    setSyntaxHighlighting: (on) => {
      view.dispatch({
        effects: syntaxCompartment.reconfigure(syntaxExt(on))
      })
    },
    openFind: () => openSearchPanel(view),
    openReplace: () => openSearchPanel(view),
    destroy: () => view.destroy()
  }
}
