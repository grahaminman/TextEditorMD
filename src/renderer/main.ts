/**
 * Renderer entry — editor, CommonMark preview, themes, settings.
 */

import './styles/app.css'
import { createEditor, type EditorHandle } from './editor/create-editor'
import { createPreview, type PreviewHandle } from './preview/preview'
import { createSyntaxSettingsPanel, type SyntaxSettingsHandle } from './ui/syntax-settings'
import {
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  type ThemeMode
} from '../shared/constants/app'
import {
  SYNTAX_PRESET_DEFAULT,
  applySyntaxPalette,
  resolvePalette,
  type SyntaxColorPalette,
  type SyntaxColorPresetId
} from '../shared/constants/syntax-colors'
import {
  countCharacters,
  countWords,
  estimateReadingMinutes
} from '../shared/markdown/commonmark'
import { undo, redo } from '@codemirror/commands'

let editor: EditorHandle
let preview: PreviewHandle
let syntaxSettings: SyntaxSettingsHandle

let theme: ThemeMode = 'system'
let filePath: string | null = null
let dirty = false
let previewVisible = true
let previewFollow = true
let typewriterMode = false
let syntaxHighlighting = true
let syntaxColorPreset: SyntaxColorPresetId = 'default'
let syntaxColorsCustom: SyntaxColorPalette = { ...SYNTAX_PRESET_DEFAULT }
let editorFontSize = FONT_SIZE_DEFAULT
let suppressDirty = false
let welcomeDismissed = false

let statsTimer: ReturnType<typeof setTimeout> | null = null
let followTimer: ReturnType<typeof setTimeout> | null = null
let cursorLine = 1

const el = {
  editor: document.getElementById('editor') as HTMLElement,
  previewRoot: document.getElementById('preview') as HTMLElement,
  previewPane: document.getElementById('preview-pane') as HTMLElement,
  workspace: document.getElementById('workspace') as HTMLElement,
  docTitle: document.getElementById('doc-title') as HTMLElement,
  statusWords: document.getElementById('status-words') as HTMLElement,
  statusChars: document.getElementById('status-chars') as HTMLElement,
  statusRead: document.getElementById('status-read') as HTMLElement,
  statusState: document.getElementById('status-state') as HTMLElement,
  statusPath: document.getElementById('status-path') as HTMLElement,
  statusFontLabel: document.getElementById('status-font-label') as HTMLElement,
  statusFontValue: document.getElementById('status-font-value') as HTMLElement,
  fontSizeLabel: document.getElementById('font-size-label') as HTMLElement,
  btnPreview: document.getElementById('btn-toggle-preview') as HTMLButtonElement,
  btnSyntaxColors: document.getElementById('btn-syntax-colors') as HTMLButtonElement,
  btnTheme: document.getElementById('btn-theme') as HTMLButtonElement,
  btnFind: document.getElementById('btn-find') as HTMLButtonElement,
  btnReplace: document.getElementById('btn-replace') as HTMLButtonElement,
  btnFontInc: document.getElementById('btn-font-inc') as HTMLButtonElement,
  btnFontDec: document.getElementById('btn-font-dec') as HTMLButtonElement,
  statusFind: document.getElementById('status-find') as HTMLButtonElement,
  statusReplace: document.getElementById('status-replace') as HTMLButtonElement,
  statusFontInc: document.getElementById('status-font-inc') as HTMLButtonElement,
  statusFontDec: document.getElementById('status-font-dec') as HTMLButtonElement,
  welcome: document.getElementById('welcome-overlay') as HTMLElement,
  welcomeNew: document.getElementById('welcome-new') as HTMLButtonElement,
  welcomeOpen: document.getElementById('welcome-open') as HTMLButtonElement,
  welcomeDismiss: document.getElementById('welcome-dismiss') as HTMLButtonElement,
  resizer: document.getElementById('pane-resizer') as HTMLElement
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode): void {
  theme = mode
  const dark = resolveDark(mode)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  editor?.setTheme(dark)
}

function applyFontSize(px: number, persist = true): void {
  editorFontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(px)))
  editor?.setFontSize(editorFontSize)
  const uiScale = editorFontSize / FONT_SIZE_DEFAULT
  document.documentElement.style.setProperty('--ui-scale', String(uiScale))
  preview?.setZoom(uiScale)
  if (el.fontSizeLabel) el.fontSizeLabel.textContent = String(editorFontSize)
  if (el.statusFontValue) el.statusFontValue.textContent = String(editorFontSize)
  if (persist) void window.api.setPreferences({ editorFontSize })
}

function applySyntax(): void {
  const palette = resolvePalette(syntaxColorPreset, syntaxColorsCustom)
  applySyntaxPalette(palette)
  editor?.setSyntaxHighlighting(syntaxHighlighting)
}

function updateTitle(): void {
  const name = filePath
    ? filePath.split(/[/\\]/).pop() || 'Untitled'
    : 'Untitled'
  el.docTitle.textContent = dirty ? `${name} •` : name
  document.title = dirty ? `${name} • — TextEditorMD` : `${name} — TextEditorMD`
  el.statusPath.textContent = filePath ?? ''
  el.statusState.textContent = dirty ? 'Modified' : 'Ready'
  window.api.updateMenuState({ dirty, hasPath: Boolean(filePath) })
}

function scheduleStats(): void {
  if (statsTimer) clearTimeout(statsTimer)
  statsTimer = setTimeout(() => {
    const text = editor.getValue()
    const words = countWords(text)
    const chars = countCharacters(text)
    const mins = estimateReadingMinutes(text)
    el.statusWords.textContent = `${words} word${words === 1 ? '' : 's'}`
    el.statusChars.textContent = `${chars} char${chars === 1 ? '' : 's'}`
    el.statusRead.textContent = `~${mins} min`
    preview.setSource(text)
  }, 100)
}

function scheduleFollow(): void {
  if (!previewFollow || !previewVisible) return
  if (followTimer) clearTimeout(followTimer)
  followTimer = setTimeout(() => {
    const total = editor.view.state.doc.lines
    preview.scrollToLine(cursorLine, total)
  }, 80)
}

function setDirty(next: boolean): void {
  dirty = next
  void window.api.setDirty(next)
  updateTitle()
}

function loadDocument(content: string, path: string | null, fromTemplate: boolean): void {
  suppressDirty = true
  editor.setValue(content)
  filePath = path
  setDirty(false)
  suppressDirty = false
  scheduleStats()
  if (fromTemplate && !welcomeDismissed) {
    // keep welcome optional; hide after first load of template is fine
  }
  editor.focus()
}

async function handleSaveResult(
  result: Awaited<ReturnType<typeof window.api.saveFile>>
): Promise<boolean> {
  if (result.cancelled) return false
  if (result.error) {
    await window.api.showError(result.error)
    return false
  }
  if (result.path) filePath = result.path
  setDirty(false)
  return true
}

async function doSave(forceAs = false): Promise<boolean> {
  const content = editor.getValue()
  const result = forceAs
    ? await window.api.saveFileAs(content)
    : await window.api.saveFile(content, false)
  return handleSaveResult(result)
}

async function doNew(): Promise<void> {
  let result = await window.api.newFile()
  if (result.needsSave && result.then === 'new') {
    const saved = await doSave()
    if (!saved) return
    result = await window.api.newFile()
  }
  if (result.cancelled) return
  if (result.error) {
    await window.api.showError(result.error)
    return
  }
  loadDocument(result.content ?? '', result.path ?? null, Boolean(result.fromTemplate))
}

async function doOpen(): Promise<void> {
  let result = await window.api.openFile()
  if (result.needsSave && result.then === 'open') {
    const saved = await doSave()
    if (!saved) return
    result = await window.api.openFile()
  }
  if (result.cancelled) return
  if (result.error) {
    await window.api.showError(result.error)
    return
  }
  loadDocument(result.content ?? '', result.path ?? null, false)
}

function cycleTheme(): void {
  const order: ThemeMode[] = ['light', 'dark', 'system']
  const next = order[(order.indexOf(theme) + 1) % order.length]
  applyTheme(next)
  void window.api.setPreferences({ theme: next })
}

function setPreviewVisible(visible: boolean, persist = true): void {
  previewVisible = visible
  el.previewPane.classList.toggle('hidden', !visible)
  el.resizer.classList.toggle('hidden', !visible)
  el.workspace.classList.toggle('preview-hidden', !visible)
  if (persist) void window.api.setPreferences({ previewVisible: visible })
}

function initResizer(): void {
  let dragging = false
  el.resizer.addEventListener('mousedown', (e) => {
    dragging = true
    e.preventDefault()
    document.body.classList.add('resizing')
  })
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const rect = el.workspace.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.min(80, Math.max(25, (x / rect.width) * 100))
    el.workspace.style.gridTemplateColumns = previewVisible
      ? `minmax(0, ${pct}%) 6px minmax(0, ${100 - pct}%)`
      : '1fr'
  })
  window.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    document.body.classList.remove('resizing')
  })
}

function wireUi(): void {
  el.btnFind.addEventListener('click', () => editor.openFind())
  el.btnReplace.addEventListener('click', () => editor.openReplace())
  el.statusFind.addEventListener('click', () => editor.openFind())
  el.statusReplace.addEventListener('click', () => editor.openReplace())
  el.btnFontInc.addEventListener('click', () => applyFontSize(editorFontSize + FONT_SIZE_STEP))
  el.btnFontDec.addEventListener('click', () => applyFontSize(editorFontSize - FONT_SIZE_STEP))
  el.statusFontInc.addEventListener('click', () => applyFontSize(editorFontSize + FONT_SIZE_STEP))
  el.statusFontDec.addEventListener('click', () => applyFontSize(editorFontSize - FONT_SIZE_STEP))
  el.btnPreview.addEventListener('click', () => setPreviewVisible(!previewVisible))
  el.btnTheme.addEventListener('click', () => cycleTheme())
  el.btnSyntaxColors.addEventListener('click', () => syntaxSettings.open())
  el.welcomeNew.addEventListener('click', () => {
    welcomeDismissed = true
    el.welcome.classList.add('hidden')
    void doNew()
  })
  el.welcomeOpen.addEventListener('click', () => {
    welcomeDismissed = true
    el.welcome.classList.add('hidden')
    void doOpen()
  })
  el.welcomeDismiss.addEventListener('click', () => {
    welcomeDismissed = true
    el.welcome.classList.add('hidden')
  })

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (theme === 'system') applyTheme('system')
    })
}

function wireMenus(): void {
  window.api.onMenuAction((action) => {
    void (async () => {
      switch (action) {
        case 'file:new':
          await doNew()
          break
        case 'file:open':
          await doOpen()
          break
        case 'file:save':
          await doSave(false)
          break
        case 'file:save-as':
          await doSave(true)
          break
        case 'file:save-then-quit': {
          const ok = await doSave(false)
          if (ok) window.close()
          break
        }
        case 'file:export-html': {
          const r = await window.api.exportHtml(editor.getValue())
          if (r.error) await window.api.showError(r.error)
          break
        }
        case 'edit:undo':
          undo(editor.view)
          break
        case 'edit:redo':
          redo(editor.view)
          break
        case 'edit:find':
          editor.openFind()
          break
        case 'edit:replace':
          editor.openReplace()
          break
        case 'view:preview':
          setPreviewVisible(!previewVisible)
          break
        case 'view:preview-follow':
          previewFollow = !previewFollow
          void window.api.setPreferences({ previewFollow })
          break
        case 'view:typewriter':
          typewriterMode = !typewriterMode
          editor.setTypewriterMode(typewriterMode)
          void window.api.setPreferences({ typewriterMode })
          break
        case 'view:syntax':
          syntaxHighlighting = !syntaxHighlighting
          applySyntax()
          void window.api.setPreferences({ syntaxHighlighting })
          break
        case 'view:syntax-colors':
          syntaxSettings.open()
          break
        case 'view:font-inc':
          applyFontSize(editorFontSize + FONT_SIZE_STEP)
          break
        case 'view:font-dec':
          applyFontSize(editorFontSize - FONT_SIZE_STEP)
          break
        case 'theme:light':
        case 'theme:dark':
        case 'theme:system':
          applyTheme(action.replace('theme:', '') as ThemeMode)
          break
        case 'help:about':
          await window.api.showAbout()
          break
        case 'help:check-updates':
          await window.api.checkUpdates()
          break
        default:
          break
      }
    })()
  })
}

async function bootstrap(): Promise<void> {
  const prefs = await window.api.getPreferences()
  theme = prefs.theme
  previewVisible = prefs.previewVisible
  previewFollow = prefs.previewFollow
  typewriterMode = prefs.typewriterMode
  syntaxHighlighting = prefs.syntaxHighlighting
  syntaxColorPreset = prefs.syntaxColorPreset
  syntaxColorsCustom = { ...SYNTAX_PRESET_DEFAULT, ...prefs.syntaxColorsCustom }
  editorFontSize = prefs.editorFontSize

  preview = createPreview(el.previewRoot)
  editor = createEditor({
    parent: el.editor,
    dark: resolveDark(theme),
    fontSize: editorFontSize,
    typewriterMode,
    syntaxHighlighting,
    onChange: () => {
      if (!suppressDirty) setDirty(true)
      scheduleStats()
    },
    onCursor: (line) => {
      cursorLine = line
      scheduleFollow()
    }
  })

  syntaxSettings = createSyntaxSettingsPanel(document.body, {
    getPreset: () => syntaxColorPreset,
    getCustom: () => syntaxColorsCustom,
    onChange: (preset, custom) => {
      syntaxColorPreset = preset
      syntaxColorsCustom = custom
      applySyntax()
      void window.api.setPreferences({
        syntaxColorPreset: preset,
        syntaxColorsCustom: custom
      })
    }
  })

  applyTheme(theme)
  applyFontSize(editorFontSize, false)
  applySyntax()
  setPreviewVisible(previewVisible, false)
  initResizer()
  wireUi()
  wireMenus()

  window.api.onPreferencesChanged((p) => {
    if (p.theme !== theme) applyTheme(p.theme)
    if (p.editorFontSize !== editorFontSize) applyFontSize(p.editorFontSize, false)
    if (p.previewVisible !== previewVisible) setPreviewVisible(p.previewVisible, false)
    previewFollow = p.previewFollow
    if (p.typewriterMode !== typewriterMode) {
      typewriterMode = p.typewriterMode
      editor.setTypewriterMode(typewriterMode)
    }
    syntaxHighlighting = p.syntaxHighlighting
    syntaxColorPreset = p.syntaxColorPreset
    syntaxColorsCustom = { ...SYNTAX_PRESET_DEFAULT, ...p.syntaxColorsCustom }
    applySyntax()
  })

  const startup = await window.api.getStartupDocument()
  loadDocument(startup.content, startup.path, startup.fromTemplate)
  if (startup.fromTemplate && !startup.path) {
    el.welcome.classList.remove('hidden')
  }
}

void bootstrap()
