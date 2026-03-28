import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../lib/types'
import { api } from '../lib/ipc'

const defaultSettings: AppSettings = {
  llamaCppPath: '',
  defaultGpuLayers: 99,
  defaultThreads: 4,
  theme: 'dark',
  modelsDirectory: '',
  licenseKey: '',
  licenseStatus: 'none',
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const next = { ...settings, ...updates }
    setSettings(next)
    await api.saveSettings(next)
  }, [settings])

  const detectLlamaCpp = useCallback(async () => {
    const path = await api.detectLlamaCpp()
    if (path) {
      await updateSettings({ llamaCppPath: path })
    }
    return path
  }, [updateSettings])

  return { settings, loading, updateSettings, detectLlamaCpp }
}
