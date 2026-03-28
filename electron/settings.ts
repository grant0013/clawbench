import { app } from 'electron'
import path from 'path'
import fs from 'fs'

interface AppSettings {
  llamaCppPath: string
  defaultGpuLayers: number
  defaultThreads: number
  theme: 'dark' | 'light'
  modelsDirectory: string
  licenseKey: string
  licenseStatus: string
  licenseTier: string
}

const defaultSettings: AppSettings = {
  llamaCppPath: '',
  defaultGpuLayers: 99,
  defaultThreads: 4,
  theme: 'dark',
  modelsDirectory: '',
  licenseKey: '',
  licenseStatus: 'none',
  licenseTier: '',
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  try {
    const data = fs.readFileSync(getSettingsPath(), 'utf-8')
    return { ...defaultSettings, ...JSON.parse(data) }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: AppSettings): void {
  const dir = path.dirname(getSettingsPath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
}
