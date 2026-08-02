/**
 * Preload bridge — safe typed API for the renderer.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type AppPreferences } from '../shared/constants/app'

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

export interface ElectronAPI {
  getPreferences: () => Promise<AppPreferences>
  setPreferences: (partial: Partial<AppPreferences>) => Promise<AppPreferences>
  onPreferencesChanged: (cb: (prefs: AppPreferences) => void) => () => void

  getDocumentState: () => Promise<DocumentState>
  setDirty: (dirty: boolean, filePath?: string | null) => Promise<DocumentState>

  getStartupDocument: () => Promise<StartupDocument>
  getTemplateDocument: () => Promise<StartupDocument>

  newFile: () => Promise<FileResult>
  openFile: () => Promise<FileResult>
  openPath: (filePath: string) => Promise<FileResult>
  saveFile: (
    content: string,
    forceSaveAs?: boolean,
    activePath?: string | null
  ) => Promise<FileResult>
  saveFileAs: (content: string, suggestedPath?: string | null) => Promise<FileResult>
  exportHtml: (content: string, activePath?: string | null) => Promise<FileResult>
  clearRecent: () => Promise<AppPreferences>

  confirmDiscard: (detail?: string) => Promise<'save' | 'discard' | 'cancel'>
  showError: (message: string) => Promise<void>
  showAbout: () => Promise<void>
  getVersion: () => Promise<string>
  checkUpdates: () => Promise<void>

  onMenuAction: (cb: (action: string, payload?: string) => void) => () => void
  updateMenuState: (state: {
    dirty?: boolean
    hasPath?: boolean
    canUndo?: boolean
    canRedo?: boolean
  }) => void
}

const api: ElectronAPI = {
  getPreferences: () => ipcRenderer.invoke(IPC.PREFS_GET),
  setPreferences: (partial) => ipcRenderer.invoke(IPC.PREFS_SET, partial),
  onPreferencesChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, prefs: AppPreferences): void => cb(prefs)
    ipcRenderer.on(IPC.PREFS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.PREFS_CHANGED, listener)
  },

  getDocumentState: () => ipcRenderer.invoke(IPC.FILE_GET_STATE),
  setDirty: (dirty, filePath) =>
    ipcRenderer.invoke(IPC.FILE_SET_DIRTY, dirty, filePath),

  getStartupDocument: () => ipcRenderer.invoke(IPC.FILE_GET_STARTUP),
  getTemplateDocument: () => ipcRenderer.invoke(IPC.FILE_GET_TEMPLATE),

  newFile: () => ipcRenderer.invoke(IPC.FILE_NEW),
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN),
  openPath: (filePath) => ipcRenderer.invoke(IPC.FILE_OPEN_PATH, filePath),
  saveFile: (content, forceSaveAs = false, activePath) =>
    ipcRenderer.invoke(IPC.FILE_SAVE, content, forceSaveAs, activePath),
  saveFileAs: (content, suggestedPath) =>
    ipcRenderer.invoke(IPC.FILE_SAVE_AS, content, suggestedPath),
  exportHtml: (content, activePath) =>
    ipcRenderer.invoke(IPC.FILE_EXPORT_HTML, content, activePath),
  clearRecent: () => ipcRenderer.invoke(IPC.FILE_RECENT_CLEAR),

  confirmDiscard: (detail) => ipcRenderer.invoke(IPC.DIALOG_CONFIRM_DISCARD, detail),
  showError: (message) => ipcRenderer.invoke(IPC.DIALOG_SHOW_ERROR, message),
  showAbout: () => ipcRenderer.invoke(IPC.HELP_ABOUT),
  getVersion: () => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  checkUpdates: () => ipcRenderer.invoke(IPC.APP_CHECK_UPDATES),

  onMenuAction: (cb) => {
    const listener = (_e: IpcRendererEvent, action: string, payload?: string): void =>
      cb(action, payload)
    ipcRenderer.on(IPC.MENU_ACTION, listener)
    return () => ipcRenderer.removeListener(IPC.MENU_ACTION, listener)
  },

  updateMenuState: (state) => {
    ipcRenderer.send(IPC.MENU_UPDATE_STATE, state)
  }
}

contextBridge.exposeInMainWorld('api', api)
