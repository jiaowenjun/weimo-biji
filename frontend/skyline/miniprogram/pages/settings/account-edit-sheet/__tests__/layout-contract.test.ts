import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const pageDir = resolve(__dirname, '..')
const rootDir = resolve(__dirname, '../../../..')

function readPageFile(name: string) {
  return readFileSync(resolve(pageDir, name), 'utf8')
}

describe('account edit sheet layout contract', () => {
  it('registers the sheet page in app.json', () => {
    const appJson = readFileSync(resolve(rootDir, 'app.json'), 'utf8')

    expect(appJson).toContain('"pages/settings/account-edit-sheet/index"')
  })

  it('uses custom navigation and disables host scrolling', () => {
    const json = readPageFile('index.json')

    expect(json).toContain('"navigationStyle": "custom"')
    expect(json).toContain('"disableScroll": true')
    expect(json).toContain('"navigation-bar"')
    expect(json).toContain('"weimo-icon-button"')
  })

  it('matches tag picker navigation and top input action layout', () => {
    const wxml = readPageFile('index.wxml')

    expect(wxml).toContain('<navigation-bar title="{{title}}" modal="{{true}}" compact="{{true}}" />')
    expect(wxml).toContain('class="account-edit-page ds-page-inline-shell"')
    expect(wxml).toContain('style="padding-bottom: {{keyboardHeight > 0 ? keyboardHeight : 0}}px;"')
    expect(wxml).toContain('picker-toolbar__input-shell ds-field-shell ds-surface-floating ds-surface-frosted')
    expect(wxml).toContain('class="picker-toolbar__input"')
    expect(wxml).toContain('focus="{{inputFocus}}"')
    expect(wxml).toContain('bindkeyboardheightchange="handleKeyboardHeightChange"')
    expect(wxml).toContain('hold-keyboard="{{true}}"')
    expect(wxml).toContain('adjust-position="{{false}}"')
    expect(wxml).toContain('icon="check"')
    expect(wxml).toContain('ariaLabel="确认"')
    expect(wxml).toContain('bind:tap="handleSaveTap"')
    expect(wxml).not.toContain('bind:tap="handleCloseTap"')
    expect(wxml).not.toContain('>取消<')
    expect(wxml).not.toContain('>保存<')

    const focusBindings = wxml.match(/focus="{{inputFocus}}"/g) ?? []
    expect(focusBindings).toHaveLength(3)
  })

  it('reserves the check action column in password mode so both inputs stay equal width', () => {
    const wxml = readPageFile('index.wxml')
    const wxss = readPageFile('index.wxss')

    expect(wxml).toContain('class="account-edit-action-spacer"')
    expect(wxss).toContain('.account-edit-action-spacer')
    expect(wxss).toContain('width: calc(var(--icon-button-size-lg) + var(--spacing-sm));')
    expect(wxss).toContain('height: var(--icon-button-size-lg);')
    expect(wxss).toContain('flex: none;')
  })

  it('keeps account detail page free of inline edit state', () => {
    const accountWxml = readFileSync(resolve(pageDir, '../account-detail/index.wxml'), 'utf8')

    expect(accountWxml).not.toContain('isEditingNickname')
    expect(accountWxml).not.toContain('isEditingLoginName')
    expect(accountWxml).not.toContain('isEditingPassword')
    expect(accountWxml).not.toContain('handleSaveNicknameTap')
    expect(accountWxml).not.toContain('handleSaveLoginNameTap')
    expect(accountWxml).not.toContain('handleSavePasswordTap')
  })
})
