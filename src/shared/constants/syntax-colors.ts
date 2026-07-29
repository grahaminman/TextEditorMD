/**
 * Markdown syntax colour presets for the CodeMirror editor.
 * One palette applies in both light and dark themes (theme CSS may still
 * adjust base background / foreground separately).
 */

export type SyntaxColorPresetId = 'default' | 'highContrast' | 'soft' | 'custom'

export interface SyntaxColorPalette {
  heading: string
  emphasis: string
  strong: string
  link: string
  code: string
  quote: string
  list: string
  hr: string
  comment: string
  meta: string
}

export const SYNTAX_PRESET_DEFAULT: SyntaxColorPalette = {
  heading: '#4fc3f7',
  emphasis: '#ce93d8',
  strong: '#ffab91',
  link: '#80cbc4',
  code: '#a5d6a7',
  quote: '#90a4ae',
  list: '#ffcc80',
  hr: '#78909c',
  comment: '#78909c',
  meta: '#b0bec5'
}

export const SYNTAX_PRESET_HIGH_CONTRAST: SyntaxColorPalette = {
  heading: '#00e5ff',
  emphasis: '#e040fb',
  strong: '#ff6e40',
  link: '#1de9b6',
  code: '#76ff03',
  quote: '#b0bec5',
  list: '#ffd740',
  hr: '#eceff1',
  comment: '#90a4ae',
  meta: '#ffffff'
}

export const SYNTAX_PRESET_SOFT: SyntaxColorPalette = {
  heading: '#81d4fa',
  emphasis: '#e1bee7',
  strong: '#ffccbc',
  link: '#b2dfdb',
  code: '#c8e6c9',
  quote: '#b0bec5',
  list: '#ffe0b2',
  hr: '#90a4ae',
  comment: '#90a4ae',
  meta: '#cfd8dc'
}

export const SYNTAX_PRESETS: Record<
  Exclude<SyntaxColorPresetId, 'custom'>,
  SyntaxColorPalette
> = {
  default: SYNTAX_PRESET_DEFAULT,
  highContrast: SYNTAX_PRESET_HIGH_CONTRAST,
  soft: SYNTAX_PRESET_SOFT
}

export function resolvePalette(
  preset: SyntaxColorPresetId,
  custom: SyntaxColorPalette
): SyntaxColorPalette {
  if (preset === 'custom') {
    return { ...SYNTAX_PRESET_DEFAULT, ...custom }
  }
  return { ...SYNTAX_PRESETS[preset] }
}

/** Apply palette as CSS variables on :root for CodeMirror highlight styles. */
export function applySyntaxPalette(palette: SyntaxColorPalette): void {
  const root = document.documentElement
  root.style.setProperty('--syn-heading', palette.heading)
  root.style.setProperty('--syn-emphasis', palette.emphasis)
  root.style.setProperty('--syn-strong', palette.strong)
  root.style.setProperty('--syn-link', palette.link)
  root.style.setProperty('--syn-code', palette.code)
  root.style.setProperty('--syn-quote', palette.quote)
  root.style.setProperty('--syn-list', palette.list)
  root.style.setProperty('--syn-hr', palette.hr)
  root.style.setProperty('--syn-comment', palette.comment)
  root.style.setProperty('--syn-meta', palette.meta)
}
