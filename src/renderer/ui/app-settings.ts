/**
 * Application settings panel (autosave and related options).
 */

import {
  AUTOSAVE_INTERVAL_OPTIONS,
  type AutosaveIntervalMinutes
} from '../../shared/constants/app'

export interface AutosaveSettingsState {
  autosaveEnabled: boolean
  autosaveIntervalMinutes: AutosaveIntervalMinutes
  autosaveOnClose: boolean
}

export interface AppSettingsHandle {
  open: () => void
  close: () => void
  isOpen: () => boolean
  sync: (state: AutosaveSettingsState) => void
  destroy: () => void
}

export interface AppSettingsOptions {
  getState: () => AutosaveSettingsState
  onChange: (state: AutosaveSettingsState) => void
}

function intervalLabel(mins: number): string {
  if (mins === 1) return '1 minute'
  if (mins < 60) return `${mins} minutes`
  return '1 hour'
}

export function createAppSettingsPanel(
  parent: HTMLElement,
  opts: AppSettingsOptions
): AppSettingsHandle {
  const backdrop = document.createElement('div')
  backdrop.className = 'settings-backdrop hidden'
  backdrop.innerHTML = `
    <div class="settings-panel settings-panel-wide" role="dialog" aria-label="Settings">
      <header class="settings-header">
        <h2>Settings</h2>
        <button type="button" class="settings-close" aria-label="Close">×</button>
      </header>
      <div class="settings-body">
        <h3 class="settings-section-title">Autosave</h3>
        <label class="settings-row settings-row-check">
          <span>
            <strong>Timed autosave</strong>
            <span class="settings-sub">Save dirty files that already have a path</span>
          </span>
          <input type="checkbox" class="settings-autosave-enabled" />
        </label>
        <label class="settings-row">
          <span>Interval</span>
          <select class="settings-autosave-interval"></select>
        </label>
        <label class="settings-row settings-row-check">
          <span>
            <strong>Autosave on close</strong>
            <span class="settings-sub">If unsaved with a file path, save automatically when quitting</span>
          </span>
          <input type="checkbox" class="settings-autosave-on-close" />
        </label>
        <p class="settings-hint">
          Untitled documents still prompt on close so you can choose Save As, Discard, or Cancel.
          Timed autosave only runs when the document has been saved to a path at least once.
        </p>
      </div>
    </div>
  `
  parent.appendChild(backdrop)

  const enabledEl = backdrop.querySelector(
    '.settings-autosave-enabled'
  ) as HTMLInputElement
  const intervalEl = backdrop.querySelector(
    '.settings-autosave-interval'
  ) as HTMLSelectElement
  const onCloseEl = backdrop.querySelector(
    '.settings-autosave-on-close'
  ) as HTMLInputElement
  const closeBtn = backdrop.querySelector('.settings-close') as HTMLButtonElement

  for (const mins of AUTOSAVE_INTERVAL_OPTIONS) {
    const opt = document.createElement('option')
    opt.value = String(mins)
    opt.textContent = intervalLabel(mins)
    intervalEl.appendChild(opt)
  }

  function readUi(): AutosaveSettingsState {
    return {
      autosaveEnabled: enabledEl.checked,
      autosaveIntervalMinutes: Number(intervalEl.value) as AutosaveIntervalMinutes,
      autosaveOnClose: onCloseEl.checked
    }
  }

  function sync(state: AutosaveSettingsState): void {
    enabledEl.checked = state.autosaveEnabled
    intervalEl.value = String(state.autosaveIntervalMinutes)
    onCloseEl.checked = state.autosaveOnClose
    intervalEl.disabled = !state.autosaveEnabled
  }

  function emit(): void {
    const state = readUi()
    intervalEl.disabled = !state.autosaveEnabled
    opts.onChange(state)
  }

  enabledEl.addEventListener('change', emit)
  intervalEl.addEventListener('change', emit)
  onCloseEl.addEventListener('change', emit)
  closeBtn.addEventListener('click', () => close())
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  function open(): void {
    sync(opts.getState())
    backdrop.classList.remove('hidden')
  }
  function close(): void {
    backdrop.classList.add('hidden')
  }

  return {
    open,
    close,
    isOpen: () => !backdrop.classList.contains('hidden'),
    sync,
    destroy: () => backdrop.remove()
  }
}
