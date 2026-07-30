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
  clampAutosaveIntervalMinutes,
  type AppPreferences
} from '../shared/constants/app'
import { SYNTAX_PRESET_DEFAULT } from '../shared/constants/syntax-colors'

export type { AppPreferences }

const defaults: AppPreferences = {
  theme: DEFAULT_THEME,
  lastDirectory: '',
  lastFilePath: '',
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

export function getPreferences(): AppPreferences {
  return {
    theme: prefsStore.get('theme', defaults.theme),
    lastDirectory: prefsStore.get('lastDirectory', defaults.lastDirectory),
    lastFilePath: prefsStore.get('lastFilePath', defaults.lastFilePath),
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
  } else {
    prefsStore.set(key, value)
  }
  return getPreferences()
}

export function setPreferences(partial: Partial<AppPreferences>): AppPreferences {
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue
    if (k === 'editorFontSize') {
      prefsStore.set('editorFontSize', clampFontSize(v as number))
    } else if (k === 'autosaveIntervalMinutes') {
      prefsStore.set(
        'autosaveIntervalMinutes',
        clampAutosaveIntervalMinutes(v as number)
      )
    } else {
      prefsStore.set(k as keyof AppPreferences, v as never)
    }
  }
  return getPreferences()
}
