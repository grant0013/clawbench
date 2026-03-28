export interface BenchmarkConfig {
  modelPath: string
  benchmarks: BenchmarkType[]
  nGpuLayers: number
  contextSizes: number[]
  batchSizes: number[]
  threads: number
  repetitions: number
}

export type BenchmarkType =
  | 'token-speed'
  | 'memory-usage'
  | 'perplexity'
  | 'context-scaling'
  | 'batch-size'
  | 'quant-compare'

export interface BenchmarkResult {
  id: string
  timestamp: number
  modelName: string
  modelPath: string
  type: BenchmarkType
  nGpuLayers: number
  threads: number
  data: TokenSpeedResult | MemoryResult | PerplexityResult | ScalingResult | BatchResult | QuantResult
}

export interface TokenSpeedResult {
  promptTokensPerSec: number
  genTokensPerSec: number
  totalTokens: number
  promptMs: number
  genMs: number
}

export interface MemoryResult {
  peakRamMb: number
  peakVramMb: number | null
  modelSizeMb: number
}

export interface PerplexityResult {
  perplexity: number
  tokens: number
  seconds: number
}

export interface ScalingResult {
  points: { contextSize: number; tokensPerSec: number }[]
}

export interface BatchResult {
  points: { batchSize: number; tokensPerSec: number }[]
}

export interface QuantResult {
  variants: {
    quantName: string
    fileSizeMb: number
    tokensPerSec: number
    perplexity: number | null
  }[]
}

export interface AppSettings {
  llamaCppPath: string
  defaultGpuLayers: number
  defaultThreads: number
  theme: 'dark' | 'light'
  modelsDirectory: string
  licenseKey: string
  licenseStatus: LicenseStatus
}

export type AppView = 'benchmark' | 'results' | 'history' | 'models' | 'hardware' | 'settings'

export interface BenchmarkProgress {
  running: boolean
  currentBenchmark: BenchmarkType | null
  currentStep: number
  totalSteps: number
  message: string
  percent: number
}

// --- Hardware Detection ---

export interface GpuInfo {
  name: string
  vramMb: number
  driver: string
  cudaVersion: string | null
  type: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown'
}

export interface CpuInfo {
  name: string
  cores: number
  threads: number
  architecture: string
}

export interface RamInfo {
  totalMb: number
  availableMb: number
}

export interface HardwareInfo {
  gpus: GpuInfo[]
  cpu: CpuInfo
  ram: RamInfo
  platform: string
  hasGpuAcceleration: boolean
  recommendedBackend: 'cuda' | 'metal' | 'vulkan' | 'cpu'
}

// --- Auto-Optimizer ---

export interface OptimizedSettings {
  nGpuLayers: number
  threads: number
  batchSize: number
  contextSize: number
  explanation: string[]
}

// --- HuggingFace ---

export interface HFModel {
  id: string
  name: string
  author: string
  description: string
  downloads: number
  likes: number
  lastModified: string
  tags: string[]
  files: HFModelFile[]
}

export interface HFModelFile {
  filename: string
  sizeMb: number
  quantType: string
  downloadUrl: string
}

export interface HFSearchResult {
  models: HFModel[]
  totalCount: number
}

export interface DownloadProgress {
  modelId: string
  filename: string
  downloadedMb: number
  totalMb: number
  percent: number
  speedMbps: number
  status: 'downloading' | 'complete' | 'error' | 'cancelled'
  error?: string
}

// --- llama.cpp Builder ---

export interface BuildPrerequisites {
  git: boolean
  cmake: boolean
  compiler: boolean
  cuda: boolean
  metal: boolean
  vulkan: boolean
  details: string[]
}

export interface BuildProgress {
  stage: 'checking' | 'cloning' | 'configuring' | 'building' | 'complete' | 'error'
  message: string
  percent: number
  log: string[]
}

// --- License ---

export type LicenseStatus = 'none' | 'active' | 'expired' | 'invalid'

export interface LicenseInfo {
  status: LicenseStatus
  key: string
  expiresAt: string | null
  features: string[]
  isPremium: boolean
}
