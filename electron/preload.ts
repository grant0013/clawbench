import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing
  selectFile: (filters?: any[]) => ipcRenderer.invoke('select-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  detectLlamaCpp: () => ipcRenderer.invoke('detect-llamacpp'),
  runBenchmark: (config: any) => ipcRenderer.invoke('run-benchmark', config),
  cancelBenchmark: () => ipcRenderer.invoke('cancel-benchmark'),
  onBenchmarkProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('benchmark-progress', handler)
    return () => ipcRenderer.removeListener('benchmark-progress', handler)
  },
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteHistoryItem: (id: string) => ipcRenderer.invoke('delete-history-item', id),
  exportResults: (results: any[], format: string) => ipcRenderer.invoke('export-results', results, format),

  // Hardware
  detectHardware: () => ipcRenderer.invoke('detect-hardware'),
  optimizeSettings: (modelPath: string, hardwareInfo: any) => ipcRenderer.invoke('optimize-settings', modelPath, hardwareInfo),

  // HuggingFace
  searchModels: (query: string, page?: number) => ipcRenderer.invoke('search-models', query, page),
  getModelDetails: (modelId: string) => ipcRenderer.invoke('get-model-details', modelId),
  downloadModel: (modelId: string, filename: string, destDir: string) => ipcRenderer.invoke('download-model', modelId, filename, destDir),
  cancelDownload: () => ipcRenderer.invoke('cancel-download'),
  onDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },

  // Build llama.cpp
  checkBuildPrerequisites: () => ipcRenderer.invoke('check-build-prerequisites'),
  buildLlamaCpp: (backend: string) => ipcRenderer.invoke('build-llamacpp', backend),
  cancelBuild: () => ipcRenderer.invoke('cancel-build'),
  onBuildProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('build-progress', handler)
    return () => ipcRenderer.removeListener('build-progress', handler)
  },

  generateSetupScript: (modelPath: string, nGpuLayers: number, threads: number, genTps: number, ppTps: number) =>
    ipcRenderer.invoke('generate-setup-script', modelPath, nGpuLayers, threads, genTps, ppTps),

  // Install prebuilt llama.cpp
  installLlamaCppPrebuilt: (force?: boolean) => ipcRenderer.invoke('install-llamacpp-prebuilt', force),
  onInstallProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('install-progress', handler)
    return () => ipcRenderer.removeListener('install-progress', handler)
  },

  // License
  activateLicense: (key: string) => ipcRenderer.invoke('activate-license', key),
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),

  // Utilities
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Auto-update
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info)
    ipcRenderer.on('update-available', handler)
    return () => ipcRenderer.removeListener('update-available', handler)
  },
  onUpdateProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress)
    ipcRenderer.on('update-progress', handler)
    return () => ipcRenderer.removeListener('update-progress', handler)
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info)
    ipcRenderer.on('update-downloaded', handler)
    return () => ipcRenderer.removeListener('update-downloaded', handler)
  },
})
