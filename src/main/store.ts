/**
 * Persistent preferences via electron-store.
 */

import Store from 'electron-store'
import {
  DEFAULT_AUTOSAVE_ENABLED,
  DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  DEFAULT_AUTOSAVE_ON_CLOSE,
  DEFAULT_THEME,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  MAX_RECENT_FILES,
  clampAutosaveIntervalMinutes,
  type AppPreferences
} from '../shared/constants/app'
import { SYNTAX_PRESET_DEFAULT } from '../shared/constants/syntax-colors'

export type { AppPreferences }

const defaults: AppPreferences = {
  theme: DEFAULT_THEME,
  lastDirectory: '',
  lastFilePath: '',
  recentFiles: [],
  previewVisible: true,
  previewFollow: true,
  typewriterMode: false,
  syntaxHighlighting: true,
  syntaxColorPreset: 'default',
  syntaxColorsCustom: { ...SYNTAX_PRESET_DEFAULT },
  editorFontSize: FONT_SIZE_DEFAULT,
  autosaveEnabled: DEFAULT_AUTOSAVE_ENABLED,
  autosaveIntervalMinutes: DEFAULT_AUTOSAVE_INTERVAL_MINUTES,
  autosaveOnClose: DEFAULT_AUTOSAVE_ON_CLOSE,
  windowBounds: { width: 1400, height: 900 }
}

export const prefsStore = new Store<AppPreferences>({
  name: 'preferences',
  defaults
})

function clampFontSize(n: number): number {
  if (!Number.isFinite(n)) return FONT_SIZE_DEFAULT
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)))
}

function normaliseRecent(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const item of list) {
    if (typeof item === 'string' && item.trim() && !out.includes(item)) {
      out.push(item)
    }
  }
  return out.slice(0, MAX_RECENT_FILES)
}

export function getPreferences(): AppPreferences {
  const lastFilePath = prefsStore.get('lastFilePath', defaults.lastFilePath)
  let recentFiles = normaliseRecent(
    prefsStore.get('recentFiles', defaults.recentFiles)
  )
  // Seed recent list from lastFilePath for upgrades
  if (lastFilePath && !recentFiles.includes(lastFilePath)) {
    recentFiles = [lastFilePath, ...recentFiles].slice(0, MAX_RECENT_FILES)
  }
  return {
    theme: prefsStore.get('theme', defaults.theme),
    lastDirectory: prefsStore.get('lastDirectory', defaults.lastDirectory),
    lastFilePath,
    recentFiles,
    previewVisible: prefsStore.get('previewVisible', defaults.previewVisible),
    previewFollow: prefsStore.get('previewFollow', defaults.previewFollow),
    typewriterMode: prefsStore.get('typewriterMode', defaults.typewriterMode),
    syntaxHighlighting: prefsStore.get(
      'syntaxHighlighting',
      defaults.syntaxHighlighting
    ),
    syntaxColorPreset: prefsStore.get(
      'syntaxColorPreset',
      defaults.syntaxColorPreset
    ),
    syntaxColorsCustom: {
      ...SYNTAX_PRESET_DEFAULT,
      ...prefsStore.get('syntaxColorsCustom', defaults.syntaxColorsCustom)
    },
    editorFontSize: clampFontSize(
      prefsStore.get('editorFontSize', defaults.editorFontSize)
    ),
    autosaveEnabled: Boolean(
      prefsStore.get('autosaveEnabled', defaults.autosaveEnabled)
    ),
    autosaveIntervalMinutes: clampAutosaveIntervalMinutes(
      prefsStore.get('autosaveIntervalMinutes', defaults.autosaveIntervalMinutes)
    ),
    autosaveOnClose: Boolean(
      prefsStore.get('autosaveOnClose', defaults.autosaveOnClose)
    ),
    windowBounds: prefsStore.get('windowBounds', defaults.windowBounds)
  }
}

export function setPreference<K extends keyof AppPreferences>(
  key: K,
  value: AppPreferences[K]
): AppPreferences {
  if (key === 'editorFontSize') {
    prefsStore.set(key, clampFontSize(value as number) as AppPreferences[K])
  } else if (key === 'autosaveIntervalMinutes') {
    prefsStore.set(
      key,
      clampAutosaveIntervalMinutes(value as number) as AppPreferences[K]
    )
  } else if (key === 'recentFiles') {
    prefsStore.set(key, normaliseRecent(value) as AppPreferences[K])
  } else {
    prefsStore.set(key, value)
  }
  return getPreferences()
}

export function setPreferences(partial: Partial<AppPreferences>): AppPreferences {
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue
    setPreference(k as keyof AppPreferences, v as never)
  }
  return getPreferences()
}

/** Push a path to the front of the recent-files list. */
export function pushRecentFile(filePath: string): AppPreferences {
  const prefs = getPreferences()
  const next = [
    filePath,
    ...prefs.recentFiles.filter((p) => p !== filePath)
  ].slice(0, MAX_RECENT_FILES)
  prefsStore.set('recentFiles', next)
  prefsStore.set('lastFilePath', filePath)
  return getPreferences()
}

export function clearRecentFiles(): AppPreferences {
  prefsStore.set('recentFiles', [])
  return getPreferences()
}
