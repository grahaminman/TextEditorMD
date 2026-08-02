/**
 * Native application menu for TextEditorMD.
 */

import {
  app,
  BrowserWindow,
  Menu,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import * as path from 'path'
import { IPC } from '../shared/constants/app'
import { getPreferences, setPreference } from './store'

let currentState = {
  dirty: false,
  hasPath: false,
  canUndo: false,
  canRedo: false
}

function send(win: BrowserWindow, action: string, payload?: string): void {
  win.webContents.send(IPC.MENU_ACTION, action, payload)
}

export function updateMenuState(partial: Partial<typeof currentState>): void {
  currentState = { ...currentState, ...partial }
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (win) buildApplicationMenu(win)
}

export function buildApplicationMenu(win: BrowserWindow): void {
  const prefs = getPreferences()
  const isMac = process.platform === 'darwin'
  const recent = prefs.recentFiles || []

  const recentSubmenu: MenuItemConstructorOptions[] =
    recent.length === 0
      ? [{ label: '(No recent files)', enabled: false }]
      : [
          ...recent.map((filePath) => ({
            label: path.basename(filePath),
            toolTip: filePath,
            click: () => send(win, 'file:open-recent', filePath)
          })),
          { type: 'separator' as const },
          {
            label: 'Clear Recent',
            click: () => send(win, 'file:clear-recent')
          }
        ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => send(win, 'file:new')
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: () => send(win, 'file:open')
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => send(win, 'file:save')
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => send(win, 'file:save-as')
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => send(win, 'file:close-tab')
        },
        { type: 'separator' },
        {
          label: 'Export HTML…',
          click: () => send(win, 'file:export-html')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          enabled: currentState.canUndo,
          click: () => send(win, 'edit:undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          enabled: currentState.canRedo,
          click: () => send(win, 'edit:redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => send(win, 'edit:find')
        },
        {
          label: 'Replace',
          accelerator: 'CmdOrCtrl+H',
          click: () => send(win, 'edit:replace')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Preview',
          accelerator: 'CmdOrCtrl+P',
          type: 'checkbox',
          checked: prefs.previewVisible,
          click: () => send(win, 'view:preview')
        },
        {
          label: 'Preview Follow Cursor',
          type: 'checkbox',
          checked: prefs.previewFollow,
          click: () => send(win, 'view:preview-follow')
        },
        {
          label: 'Typewriter Mode',
          type: 'checkbox',
          checked: prefs.typewriterMode,
          click: () => send(win, 'view:typewriter')
        },
        {
          label: 'Syntax Highlighting',
          type: 'checkbox',
          checked: prefs.syntaxHighlighting,
          click: () => send(win, 'view:syntax')
        },
        {
          label: 'Syntax Colours…',
          click: () => send(win, 'view:syntax-colors')
        },
        {
          label: 'Settings…',
          accelerator: 'CmdOrCtrl+,',
          click: () => send(win, 'view:settings')
        },
        { type: 'separator' },
        {
          label: 'Increase Font Size',
          accelerator: 'CmdOrCtrl+=',
          click: () => send(win, 'view:font-inc')
        },
        {
          label: 'Decrease Font Size',
          accelerator: 'CmdOrCtrl+-',
          click: () => send(win, 'view:font-dec')
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' }
      ]
    },
    {
      label: 'Theme',
      submenu: [
        {
          label: 'Light',
          type: 'radio',
          checked: prefs.theme === 'light',
          click: () => {
            setPreference('theme', 'light')
            send(win, 'theme:light')
          }
        },
        {
          label: 'Dark',
          type: 'radio',
          checked: prefs.theme === 'dark',
          click: () => {
            setPreference('theme', 'dark')
            send(win, 'theme:dark')
          }
        },
        {
          label: 'System',
          type: 'radio',
          checked: prefs.theme === 'system',
          click: () => {
            setPreference('theme', 'system')
            send(win, 'theme:system')
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'CommonMark Spec',
          click: () => {
            void shell.openExternal('https://commonmark.org/')
          }
        },
        {
          label: 'About TextEditorMD',
          click: () => send(win, 'help:about')
        },
        {
          label: 'Check for Updates…',
          click: () => send(win, 'help:check-updates')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
