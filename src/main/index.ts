/**
 * Electron main process entry for TextEditorMD.
 */

import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, setMainWindowGetter } from './ipc'
import { buildApplicationMenu } from './menu'
import { getPreferences, setPreference } from './store'
import { initAutoUpdater } from './auto-updater'
import { confirmDiscard, getDocumentState } from './file-service'
import { ensureUserTemplateAvailable } from './template-service'
import { IPC } from '../shared/constants/app'

if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const prefs = getPreferences()
  const bounds = prefs.windowBounds

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'TextEditorMD',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const persistBounds = (): void => {
    if (!mainWindow) return
    setPreference('windowBounds', mainWindow.getBounds())
  }
  mainWindow.on('resize', persistBounds)
  mainWindow.on('move', persistBounds)

  mainWindow.on('close', (e) => {
    const state = getDocumentState()
    if (!state.dirty) return
    e.preventDefault()
    void (async () => {
      if (!mainWindow) return
      const prefs = getPreferences()
      // Save all dirty tabs with paths when autosave-on-close is on
      if (prefs.autosaveOnClose) {
        mainWindow.webContents.send(IPC.MENU_ACTION, 'file:autosave-then-quit')
        return
      }
      const choice = await confirmDiscard(
        mainWindow,
        'One or more tabs have unsaved changes.'
      )
      if (choice === 'cancel') return
      if (choice === 'save') {
        mainWindow.webContents.send(IPC.MENU_ACTION, 'file:save-then-quit')
        return
      }
      mainWindow.removeAllListeners('close')
      mainWindow.close()
    })()
  })

  buildApplicationMenu(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  setMainWindowGetter(() => mainWindow)
  registerIpcHandlers()
  void ensureUserTemplateAvailable().catch((err) => {
    console.warn('[template] ensure failed:', err)
  })
  createWindow()
  initAutoUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('http://localhost') ||
      url.startsWith('file://') ||
      Boolean(process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL))
    if (!allowed) event.preventDefault()
  })

  // Right-click cut / copy / paste / select all in the editor (and UI)
  contents.on('context-menu', (_e, params) => {
    const template: Electron.MenuItemConstructorOptions[] = []
    if (params.isEditable || params.editFlags.canPaste) {
      template.push(
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { type: 'separator' },
        { role: 'selectAll', enabled: params.editFlags.canSelectAll }
      )
    } else if (params.selectionText) {
      template.push({ role: 'copy' })
    }
    if (template.length === 0) return
    Menu.buildFromTemplate(template).popup({
      window: BrowserWindow.fromWebContents(contents) ?? undefined
    })
  })
})
