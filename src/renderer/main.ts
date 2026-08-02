/**
 * Renderer entry — multi-tab editor, CommonMark preview, themes, settings.
 */

import './styles/app.css'
import { createEditor, type EditorHandle } from './editor/create-editor'
import { createPreview, type PreviewHandle } from './preview/preview'
import { createSyntaxSettingsPanel, type SyntaxSettingsHandle } from './ui/syntax-settings'
import {
  createAppSettingsPanel,
  type AppSettingsHandle
} from './ui/app-settings'
import {
  DEFAULT_AUTOSAVE_ENABLED,
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  DEFAULT_AUTOSAVE_ON_CLOSE,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  clampAutosaveIntervalMinutes,
  type AutosaveIntervalMinutes,
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

interface TabDoc {
  id: string
  filePath: string | null
  content: string
  dirty: boolean
  fromTemplate: boolean
}

let editor: EditorHandle
let preview: PreviewHandle
let syntaxSettings: SyntaxSettingsHandle
let appSettings: AppSettingsHandle

let theme: ThemeMode = 'system'
let previewVisible = true
let previewFollow = true
let typewriterMode = false
let syntaxHighlighting = true
let syntaxColorPreset: SyntaxColorPresetId = 'default'
let syntaxColorsCustom: SyntaxColorPalette = { ...SYNTAX_PRESET_DEFAULT }
let editorFontSize = FONT_SIZE_DEFAULT
let autosaveEnabled = DEFAULT_AUTOSAVE_ENABLED
let autosaveIntervalMinutes: AutosaveIntervalMinutes =
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES
let autosaveOnClose = DEFAULT_AUTOSAVE_ON_CLOSE
let suppressDirty = false
let welcomeDismissed = false
let saving = false

let tabs: TabDoc[] = []
let activeTabId = ''

let statsTimer: ReturnType<typeof setTimeout> | null = null
let followTimer: ReturnType<typeof setTimeout> | null = null
let autosaveTimer: ReturnType<typeof setInterval> | null = null
let statusFlashTimer: ReturnType<typeof setTimeout> | null = null
let cursorLine = 1

const el = {
  editor: document.getElementById('editor') as HTMLElement,
  previewRoot: document.getElementById('preview') as HTMLElement,
  previewPane: document.getElementById('preview-pane') as HTMLElement,
  workspace: document.getElementById('workspace') as HTMLElement,
  tabBar: document.getElementById('tab-bar') as HTMLElement,
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
  btnSettings: document.getElementById('btn-settings') as HTMLButtonElement,
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

function newTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function activeTab(): TabDoc | undefined {
  return tabs.find((t) => t.id === activeTabId)
}

function anyDirty(): boolean {
  return tabs.some((t) => t.dirty)
}

function fileName(path: string | null): string {
  if (!path) return 'Untitled'
  return path.split(/[/\\]/).pop() || 'Untitled'
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

function syncMainDocState(): void {
  const tab = activeTab()
  const dirty = anyDirty()
  void window.api.setDirty(dirty, tab?.filePath ?? null)
  window.api.updateMenuState({
    dirty,
    hasPath: Boolean(tab?.filePath)
  })
}

function updateTitle(): void {
  const tab = activeTab()
  const name = fileName(tab?.filePath ?? null)
  const dirtyMark = tab?.dirty ? ' •' : ''
  el.docTitle.textContent = `${name}${dirtyMark}`
  document.title = `${name}${dirtyMark} — TextEditorMD`
  el.statusPath.textContent = tab?.filePath ?? ''
  if (!el.statusState.classList.contains('autosaved')) {
    el.statusState.textContent = anyDirty() ? 'Modified' : 'Ready'
  }
  syncMainDocState()
  renderTabs()
}

function renderTabs(): void {
  const bar = el.tabBar
  bar.innerHTML = ''
  for (const tab of tabs) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tab' + (tab.id === activeTabId ? ' active' : '')
    btn.setAttribute('role', 'tab')
    btn.title = tab.filePath || 'Untitled'
    const label = document.createElement('span')
    label.className = 'tab-label'
    label.textContent = fileName(tab.filePath) + (tab.dirty ? ' •' : '')
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'tab-close'
    close.setAttribute('aria-label', 'Close tab')
    close.textContent = '×'
    close.addEventListener('click', (e) => {
      e.stopPropagation()
      void closeTab(tab.id)
    })
    btn.appendChild(label)
    btn.appendChild(close)
    btn.addEventListener('click', () => switchTab(tab.id))
    bar.appendChild(btn)
  }
  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'tab-add'
  add.title = 'New tab'
  add.textContent = '+'
  add.addEventListener('click', () => void doNew())
  bar.appendChild(add)
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

function persistActiveToTab(): void {
  const tab = activeTab()
  if (!tab || !editor) return
  tab.content = editor.getValue()
}

function loadTabIntoEditor(tab: TabDoc): void {
  suppressDirty = true
  editor.setValue(tab.content)
  suppressDirty = false
  scheduleStats()
  updateTitle()
  editor.focus()
}

function switchTab(id: string): void {
  if (id === activeTabId) return
  persistActiveToTab()
  activeTabId = id
  const tab = activeTab()
  if (tab) loadTabIntoEditor(tab)
}

function openTab(content: string, path: string | null, fromTemplate = false): void {
  if (path) {
    const existing = tabs.find((t) => t.filePath === path)
    if (existing) {
      switchTab(existing.id)
      return
    }
  }
  persistActiveToTab()
  const tab: TabDoc = {
    id: newTabId(),
    filePath: path,
    content,
    dirty: false,
    fromTemplate
  }
  tabs.push(tab)
  activeTabId = tab.id
  loadTabIntoEditor(tab)
}

async function setActiveDirty(next: boolean): Promise<void> {
  const tab = activeTab()
  if (!tab) return
  tab.dirty = next
  updateTitle()
}

async function closeTab(id: string): Promise<void> {
  const idx = tabs.findIndex((t) => t.id === id)
  if (idx < 0) return
  const tab = tabs[idx]
  if (tab.id === activeTabId) persistActiveToTab()

  if (tab.dirty) {
    const choice = await window.api.confirmDiscard(
      `"${fileName(tab.filePath)}" has unsaved changes.`
    )
    if (choice === 'cancel') return
    if (choice === 'save') {
      if (tab.id !== activeTabId) switchTab(tab.id)
      const ok = await doSave(false)
      if (!ok) return
    }
  }

  tabs.splice(idx, 1)
  if (tabs.length === 0) {
    const result = await window.api.newFile()
    openTab(result.content ?? '', null, true)
    return
  }
  if (activeTabId === id) {
    const next = tabs[Math.max(0, idx - 1)]
    activeTabId = next.id
    loadTabIntoEditor(next)
  } else {
    updateTitle()
  }
}

async function handleSaveResult(
  result: Awaited<ReturnType<typeof window.api.saveFile>>,
  tab: TabDoc
): Promise<boolean> {
  if (result.cancelled) return false
  if (result.error) {
    await window.api.showError(result.error)
    return false
  }
  if (result.path) tab.filePath = result.path
  tab.dirty = false
  tab.content = result.content ?? tab.content
  updateTitle()
  return true
}

async function doSave(forceAs = false): Promise<boolean> {
  if (saving) return false
  const tab = activeTab()
  if (!tab) return false
  saving = true
  try {
    persistActiveToTab()
    const content = tab.content
    const result = forceAs
      ? await window.api.saveFileAs(content, tab.filePath)
      : await window.api.saveFile(content, false, tab.filePath)
    const ok = await handleSaveResult(result, tab)
    if (ok && editor) {
      // keep editor content in sync if path changed only
      suppressDirty = true
      if (editor.getValue() !== tab.content) editor.setValue(tab.content)
      suppressDirty = false
    }
    return ok
  } finally {
    saving = false
  }
}

async function saveTab(tab: TabDoc): Promise<boolean> {
  if (!tab.dirty) return true
  if (!tab.filePath) {
    // need active for Save As UX
    if (tab.id !== activeTabId) switchTab(tab.id)
    return doSave(true)
  }
  const result = await window.api.saveFile(tab.content, false, tab.filePath)
  return handleSaveResult(result, tab)
}

async function tryAutosave(reason: 'interval' | 'close'): Promise<boolean> {
  if (saving) return false
  persistActiveToTab()
  let allOk = true
  for (const tab of tabs) {
    if (!tab.dirty || !tab.filePath) {
      if (tab.dirty && !tab.filePath) allOk = false
      continue
    }
    const result = await window.api.saveFile(tab.content, false, tab.filePath)
    const ok = await handleSaveResult(result, tab)
    if (!ok) allOk = false
  }
  if (allOk && reason === 'interval' && tabs.some((t) => t.filePath)) {
    flashStatus('Autosaved')
  }
  // true if nothing dirty left, or only untitled dirty remains for close prompt
  return !anyDirty() || (reason === 'close' && tabs.every((t) => !t.dirty || !t.filePath))
}

function flashStatus(message: string): void {
  el.statusState.textContent = message
  el.statusState.classList.add('autosaved')
  if (statusFlashTimer) clearTimeout(statusFlashTimer)
  statusFlashTimer = setTimeout(() => {
    el.statusState.classList.remove('autosaved')
    updateTitle()
  }, 2500)
}

function restartAutosaveTimer(): void {
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
  if (!autosaveEnabled) return
  const ms = autosaveIntervalMinutes * 60 * 1000
  autosaveTimer = setInterval(() => {
    void tryAutosave('interval')
  }, ms)
}

function applyAutosavePrefs(partial: {
  autosaveEnabled?: boolean
  autosaveIntervalMinutes?: number
  autosaveOnClose?: boolean
}): void {
  if (partial.autosaveEnabled !== undefined) {
    autosaveEnabled = Boolean(partial.autosaveEnabled)
  }
  if (partial.autosaveIntervalMinutes !== undefined) {
    autosaveIntervalMinutes = clampAutosaveIntervalMinutes(
      partial.autosaveIntervalMinutes
    )
  }
  if (partial.autosaveOnClose !== undefined) {
    autosaveOnClose = Boolean(partial.autosaveOnClose)
  }
  appSettings?.sync({
    autosaveEnabled,
    autosaveIntervalMinutes,
    autosaveOnClose
  })
  restartAutosaveTimer()
}

async function doNew(): Promise<void> {
  const result = await window.api.newFile()
  if (result.cancelled) return
  if (result.error) {
    await window.api.showError(result.error)
    return
  }
  openTab(result.content ?? '', null, Boolean(result.fromTemplate))
  el.welcome.classList.add('hidden')
}

async function doOpen(): Promise<void> {
  const result = await window.api.openFile()
  if (result.cancelled) return
  if (result.error) {
    await window.api.showError(result.error)
    return
  }
  const paths = result.paths ?? (result.path ? [result.path] : [])
  const contents = result.contents ?? (result.content != null ? [result.content] : [])
  for (let i = 0; i < paths.length; i++) {
    openTab(contents[i] ?? '', paths[i], false)
  }
  el.welcome.classList.add('hidden')
}

async function doOpenRecent(filePath: string): Promise<void> {
  const existing = tabs.find((t) => t.filePath === filePath)
  if (existing) {
    switchTab(existing.id)
    return
  }
  const result = await window.api.openPath(filePath)
  if (result.cancelled) {
    if (result.error) await window.api.showError(result.error)
    return
  }
  openTab(result.content ?? '', result.path ?? filePath, false)
  el.welcome.classList.add('hidden')
}

async function saveAllDirtyThenQuit(preferAutosave: boolean): Promise<void> {
  persistActiveToTab()
  if (preferAutosave) {
    await tryAutosave('close')
  }
  for (const tab of [...tabs]) {
    if (!tab.dirty) continue
    if (tab.id !== activeTabId) switchTab(tab.id)
    if (tab.filePath && preferAutosave) {
      await saveTab(tab)
      continue
    }
    const choice = await window.api.confirmDiscard(
      `"${fileName(tab.filePath)}" has unsaved changes.`
    )
    if (choice === 'cancel') return
    if (choice === 'save') {
      const ok = await doSave(!tab.filePath)
      if (!ok) return
    } else {
      tab.dirty = false
    }
  }
  if (!anyDirty()) window.close()
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
  el.btnSettings?.addEventListener('click', () => appSettings.open())
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
  window.api.onMenuAction((action, payload) => {
    void (async () => {
      switch (action) {
        case 'file:new':
          await doNew()
          break
        case 'file:open':
          await doOpen()
          break
        case 'file:open-recent':
          if (payload) await doOpenRecent(payload)
          break
        case 'file:clear-recent':
          await window.api.clearRecent()
          break
        case 'file:save':
          await doSave(false)
          break
        case 'file:save-as':
          await doSave(true)
          break
        case 'file:close-tab':
          await closeTab(activeTabId)
          break
        case 'file:save-then-quit':
          await saveAllDirtyThenQuit(false)
          break
        case 'file:autosave-then-quit':
          await saveAllDirtyThenQuit(true)
          break
        case 'file:export-html': {
          const tab = activeTab()
          const r = await window.api.exportHtml(
            editor.getValue(),
            tab?.filePath ?? null
          )
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
        case 'view:settings':
          appSettings.open()
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
  autosaveEnabled = prefs.autosaveEnabled ?? DEFAULT_AUTOSAVE_ENABLED
  autosaveIntervalMinutes = clampAutosaveIntervalMinutes(
    prefs.autosaveIntervalMinutes ?? DEFAULT_AUTOSAVE_INTERVAL_MINUTES
  )
  autosaveOnClose = prefs.autosaveOnClose ?? DEFAULT_AUTOSAVE_ON_CLOSE

  preview = createPreview(el.previewRoot)
  editor = createEditor({
    parent: el.editor,
    dark: resolveDark(theme),
    fontSize: editorFontSize,
    typewriterMode,
    syntaxHighlighting,
    onChange: () => {
      if (!suppressDirty) {
        const tab = activeTab()
        if (tab) {
          tab.dirty = true
          tab.content = editor.getValue()
          updateTitle()
        }
      }
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

  appSettings = createAppSettingsPanel(document.body, {
    getState: () => ({
      autosaveEnabled,
      autosaveIntervalMinutes,
      autosaveOnClose
    }),
    onChange: (state) => {
      applyAutosavePrefs(state)
      void window.api.setPreferences({
        autosaveEnabled: state.autosaveEnabled,
        autosaveIntervalMinutes: state.autosaveIntervalMinutes,
        autosaveOnClose: state.autosaveOnClose
      })
    }
  })

  applyTheme(theme)
  applyFontSize(editorFontSize, false)
  applySyntax()
  setPreviewVisible(previewVisible, false)
  restartAutosaveTimer()
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
    applyAutosavePrefs({
      autosaveEnabled: p.autosaveEnabled,
      autosaveIntervalMinutes: p.autosaveIntervalMinutes,
      autosaveOnClose: p.autosaveOnClose
    })
  })

  const startup = await window.api.getStartupDocument()
  openTab(startup.content, startup.path, startup.fromTemplate)
  if (startup.fromTemplate && !startup.path) {
    el.welcome.classList.remove('hidden')
  }
}

void bootstrap()
