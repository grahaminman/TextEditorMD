/**
 * File open / save / export orchestration.
 * Multi-tab: main does not block open/new on dirty state — the renderer owns tabs.
 */

import { app, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  MD_EXTENSION,
  OPEN_FILTERS,
  SAVE_HTML_FILTERS,
  SAVE_MD_FILTERS
} from '../shared/constants/app'
import { markdownToStandaloneHtml } from '../shared/markdown/export-html'
import {
  clearRecentFiles,
  getPreferences,
  pushRecentFile,
  setPreference
} from './store'
import { pathExists } from './path-exists'
import { getBundledTemplatePath, readStarterTemplate } from './template-service'
import { buildApplicationMenu } from './menu'

export interface DocumentState {
  filePath: string | null
  dirty: boolean
}

export interface FileResult {
  cancelled: boolean
  content?: string
  path?: string | null
  paths?: string[]
  contents?: string[]
  needsSave?: boolean
  then?: string
  error?: string
  fromTemplate?: boolean
}

export interface StartupDocument {
  content: string
  path: string | null
  fromTemplate: boolean
  templatePath: string
}

/** Active-tab mirror for window-close / autosave (renderer keeps in sync). */
let documentState: DocumentState = {
  filePath: null,
  dirty: false
}

export function getDocumentState(): DocumentState {
  return { ...documentState }
}

export function setDocumentState(partial: Partial<DocumentState>): DocumentState {
  documentState = { ...documentState, ...partial }
  return getDocumentState()
}

function win(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function defaultDir(): string {
  return getPreferences().lastDirectory || ''
}

async function rememberDir(filePath: string): Promise<void> {
  setPreference('lastDirectory', path.dirname(filePath))
}

async function rememberFile(filePath: string): Promise<void> {
  pushRecentFile(filePath)
  await rememberDir(filePath)
  const w = win()
  if (w) buildApplicationMenu(w)
}

export async function confirmDiscard(
  parent?: BrowserWindow | null,
  detail = 'Your document has unsaved changes.'
): Promise<'save' | 'discard' | 'cancel'> {
  const w = parent ?? win()
  if (!w) return 'cancel'
  const { response } = await dialog.showMessageBox(w, {
    type: 'question',
    buttons: ['Save', 'Discard', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Unsaved changes',
    message: 'Save changes before continuing?',
    detail
  })
  if (response === 0) return 'save'
  if (response === 1) return 'discard'
  return 'cancel'
}

export async function getStartupDocument(): Promise<StartupDocument> {
  const templatePath = getBundledTemplatePath()
  const last = getPreferences().lastFilePath
  if (last && (await pathExists(last))) {
    try {
      const content = await fs.readFile(last, 'utf8')
      setDocumentState({ filePath: last, dirty: false })
      return { content, path: last, fromTemplate: false, templatePath }
    } catch {
      /* fall through */
    }
  }
  const content = await readStarterTemplate()
  setDocumentState({ filePath: null, dirty: false })
  return { content, path: null, fromTemplate: true, templatePath }
}

export async function getTemplateDocument(): Promise<StartupDocument> {
  const content = await readStarterTemplate()
  return {
    content,
    path: null,
    fromTemplate: true,
    templatePath: getBundledTemplatePath()
  }
}

/** New tab content — no dirty gate (tabs handled in renderer). */
export async function newFile(): Promise<FileResult> {
  const content = await readStarterTemplate()
  return { cancelled: false, content, path: null, fromTemplate: true }
}

/** Open one or more files into tabs. */
export async function openFile(): Promise<FileResult> {
  const w = win()
  if (!w) return { cancelled: true }
  const result = await dialog.showOpenDialog(w, {
    title: 'Open Markdown',
    defaultPath: defaultDir() || undefined,
    filters: OPEN_FILTERS,
    properties: ['openFile', 'multiSelections']
  })
  if (result.canceled || !result.filePaths[0]) return { cancelled: true }

  const paths: string[] = []
  const contents: string[] = []
  for (const filePath of result.filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      paths.push(filePath)
      contents.push(content)
      await rememberFile(filePath)
    } catch (err) {
      return { cancelled: true, error: String(err) }
    }
  }
  if (!paths.length) return { cancelled: true }
  setDocumentState({ filePath: paths[paths.length - 1], dirty: false })
  return {
    cancelled: false,
    path: paths[0],
    content: contents[0],
    paths,
    contents
  }
}

export async function openPath(filePath: string): Promise<FileResult> {
  if (!(await pathExists(filePath))) {
    return { cancelled: true, error: `File not found:\n${filePath}` }
  }
  try {
    const content = await fs.readFile(filePath, 'utf8')
    setDocumentState({ filePath, dirty: false })
    await rememberFile(filePath)
    return { cancelled: false, content, path: filePath }
  } catch (err) {
    return { cancelled: true, error: String(err) }
  }
}

export async function saveFile(
  content: string,
  forceSaveAs = false,
  activePath?: string | null
): Promise<FileResult> {
  const target =
    activePath !== undefined ? activePath : documentState.filePath
  if (!target || forceSaveAs) {
    return saveFileAs(content, target)
  }
  try {
    await fs.writeFile(target, content, 'utf8')
    setDocumentState({ filePath: target, dirty: false })
    await rememberFile(target)
    return { cancelled: false, path: target, content }
  } catch (err) {
    return { cancelled: true, error: String(err) }
  }
}

export async function saveFileAs(
  content: string,
  suggestedPath?: string | null
): Promise<FileResult> {
  const w = win()
  if (!w) return { cancelled: true }
  const base =
    suggestedPath ||
    documentState.filePath ||
    path.join(defaultDir() || appDocuments(), `untitled${MD_EXTENSION}`)
  const result = await dialog.showSaveDialog(w, {
    title: 'Save Markdown',
    defaultPath: base,
    filters: SAVE_MD_FILTERS
  })
  if (result.canceled || !result.filePath) return { cancelled: true }
  let filePath = result.filePath
  if (!path.extname(filePath)) filePath += MD_EXTENSION
  try {
    await fs.writeFile(filePath, content, 'utf8')
    setDocumentState({ filePath, dirty: false })
    await rememberFile(filePath)
    return { cancelled: false, path: filePath, content }
  } catch (err) {
    return { cancelled: true, error: String(err) }
  }
}

function appDocuments(): string {
  try {
    return app.getPath('documents')
  } catch {
    return ''
  }
}

export async function exportHtml(
  content: string,
  activePath?: string | null
): Promise<FileResult> {
  const w = win()
  if (!w) return { cancelled: true }
  const src = activePath || documentState.filePath
  const base = src
    ? path.basename(src, path.extname(src))
    : 'document'
  const result = await dialog.showSaveDialog(w, {
    title: 'Export HTML',
    defaultPath: path.join(defaultDir() || appDocuments(), `${base}.html`),
    filters: SAVE_HTML_FILTERS
  })
  if (result.canceled || !result.filePath) return { cancelled: true }
  try {
    const html = markdownToStandaloneHtml(content, { title: base })
    await fs.writeFile(result.filePath, html, 'utf8')
    await rememberDir(result.filePath)
    return { cancelled: false, path: result.filePath }
  } catch (err) {
    return { cancelled: true, error: String(err) }
  }
}

export async function showError(message: string): Promise<void> {
  const w = win()
  if (!w) return
  await dialog.showMessageBox(w, {
    type: 'error',
    title: 'Error',
    message
  })
}

export function clearRecent(): void {
  clearRecentFiles()
  const w = win()
  if (w) buildApplicationMenu(w)
}
