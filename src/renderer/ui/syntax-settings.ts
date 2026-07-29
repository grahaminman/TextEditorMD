/**
 * Syntax colour settings panel (presets + custom pickers).
 */

import {
  SYNTAX_PRESETS,
  resolvePalette,
  applySyntaxPalette,
  type SyntaxColorPalette,
  type SyntaxColorPresetId
} from '../../shared/constants/syntax-colors'

export interface SyntaxSettingsHandle {
  open: () => void
  close: () => void
  isOpen: () => boolean
  destroy: () => void
}

const LABELS: { key: keyof SyntaxColorPalette; label: string }[] = [
  { key: 'heading', label: 'Headings' },
  { key: 'emphasis', label: 'Emphasis' },
  { key: 'strong', label: 'Strong' },
  { key: 'link', label: 'Links' },
  { key: 'code', label: 'Code' },
  { key: 'quote', label: 'Block quotes' },
  { key: 'list', label: 'Lists' },
  { key: 'hr', label: 'Horizontal rules' },
  { key: 'comment', label: 'Comments / HTML' },
  { key: 'meta', label: 'Meta / markers' }
]

export interface SyntaxSettingsOptions {
  getPreset: () => SyntaxColorPresetId
  getCustom: () => SyntaxColorPalette
  onChange: (preset: SyntaxColorPresetId, custom: SyntaxColorPalette) => void
}

export function createSyntaxSettingsPanel(
  parent: HTMLElement,
  opts: SyntaxSettingsOptions
): SyntaxSettingsHandle {
  const backdrop = document.createElement('div')
  backdrop.className = 'settings-backdrop hidden'
  backdrop.innerHTML = `
    <div class="settings-panel" role="dialog" aria-label="Syntax colours">
      <header class="settings-header">
        <h2>Syntax colours</h2>
        <button type="button" class="settings-close" aria-label="Close">×</button>
      </header>
      <div class="settings-body">
        <label class="settings-row">
          <span>Preset</span>
          <select class="settings-preset">
            <option value="default">Default</option>
            <option value="highContrast">High contrast</option>
            <option value="soft">Soft</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <div class="settings-colors"></div>
        <p class="settings-hint">Colours apply to the editor. Preview uses standard HTML styling.</p>
      </div>
    </div>
  `
  parent.appendChild(backdrop)

  const presetSelect = backdrop.querySelector('.settings-preset') as HTMLSelectElement
  const colorsEl = backdrop.querySelector('.settings-colors') as HTMLElement
  const closeBtn = backdrop.querySelector('.settings-close') as HTMLButtonElement

  function renderPickers(): void {
    const preset = opts.getPreset()
    const custom = opts.getCustom()
    const palette = resolvePalette(preset, custom)
    presetSelect.value = preset
    colorsEl.innerHTML = ''
    for (const { key, label } of LABELS) {
      const row = document.createElement('label')
      row.className = 'settings-row'
      row.innerHTML = `<span>${label}</span>`
      const input = document.createElement('input')
      input.type = 'color'
      input.value = toHex(palette[key])
      input.disabled = preset !== 'custom'
      input.addEventListener('input', () => {
        const next = { ...opts.getCustom(), [key]: input.value }
        opts.onChange('custom', next)
        applySyntaxPalette(resolvePalette('custom', next))
      })
      row.appendChild(input)
      colorsEl.appendChild(row)
    }
  }

  presetSelect.addEventListener('change', () => {
    const preset = presetSelect.value as SyntaxColorPresetId
    let custom = opts.getCustom()
    if (preset !== 'custom' && SYNTAX_PRESETS[preset as keyof typeof SYNTAX_PRESETS]) {
      // keep custom store, just switch preset
    } else if (preset === 'custom') {
      custom = resolvePalette(opts.getPreset() === 'custom' ? 'custom' : opts.getPreset(), custom)
    }
    opts.onChange(preset, custom)
    applySyntaxPalette(resolvePalette(preset, custom))
    renderPickers()
  })

  closeBtn.addEventListener('click', () => close())
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  function open(): void {
    renderPickers()
    backdrop.classList.remove('hidden')
  }
  function close(): void {
    backdrop.classList.add('hidden')
  }

  return {
    open,
    close,
    isOpen: () => !backdrop.classList.contains('hidden'),
    destroy: () => backdrop.remove()
  }
}

function toHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color
  return '#888888'
}
