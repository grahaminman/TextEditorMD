/**
 * Bundled starter Markdown template + optional user-visible copy.
 */

import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { pathExists } from './path-exists'

const TEMPLATE_NAME = 'starter.md'

export function getBundledTemplatePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', 'templates', TEMPLATE_NAME)
  }
  return path.join(app.getAppPath(), 'resources', 'templates', TEMPLATE_NAME)
}

export async function readStarterTemplate(): Promise<string> {
  const p = getBundledTemplatePath()
  try {
    return await fs.readFile(p, 'utf8')
  } catch {
    return '# Untitled\n\nStart writing Markdown…\n'
  }
}

export async function ensureUserTemplateAvailable(): Promise<string> {
  const dir = path.join(app.getPath('documents'), 'TextEditorMD', 'templates')
  const dest = path.join(dir, TEMPLATE_NAME)
  await fs.mkdir(dir, { recursive: true })
  if (!(await pathExists(dest))) {
    const content = await readStarterTemplate()
    await fs.writeFile(dest, content, 'utf8')
  }
  return dest
}
