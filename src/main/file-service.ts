/**
 * File open / save / export orchestration.
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
import { getPreferences, setPreference } from './store'
import { pathExists } from './path-exists'
import { getBundledTemplatePath, readStarterTemplate } from './template-service'

export interface DocumentState {
  filePath: string | null
  dirty: boolean
}

export interface FileResult {
  cancelled: boolean
  content?: string
  path?: string | null
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

async function rememberLastFile(filePath: string | null): Promise<void> {
  setPreference('lastFilePath', filePath ?? '')
}

export async function confirmDiscard(
  parent?: BrowserWindow | null
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
    detail: 'Your document has unsaved changes.'
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
  const templatePath = getBundledTemplatePath()
  setDocumentState({ filePath: null, dirty: false })
  return { content, path: null, fromTemplate: true, templatePath }
}

export async function newFile(): Promise<FileResult> {
  if (documentState.dirty) {
    const choice = await confirmDiscard()
    if (choice === 'cancel') return { cancelled: true }
    if (choice === 'save') return { cancelled: false, needsSave: true, then: 'new' }
  }
  const content = await readStarterTemplate()
  setDocumentState({ filePath: null, dirty: false })
  await rememberLastFile(null)
  return { cancelled: false, content, path: null, fromTemplate: true }
}

export async function openFile(): Promise<FileResult> {
  if (documentState.dirty) {
    const choice = await confirmDiscard()
    if (choice === 'cancel') return { cancelled: true }
    if (choice === 'save') return { cancelled: false, needsSave: true, then: 'open' }
  }
  const w = win()
  if (!w) return { cancelled: true }
  const result = await dialog.showOpenDialog(w, {
    title: 'Open Markdown',
    defaultPath: defaultDir() || undefined,
    filters: OPEN_FILTERS,
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return { cancelled: true }
  const filePath = result.filePaths[0]
  try {
    const content = await fs.readFile(filePath, 'utf8')
    setDocumentState({ filePath, dirty: false })
    await rememberDir(filePath)
    await rememberLastFile(filePath)
    return { cancelled: false, content, path: filePath }
  } catch (err) {
    return { cancelled: true, error: String(err) }
  }
}

export async function saveFile(
  content: string,
  forceSaveAs = false
): Promise<FileResult> {
  if (!documentState.filePath || forceSaveAs) {
    return saveFileAs(content)
  }
  try {
    await fs.writeFile(documentState.filePath, content, 'utf8')
    setDocumentState({ dirty: false })
    await rememberDir(documentState.filePath)
    await rememberLastFile(documentState.filePath)
    return { cancelled: false, path: documentState.filePath, content }
  } catch (err) {
    return { cancelled: true, error: String(err) }
  }
}

export async function saveFileAs(content: string): Promise<FileResult> {
  const w = win()
  if (!w) return { cancelled: true }
  const suggested =
    documentState.filePath ||
    path.join(defaultDir() || appDocuments(), `untitled${MD_EXTENSION}`)
  const result = await dialog.showSaveDialog(w, {
    title: 'Save Markdown',
    defaultPath: suggested,
    filters: SAVE_MD_FILTERS
  })
  if (result.canceled || !result.filePath) return { cancelled: true }
  let filePath = result.filePath
  if (!path.extname(filePath)) filePath += MD_EXTENSION
  try {
    await fs.writeFile(filePath, content, 'utf8')
    setDocumentState({ filePath, dirty: false })
    await rememberDir(filePath)
    await rememberLastFile(filePath)
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

export async function exportHtml(content: string): Promise<FileResult> {
  const w = win()
  if (!w) return { cancelled: true }
  const base = documentState.filePath
    ? path.basename(documentState.filePath, path.extname(documentState.filePath))
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
