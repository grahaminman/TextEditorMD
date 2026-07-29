import { describe, it, expect } from 'vitest'
import {
  countCharacters,
  countWords,
  plainTextFromMarkdown,
  renderCommonMarkHtml
} from '../src/shared/markdown/commonmark'
import { markdownToStandaloneHtml } from '../src/shared/markdown/export-html'

describe('CommonMark rendering', () => {
  it('renders headings', () => {
    const html = renderCommonMarkHtml('# Hello')
    expect(html).toContain('<h1>')
    expect(html).toContain('Hello')
  })

  it('renders emphasis and strong', () => {
    const html = renderCommonMarkHtml('This is *em* and **strong**.')
    expect(html).toMatch(/<em>em<\/em>/)
    expect(html).toMatch(/<strong>strong<\/strong>/)
  })

  it('renders links', () => {
    const html = renderCommonMarkHtml('[CommonMark](https://commonmark.org/)')
    expect(html).toContain('href="https://commonmark.org/"')
    expect(html).toContain('CommonMark')
  })

  it('renders fenced code blocks as pre/code', () => {
    const html = renderCommonMarkHtml('```\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code>')
    expect(html).toContain('const x = 1')
  })

  it('renders lists', () => {
    const html = renderCommonMarkHtml('- one\n- two')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>one</li>')
  })

  it('renders block quotes', () => {
    const html = renderCommonMarkHtml('> quoted')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('quoted')
  })
})

describe('stats helpers', () => {
  it('counts words from markdown text', () => {
    expect(countWords('one two three')).toBe(3)
    expect(countWords('# Title\n\nHello **world**')).toBeGreaterThanOrEqual(3)
  })

  it('counts characters', () => {
    expect(countCharacters('abc')).toBe(3)
  })

  it('extracts plain text', () => {
    const text = plainTextFromMarkdown('**Hello** *world*')
    expect(text.toLowerCase()).toContain('hello')
    expect(text.toLowerCase()).toContain('world')
  })
})

describe('HTML export', () => {
  it('wraps body in a standalone document', () => {
    const doc = markdownToStandaloneHtml('# Hi', { title: 'Test' })
    expect(doc).toContain('<!DOCTYPE html>')
    expect(doc).toContain('<title>Test</title>')
    expect(doc).toContain('<h1>Hi</h1>')
  })
})
