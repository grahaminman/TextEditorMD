/**
 * IPC handlers for preferences, files, dialogs, and menu state.
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC } from '../shared/constants/app'
import {
  clearRecent,
  confirmDiscard,
  exportHtml,
  getDocumentState,
  getStartupDocument,
  getTemplateDocument,
  newFile,
  openFile,
  openPath,
  saveFile,
  saveFileAs,
  setDocumentState,
  showError
} from './file-service'
import { getPreferences, setPreferences } from './store'
import { buildApplicationMenu, updateMenuState } from './menu'
import { checkForUpdates } from './auto-updater'

let mainWindowGetter: () => BrowserWindow | null = () => null

export function setMainWindowGetter(fn: () => BrowserWindow | null): void {
  mainWindowGetter = fn
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.PREFS_GET, () => getPreferences())
  ipcMain.handle(IPC.PREFS_SET, (_e, partial) => {
    const prefs = setPreferences(partial ?? {})
    const win = mainWindowGetter()
    if (win) {
      win.webContents.send(IPC.PREFS_CHANGED, prefs)
      buildApplicationMenu(win)
    }
    return prefs
  })

  ipcMain.handle(IPC.FILE_GET_STATE, () => getDocumentState())
  ipcMain.handle(IPC.FILE_SET_DIRTY, (_e, dirty: boolean, filePath?: string | null) =>
    setDocumentState({
      dirty: Boolean(dirty),
      ...(filePath !== undefined ? { filePath } : {})
    })
  )
  ipcMain.handle(IPC.FILE_GET_STARTUP, () => getStartupDocument())
  ipcMain.handle(IPC.FILE_GET_TEMPLATE, () => getTemplateDocument())
  ipcMain.handle(IPC.FILE_NEW, () => newFile())
  ipcMain.handle(IPC.FILE_OPEN, () => openFile())
  ipcMain.handle(IPC.FILE_OPEN_PATH, (_e, filePath: string) => openPath(filePath))
  ipcMain.handle(
    IPC.FILE_SAVE,
    (_e, content: string, forceSaveAs?: boolean, activePath?: string | null) =>
      saveFile(content, Boolean(forceSaveAs), activePath)
  )
  ipcMain.handle(
    IPC.FILE_SAVE_AS,
    (_e, content: string, suggestedPath?: string | null) =>
      saveFileAs(content, suggestedPath)
  )
  ipcMain.handle(
    IPC.FILE_EXPORT_HTML,
    (_e, content: string, activePath?: string | null) =>
      exportHtml(content, activePath)
  )
  ipcMain.handle(IPC.FILE_RECENT_CLEAR, () => {
    clearRecent()
    return getPreferences()
  })

  ipcMain.handle(IPC.DIALOG_CONFIRM_DISCARD, (_e, detail?: string) =>
    confirmDiscard(null, detail)
  )
  ipcMain.handle(IPC.DIALOG_SHOW_ERROR, (_e, message: string) => showError(message))

  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())
  ipcMain.handle(IPC.APP_CHECK_UPDATES, () => checkForUpdates(mainWindowGetter))

  ipcMain.handle(IPC.HELP_ABOUT, async () => {
    const win = mainWindowGetter()
    if (!win) return
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'About TextEditorMD',
      message: `TextEditorMD ${app.getVersion()}`,
      detail:
        'Desktop Markdown editor with CommonMark live preview.\n' +
        'Spec: https://commonmark.org/\n\n' +
        'MIT License'
    })
  })

  ipcMain.on(IPC.MENU_UPDATE_STATE, (_e, state) => {
    updateMenuState(state ?? {})
  })
}
