import type { UpdateInfo } from 'builder-util-runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@logger', () => ({
  loggerService: {
    withContext: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    })
  }
}))

vi.mock('../ConfigManager', () => ({
  configManager: {
    getLanguage: vi.fn(),
    getAutoUpdate: vi.fn(() => false),
    getTestPlan: vi.fn(() => false),
    getTestChannel: vi.fn(),
    getClientId: vi.fn(() => 'test-client-id')
  }
}))

vi.mock('../WindowService', () => ({
  windowService: {
    getMainWindow: vi.fn()
  }
}))

vi.mock('@main/constant', () => ({
  isWin: false
}))

vi.mock('@main/utils/locales', () => ({
  locales: {
    en: { translation: { update: {} } },
    'zh-CN': { translation: { update: {} } }
  }
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => '/test/path')
  },
  dialog: {
    showMessageBox: vi.fn()
  },
  BrowserWindow: vi.fn(),
  net: {
    fetch: vi.fn()
  }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null,
    forceDevUpdateConfig: false,
    autoDownload: false,
    autoInstallOnAppQuit: false,
    requestHeaders: {},
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    channel: '',
    allowDowngrade: false,
    disableDifferentialDownload: false,
    currentVersion: '1.0.0'
  },
  Logger: vi.fn(),
  NsisUpdater: vi.fn(),
  AppUpdater: vi.fn()
}))

import { app } from 'electron'
import { autoUpdater } from 'electron-updater'

import AppUpdater from '../AppUpdater'
import { configManager } from '../ConfigManager'

describe('AppUpdater', () => {
  let appUpdater: AppUpdater

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(app.getVersion).mockReturnValue('1.0.0')
    vi.mocked(configManager.getAutoUpdate).mockReturnValue(false)
    appUpdater = new AppUpdater()
  })

  describe('checkForUpdates', () => {
    it('skips official update checks for my-classic-cherry', async () => {
      const result = await appUpdater.checkForUpdates()

      expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
      expect(result).toEqual({
        currentVersion: '1.0.0',
        updateInfo: null
      })
    })
  })

  describe('parseMultiLangReleaseNotes', () => {
    const sampleReleaseNotes = `<!--LANG:en-->
🚀 New Features:
- Feature A
- Feature B

🎨 UI Improvements:
- Improvement A
<!--LANG:zh-CN-->
🚀 新功能：
- 功能 A
- 功能 B

🎨 界面改进：
- 改进 A
<!--LANG:END-->`

    it('returns Chinese notes for zh-CN users', () => {
      vi.mocked(configManager.getLanguage).mockReturnValue('zh-CN')

      const result = (appUpdater as any).parseMultiLangReleaseNotes(sampleReleaseNotes)

      expect(result).toContain('新功能')
      expect(result).toContain('功能 A')
      expect(result).not.toContain('New Features')
    })

    it('returns Chinese notes for zh-TW users', () => {
      vi.mocked(configManager.getLanguage).mockReturnValue('zh-TW')

      const result = (appUpdater as any).parseMultiLangReleaseNotes(sampleReleaseNotes)

      expect(result).toContain('新功能')
      expect(result).not.toContain('New Features')
    })

    it('returns English notes for non-Chinese users', () => {
      vi.mocked(configManager.getLanguage).mockReturnValue('en-US')

      const result = (appUpdater as any).parseMultiLangReleaseNotes(sampleReleaseNotes)

      expect(result).toContain('New Features')
      expect(result).not.toContain('新功能')
    })

    it('returns English notes for other languages', () => {
      vi.mocked(configManager.getLanguage).mockReturnValue('ru-RU')

      const result = (appUpdater as any).parseMultiLangReleaseNotes(sampleReleaseNotes)

      expect(result).toContain('New Features')
      expect(result).not.toContain('新功能')
    })

    it('handles release notes without language markers', () => {
      const releaseNotes = 'Simple release notes without markers'

      expect((appUpdater as any).parseMultiLangReleaseNotes(releaseNotes)).toBe(releaseNotes)
    })

    it('cleans malformed markers', () => {
      vi.mocked(configManager.getLanguage).mockReturnValue('zh-CN')

      const result = (appUpdater as any).parseMultiLangReleaseNotes('<!--LANG:en-->English only')

      expect(result).toBe('English only')
    })

    it('handles empty release notes', () => {
      expect((appUpdater as any).parseMultiLangReleaseNotes('')).toBe('')
    })

    it('returns the original notes when language lookup fails', () => {
      vi.mocked(configManager.getLanguage).mockImplementation(() => {
        throw new Error('Test error')
      })

      expect((appUpdater as any).parseMultiLangReleaseNotes(sampleReleaseNotes)).toBe(sampleReleaseNotes)
    })
  })

  describe('hasMultiLanguageMarkers', () => {
    it('detects language markers', () => {
      expect((appUpdater as any).hasMultiLanguageMarkers('<!--LANG:en-->Test')).toBe(true)
    })

    it('rejects unmarked notes', () => {
      expect((appUpdater as any).hasMultiLanguageMarkers('Simple release notes')).toBe(false)
    })
  })

  describe('processReleaseInfo', () => {
    it('localizes marked release notes', () => {
      vi.mocked(configManager.getLanguage).mockReturnValue('zh-CN')
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: '<!--LANG:en-->English notes<!--LANG:zh-CN-->中文说明<!--LANG:END-->'
      } as UpdateInfo

      const result = (appUpdater as any).processReleaseInfo(releaseInfo)

      expect(result.releaseNotes).toBe('中文说明')
    })

    it('leaves unmarked release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: 'Simple release notes'
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBe('Simple release notes')
    })

    it('leaves array release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: [
          { version: '1.0.0', note: 'Note 1' },
          { version: '1.0.1', note: 'Note 2' }
        ]
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toEqual(releaseInfo.releaseNotes)
    })

    it('leaves null release notes unchanged', () => {
      const releaseInfo = {
        version: '1.0.0',
        files: [],
        path: '',
        sha512: '',
        releaseDate: new Date().toISOString(),
        releaseNotes: null
      } as UpdateInfo

      expect((appUpdater as any).processReleaseInfo(releaseInfo).releaseNotes).toBeNull()
    })
  })
})
