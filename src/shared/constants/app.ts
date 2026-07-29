/** Shared app constants for TextEditorMD. */

import type {
  SyntaxColorPalette,
  SyntaxColorPresetId
} from './syntax-colors'

export type ThemeMode = 'light' | 'dark' | 'system'

/** Preferences shape shared by main, preload, and renderer. */
export interface AppPreferences {
  theme: ThemeMode
  lastDirectory: string
  lastFilePath: string
  previewVisible: boolean
  previewFollow: boolean
  typewriterMode: boolean
  syntaxHighlighting: boolean
  syntaxColorPreset: SyntaxColorPresetId
  syntaxColorsCustom: SyntaxColorPalette
  editorFontSize: number
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

export const DEFAULT_THEME: ThemeMode = 'system'

export const FONT_SIZE_DEFAULT = 15
export const FONT_SIZE_MIN = 11
export const FONT_SIZE_MAX = 28
export const FONT_SIZE_STEP = 1

export const MD_EXTENSION = '.md'
export const OPEN_FILTERS = [
  {
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt']
  },
  { name: 'All Files', extensions: ['*'] }
]
export const SAVE_MD_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: 'Plain Text', extensions: ['txt'] }
]
export const SAVE_HTML_FILTERS = [{ name: 'HTML', extensions: ['html', 'htm'] }]

/** IPC channel names (main ↔ renderer). */
export const IPC = {
  PREFS_GET: 'prefs:get',
  PREFS_SET: 'prefs:set',
  PREFS_CHANGED: 'prefs:changed',

  FILE_GET_STATE: 'file:get-state',
  FILE_SET_DIRTY: 'file:set-dirty',
  FILE_GET_STARTUP: 'file:get-startup',
  FILE_GET_TEMPLATE: 'file:get-template',
  FILE_NEW: 'file:new',
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_EXPORT_HTML: 'file:export-html',

  DIALOG_CONFIRM_DISCARD: 'dialog:confirm-discard',
  DIALOG_SHOW_ERROR: 'dialog:show-error',

  APP_GET_VERSION: 'app:get-version',
  APP_CHECK_UPDATES: 'app:check-updates',

  MENU_ACTION: 'menu:action',
  MENU_UPDATE_STATE: 'menu:update-state',
  HELP_ABOUT: 'help:about'
} as const
