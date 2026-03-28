import type {
  AppSettings, BenchmarkConfig, BenchmarkResult, BenchmarkProgress,
  HardwareInfo, OptimizedSettings, HFSearchResult, HFModel,
  DownloadProgress, BuildPrerequisites, BuildProgress, LicenseInfo,
} from './types'

interface ElectronAPI {
  // Existing
  selectFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>
  selectDirectory: () => Promise<string | null>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<void>
  detectLlamaCpp: () => Promise<string | null>
  runBenchmark: (config: BenchmarkConfig) => Promise<BenchmarkResult[]>
  cancelBenchmark: () => Promise<void>
  onBenchmarkProgress: (callback: (progress: BenchmarkProgress) => void) => () => void
  getHistory: () => Promise<BenchmarkResult[]>
  deleteHistoryItem: (id: string) => Promise<void>
  exportResults: (results: BenchmarkResult[], format: 'json' | 'csv') => Promise<string>

  // Hardware
  detectHardware: () => Promise<HardwareInfo>
  optimizeSettings: (modelPath: string, hardwareInfo: HardwareInfo) => Promise<OptimizedSettings>

  // HuggingFace
  searchModels: (query: string, page?: number) => Promise<HFSearchResult>
  getModelDetails: (modelId: string) => Promise<HFModel>
  downloadModel: (modelId: string, filename: string, destDir: string) => Promise<string>
  cancelDownload: () => Promise<void>
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void

  // Build llama.cpp
  checkBuildPrerequisites: () => Promise<BuildPrerequisites>
  buildLlamaCpp: (backend: string) => Promise<string>
  cancelBuild: () => Promise<void>
  onBuildProgress: (callback: (progress: BuildProgress) => void) => () => void

  generateSetupScript: (modelPath: string, nGpuLayers: number, threads: number, genTps: number, ppTps: number) => Promise<string>

  // Auto-install prebuilt
  installLlamaCppPrebuilt: (force?: boolean) => Promise<string>
  onInstallProgress: (callback: (progress: { stage: string; message: string; percent: number; backend?: string }) => void) => () => void

  // License
  activateLicense: (key: string) => Promise<LicenseInfo>
  getLicenseInfo: () => Promise<LicenseInfo>
  deactivateLicense: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

const isDev = !window.electronAPI

const mockHardware: HardwareInfo = {
  gpus: [{ name: 'NVIDIA RTX 4090', vramMb: 24576, driver: '550.54', cudaVersion: '12.4', type: 'nvidia' }],
  cpu: { name: 'AMD Ryzen 9 7950X', cores: 16, threads: 32, architecture: 'x86_64' },
  ram: { totalMb: 65536, availableMb: 48000 },
  platform: 'win32',
  hasGpuAcceleration: true,
  recommendedBackend: 'cuda',
}

const mockSettings: AppSettings = {
  llamaCppPath: '',
  defaultGpuLayers: 99,
  defaultThreads: 4,
  theme: 'dark',
  modelsDirectory: '',
  licenseKey: '',
  licenseStatus: 'none',
}

const mockLicense: LicenseInfo = {
  status: 'none',
  key: '',
  expiresAt: null,
  features: [],
  isPremium: false,
}

export const api: ElectronAPI = window.electronAPI ?? {
  selectFile: async () => null,
  selectDirectory: async () => null,
  getSettings: async () => mockSettings,
  saveSettings: async () => {},
  detectLlamaCpp: async () => null,
  runBenchmark: async () => [],
  cancelBenchmark: async () => {},
  onBenchmarkProgress: () => () => {},
  getHistory: async () => [],
  deleteHistoryItem: async () => {},
  exportResults: async () => '',
  detectHardware: async () => mockHardware,
  optimizeSettings: async () => ({
    nGpuLayers: 99, threads: 8, batchSize: 512, contextSize: 4096,
    explanation: ['Mock: 24GB VRAM can fit all layers', 'Using 8 of 32 threads (optimal)'],
  }),
  searchModels: async () => ({ models: [], totalCount: 0 }),
  getModelDetails: async () => ({ id: '', name: '', author: '', description: '', downloads: 0, likes: 0, lastModified: '', tags: [], files: [] }),
  downloadModel: async () => '',
  cancelDownload: async () => {},
  onDownloadProgress: () => () => {},
  checkBuildPrerequisites: async () => ({ git: true, cmake: true, compiler: true, cuda: false, metal: false, vulkan: false, details: [] }),
  buildLlamaCpp: async () => '',
  cancelBuild: async () => {},
  onBuildProgress: () => () => {},
  generateSetupScript: async () => 'C:\\Users\\user\\Desktop\\Run model.bat',
  installLlamaCppPrebuilt: async () => '/mock/llama-cpp/bin',
  onInstallProgress: () => () => {},
  activateLicense: async () => mockLicense,
  getLicenseInfo: async () => mockLicense,
  deactivateLicense: async () => {},
}

export { isDev }
