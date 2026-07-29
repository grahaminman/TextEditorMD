/**
 * Optional auto-update hooks for packaged builds.
 */

import { app, BrowserWindow, dialog } from 'electron'

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  void getMainWindow
  // Packaged update checks are optional; Help → Check for Updates handles UX.
}

export async function checkForUpdates(getMainWindow: () => BrowserWindow | null): Promise<void> {
  const win = getMainWindow()
  if (!win) return
  if (!app.isPackaged) {
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Updates',
      message: 'Update checks apply to packaged releases only.',
      detail: 'Run a distributed build to use GitHub-based auto-update.'
    })
    return
  }
  try {
    const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
    autoUpdater.autoDownload = false
    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Updates',
        message: 'You are up to date.'
      })
    }
  } catch (err) {
    await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Updates',
      message: 'Could not check for updates.',
      detail: String(err)
    })
  }
}
