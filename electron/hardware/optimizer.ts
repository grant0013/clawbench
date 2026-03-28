import fs from 'fs'

interface GpuInfo {
  name: string
  vramMb: number
  type: string
}

interface HardwareInfo {
  gpus: GpuInfo[]
  cpu: { cores: number; threads: number }
  ram: { totalMb: number; availableMb: number }
}

interface OptimizedSettings {
  nGpuLayers: number
  threads: number
  batchSize: number
  contextSize: number
  explanation: string[]
}

// Approximate memory per layer for common model sizes (in MB)
const LAYER_MEMORY_ESTIMATES: Record<string, number> = {
  '1B': 25,
  '3B': 55,
  '7B': 120,
  '8B': 130,
  '13B': 210,
  '14B': 220,
  '30B': 450,
  '34B': 500,
  '65B': 900,
  '70B': 950,
}

export function optimizeSettings(modelPath: string, hardware: HardwareInfo): OptimizedSettings {
  const explanation: string[] = []
  const modelSizeMb = getModelSizeMb(modelPath)
  const estimatedLayers = estimateLayerCount(modelPath)
  const totalGpuVram = hardware.gpus.reduce((sum, g) => sum + g.vramMb, 0)

  // --- GPU Layers ---
  let nGpuLayers = 0
  if (totalGpuVram > 0 && estimatedLayers > 0) {
    const memPerLayer = modelSizeMb / estimatedLayers
    // Reserve 500MB VRAM for KV cache and overhead
    const availableVram = totalGpuVram - 500
    const maxLayers = Math.floor(availableVram / memPerLayer)
    nGpuLayers = Math.min(maxLayers, estimatedLayers)

    if (nGpuLayers >= estimatedLayers) {
      nGpuLayers = 99 // All layers fit
      explanation.push(`All ${estimatedLayers} layers fit in ${totalGpuVram}MB VRAM - full GPU offload`)
    } else if (nGpuLayers > 0) {
      explanation.push(`${nGpuLayers} of ~${estimatedLayers} layers fit in ${totalGpuVram}MB VRAM (partial offload)`)
    } else {
      explanation.push(`Model too large for ${totalGpuVram}MB VRAM - running on CPU only`)
    }
  } else if (totalGpuVram === 0) {
    explanation.push('No GPU detected - running on CPU only')
  } else {
    nGpuLayers = 99 // Default to all if we can't estimate
    explanation.push('Could not estimate layer count - defaulting to full GPU offload')
  }

  // --- Threads ---
  // Use physical cores minus 1, capped at reasonable limits
  const physicalCores = Math.ceil(hardware.cpu.cores / 2) // Approximate physical cores
  const optimalThreads = Math.max(1, Math.min(physicalCores - 1, 16))
  explanation.push(`Using ${optimalThreads} threads (${hardware.cpu.cores} logical cores detected)`)

  // --- Batch Size ---
  let batchSize = 512 // Default
  if (hardware.ram.availableMb > 16000) {
    batchSize = 2048
    explanation.push('Large RAM available - using batch size 2048')
  } else if (hardware.ram.availableMb > 8000) {
    batchSize = 1024
    explanation.push('Moderate RAM available - using batch size 1024')
  } else {
    batchSize = 512
    explanation.push('Limited RAM - using batch size 512')
  }

  // --- Context Size ---
  let contextSize = 2048 // Conservative default
  const availableMemForContext = Math.min(
    hardware.ram.availableMb * 0.3,
    totalGpuVram > 0 ? totalGpuVram * 0.3 : Infinity
  )
  // Rough estimate: ~2MB per 1K context for 7B model, scales with model size
  const scaleFactor = modelSizeMb / 4000 // Normalize to ~7B model
  const mbPer1kCtx = 2 * Math.max(1, scaleFactor)

  if (availableMemForContext / mbPer1kCtx >= 8) {
    contextSize = 8192
    explanation.push('Enough memory for 8K context window')
  } else if (availableMemForContext / mbPer1kCtx >= 4) {
    contextSize = 4096
    explanation.push('Enough memory for 4K context window')
  } else {
    contextSize = 2048
    explanation.push('Using conservative 2K context to avoid OOM')
  }

  return { nGpuLayers, threads: optimalThreads, batchSize, contextSize, explanation }
}

function getModelSizeMb(modelPath: string): number {
  try {
    const stats = fs.statSync(modelPath)
    return stats.size / (1024 * 1024)
  } catch {
    return 4000 // Default ~7B Q4
  }
}

function estimateLayerCount(modelPath: string): number {
  const filename = modelPath.toLowerCase()

  // Try to extract parameter count from filename
  for (const [key, memPerLayer] of Object.entries(LAYER_MEMORY_ESTIMATES)) {
    const paramNum = key.replace('B', '')
    if (filename.includes(`-${paramNum}b`) || filename.includes(`_${paramNum}b`) || filename.includes(`.${paramNum}b`)) {
      const modelSizeMb = getModelSizeMb(modelPath)
      return Math.round(modelSizeMb / memPerLayer)
    }
  }

  // Fallback: estimate from file size
  const sizeMb = getModelSizeMb(modelPath)
  if (sizeMb < 1500) return 22      // ~1B-3B
  if (sizeMb < 5000) return 32      // ~7B
  if (sizeMb < 10000) return 40     // ~13B
  if (sizeMb < 25000) return 60     // ~30B-34B
  return 80                          // ~65B-70B
}
