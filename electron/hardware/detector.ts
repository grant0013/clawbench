import { execSync } from 'child_process'
import os from 'os'

interface GpuInfo {
  name: string
  vramMb: number
  driver: string
  cudaVersion: string | null
  type: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown'
}

interface CpuInfo {
  name: string
  cores: number
  threads: number
  architecture: string
}

interface RamInfo {
  totalMb: number
  availableMb: number
}

interface HardwareInfo {
  gpus: GpuInfo[]
  cpu: CpuInfo
  ram: RamInfo
  platform: string
  hasGpuAcceleration: boolean
  recommendedBackend: 'cuda' | 'metal' | 'vulkan' | 'cpu'
}

export async function detectHardware(): Promise<HardwareInfo> {
  const gpus = await detectGPUs()
  const cpu = detectCPU()
  const ram = detectRAM()
  const platform = process.platform

  const hasNvidia = gpus.some((g) => g.type === 'nvidia')
  const hasApple = gpus.some((g) => g.type === 'apple')
  const hasAmd = gpus.some((g) => g.type === 'amd')

  let recommendedBackend: HardwareInfo['recommendedBackend'] = 'cpu'
  if (hasNvidia) recommendedBackend = 'cuda'
  else if (hasApple) recommendedBackend = 'metal'
  else if (hasAmd) recommendedBackend = 'vulkan'

  return {
    gpus,
    cpu,
    ram,
    platform,
    hasGpuAcceleration: gpus.length > 0 && recommendedBackend !== 'cpu',
    recommendedBackend,
  }
}

async function detectGPUs(): Promise<GpuInfo[]> {
  const gpus: GpuInfo[] = []

  // Try NVIDIA first (works on Windows/Linux)
  try {
    const nvidiaOutput = execSync(
      'nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()

    let cudaVersion: string | null = null
    try {
      const cudaOut = execSync('nvidia-smi --query-gpu=driver_version --format=csv,noheader', { encoding: 'utf-8', timeout: 5000 }).trim()
      const fullOut = execSync('nvidia-smi', { encoding: 'utf-8', timeout: 5000 })
      const cudaMatch = fullOut.match(/CUDA Version:\s*([\d.]+)/)
      cudaVersion = cudaMatch ? cudaMatch[1] : null
    } catch {}

    for (const line of nvidiaOutput.split('\n')) {
      const parts = line.split(',').map((s) => s.trim())
      if (parts.length >= 3) {
        gpus.push({
          name: parts[0],
          vramMb: parseInt(parts[1]) || 0,
          driver: parts[2],
          cudaVersion,
          type: 'nvidia',
        })
      }
    }
  } catch {}

  // macOS - detect Apple Silicon / Metal GPUs
  if (process.platform === 'darwin') {
    try {
      const spOutput = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', timeout: 10000 })
      const nameMatch = spOutput.match(/Chipset Model:\s*(.+)/i) || spOutput.match(/Chip:\s*(.+)/i)
      const vramMatch = spOutput.match(/VRAM.*?:\s*(\d+)\s*(MB|GB)/i)
      const metalMatch = spOutput.match(/Metal.*?:\s*(.+)/i)

      if (nameMatch) {
        let vramMb = 0
        if (vramMatch) {
          vramMb = parseInt(vramMatch[1])
          if (vramMatch[2] === 'GB') vramMb *= 1024
        } else {
          // Apple Silicon uses unified memory - report half of system RAM as available for GPU
          vramMb = Math.round(os.totalmem() / (1024 * 1024) / 2)
        }

        gpus.push({
          name: nameMatch[1].trim(),
          vramMb,
          driver: metalMatch ? metalMatch[1].trim() : 'Metal',
          cudaVersion: null,
          type: 'apple',
        })
      }
    } catch {}
  }

  // Windows - fallback to WMIC for non-NVIDIA GPUs
  if (process.platform === 'win32' && gpus.length === 0) {
    try {
      const wmicOutput = execSync(
        'wmic path win32_videocontroller get name,adapterram,driverversion /format:csv',
        { encoding: 'utf-8', timeout: 10000 }
      ).trim()

      for (const line of wmicOutput.split('\n').slice(1)) {
        const parts = line.split(',').map((s) => s.trim())
        if (parts.length >= 4 && parts[2]) {
          const vramBytes = parseInt(parts[1]) || 0
          const name = parts[2]
          gpus.push({
            name,
            vramMb: Math.round(vramBytes / (1024 * 1024)),
            driver: parts[3] || '',
            cudaVersion: null,
            type: name.toLowerCase().includes('amd') || name.toLowerCase().includes('radeon') ? 'amd'
              : name.toLowerCase().includes('intel') ? 'intel' : 'unknown',
          })
        }
      }
    } catch {}
  }

  // Linux - fallback to lspci + rocm-smi for AMD
  if (process.platform === 'linux' && gpus.length === 0) {
    try {
      const lspciOutput = execSync('lspci | grep -i vga', { encoding: 'utf-8', timeout: 5000 }).trim()
      for (const line of lspciOutput.split('\n')) {
        const nameMatch = line.match(/:\s*(.+)/)
        if (nameMatch) {
          const name = nameMatch[1].trim()
          let vramMb = 0
          let type: GpuInfo['type'] = 'unknown'

          if (name.toLowerCase().includes('amd') || name.toLowerCase().includes('radeon')) {
            type = 'amd'
            try {
              const rocmOut = execSync('rocm-smi --showmeminfo vram', { encoding: 'utf-8', timeout: 5000 })
              const memMatch = rocmOut.match(/Total.*?(\d+)\s*MB/i)
              if (memMatch) vramMb = parseInt(memMatch[1])
            } catch {}
          } else if (name.toLowerCase().includes('intel')) {
            type = 'intel'
          }

          gpus.push({ name, vramMb, driver: '', cudaVersion: null, type })
        }
      }
    } catch {}
  }

  return gpus
}

function detectCPU(): CpuInfo {
  const cpus = os.cpus()
  return {
    name: cpus[0]?.model || 'Unknown CPU',
    cores: cpus.length,
    threads: cpus.length,
    architecture: os.arch(),
  }
}

function detectRAM(): RamInfo {
  const totalMb = Math.round(os.totalmem() / (1024 * 1024))
  const availableMb = Math.round(os.freemem() / (1024 * 1024))
  return { totalMb, availableMb }
}
