import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { execSync, exec } from 'child_process'
import { app } from 'electron'

export interface InstallProgress {
  stage: 'detecting' | 'fetching-release' | 'downloading' | 'extracting' | 'complete' | 'error'
  message: string
  percent: number
  backend?: string
}

type ProgressCallback = (progress: InstallProgress) => void

function httpsGet(url: string): Promise<{ body: string; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    function doGet(currentUrl: string, redirects = 0) {
      if (redirects > 5) return reject(new Error('Too many redirects'))
      const mod = currentUrl.startsWith('https') ? https : http
      mod.get(currentUrl, { headers: { 'User-Agent': 'llm-bench/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doGet(res.headers.location, redirects + 1)
        }
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => resolve({ body: data, finalUrl: currentUrl }))
        res.on('error', reject)
      }).on('error', reject)
    }
    doGet(url)
  })
}

function detectBackend(): string {
  // Try CUDA first (NVIDIA)
  try {
    execSync('nvidia-smi', { stdio: 'pipe', timeout: 5000 })
    return 'cuda'
  } catch { /* no nvidia */ }

  // Try Vulkan (AMD/Intel)
  try {
    execSync('vulkaninfo --summary', { stdio: 'pipe', timeout: 5000 })
    return 'vulkan'
  } catch { /* no vulkan */ }

  return 'cpu'
}

function pickAsset(assets: any[], backend: string, platform: string): any | null {
  const lower = (s: string) => s.toLowerCase()
  // Only consider assets that start with "llama-" — excludes cudart-only DLL packs
  const bins = assets.filter((a: any) => lower(a.name).startsWith('llama-'))

  // Windows
  if (platform === 'win32') {
    if (backend === 'cuda') {
      const cuda = bins.find((a: any) => lower(a.name).includes('win') && lower(a.name).includes('cuda') && a.name.endsWith('.zip'))
      if (cuda) return cuda
    }
    if (backend === 'vulkan') {
      const vulkan = bins.find((a: any) => lower(a.name).includes('win') && lower(a.name).includes('vulkan') && a.name.endsWith('.zip'))
      if (vulkan) return vulkan
    }
    // CPU fallback (x64 preferred over arm64)
    const cpu = bins.find((a: any) => lower(a.name).includes('win') && lower(a.name).includes('cpu') && lower(a.name).includes('x64') && a.name.endsWith('.zip'))
    if (cpu) return cpu
    return bins.find((a: any) => lower(a.name).includes('win') && lower(a.name).includes('cpu') && a.name.endsWith('.zip')) || null
  }

  // macOS
  if (platform === 'darwin') {
    const mac = bins.find((a: any) => lower(a.name).includes('macos') && (a.name.endsWith('.zip') || a.name.endsWith('.tar.gz')))
    return mac || null
  }

  // Linux
  const linux = bins.find((a: any) =>
    (lower(a.name).includes('ubuntu') || lower(a.name).includes('linux')) &&
    (a.name.endsWith('.zip') || a.name.endsWith('.tar.gz'))
  )
  return linux || null
}

function downloadFile(url: string, destPath: string, onProgress: (pct: number, mb: number, totalMb: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    function doDownload(currentUrl: string, redirects = 0) {
      if (redirects > 5) return reject(new Error('Too many redirects'))
      const mod = currentUrl.startsWith('https') ? https : http
      mod.get(currentUrl, { headers: { 'User-Agent': 'llm-bench/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doDownload(res.headers.location, redirects + 1)
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`))

        const total = parseInt(res.headers['content-length'] || '0', 10)
        let received = 0
        const out = fs.createWriteStream(destPath)

        res.on('data', (chunk) => {
          received += chunk.length
          out.write(chunk)
          if (total > 0) {
            onProgress(Math.round((received / total) * 100), received / 1048576, total / 1048576)
          }
        })
        res.on('end', () => { out.end(); resolve() })
        res.on('error', (e) => { out.destroy(); reject(e) })
        out.on('error', reject)
      }).on('error', reject)
    }
    doDownload(url)
  })
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })

    let cmd: string
    if (process.platform === 'win32') {
      cmd = `powershell -Command "Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force"`
    } else {
      cmd = `unzip -o "${zipPath}" -d "${destDir}"`
    }

    exec(cmd, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function findBinary(dir: string, name: string): string | null {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const target = name + ext
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const found = findBinary(fullPath, name)
        if (found) return found
      } else if (entry.name === target) {
        return fullPath
      }
    }
  } catch { /* ignore */ }
  return null
}

export async function installPrebuiltLlamaCpp(onProgress: ProgressCallback): Promise<string> {
  const installDir = path.join(app.getPath('userData'), 'llama-cpp')

  // Check if already installed
  const existingBench = findBinary(installDir, 'llama-bench')
  if (existingBench) {
    onProgress({ stage: 'complete', message: 'llama.cpp already installed', percent: 100 })
    return path.dirname(existingBench)
  }

  // Detect backend
  onProgress({ stage: 'detecting', message: 'Detecting your GPU...', percent: 5 })
  const backend = detectBackend()
  const backendLabel = backend === 'cuda' ? 'NVIDIA CUDA' : backend === 'vulkan' ? 'Vulkan (AMD/Intel)' : 'CPU (AVX2)'
  onProgress({ stage: 'detecting', message: `Detected backend: ${backendLabel}`, percent: 10, backend })

  // Fetch latest release info
  onProgress({ stage: 'fetching-release', message: 'Finding latest llama.cpp release...', percent: 15 })
  const { body } = await httpsGet('https://api.github.com/repos/ggerganov/llama.cpp/releases/latest')
  const release = JSON.parse(body)
  const assets: any[] = release.assets || []
  const version: string = release.tag_name || 'latest'

  const asset = pickAsset(assets, backend, process.platform)
  if (!asset) {
    onProgress({ stage: 'error', message: 'Could not find a suitable prebuilt binary for your system', percent: 0 })
    throw new Error('No suitable prebuilt binary found')
  }

  onProgress({ stage: 'fetching-release', message: `Found ${version} — ${asset.name}`, percent: 20 })

  // For CUDA builds, also find the matching cudart DLL package
  let cudartAsset: any = null
  if (backend === 'cuda' && process.platform === 'win32') {
    // Match CUDA version from main asset name (e.g. "cuda-12.4" → "cudart-llama-bin-win-cuda-12.4-x64.zip")
    const cudaVerMatch = asset.name.match(/cuda-([\d.]+)/)
    const cudaVer = cudaVerMatch ? cudaVerMatch[1] : null
    cudartAsset = assets.find((a: any) =>
      a.name.toLowerCase().startsWith('cudart-') &&
      (cudaVer ? a.name.includes(cudaVer) : true) &&
      a.name.endsWith('.zip')
    )
  }

  // Download main binary package
  if (!fs.existsSync(installDir)) fs.mkdirSync(installDir, { recursive: true })
  const zipPath = path.join(installDir, asset.name)

  await downloadFile(asset.browser_download_url, zipPath, (pct, mb, totalMb) => {
    const mapped = 20 + Math.round(pct * 0.5)
    onProgress({
      stage: 'downloading',
      message: `Downloading binaries ${mb.toFixed(0)} / ${totalMb.toFixed(0)} MB...`,
      percent: mapped,
      backend,
    })
  })

  // Download CUDA runtime DLLs if needed
  if (cudartAsset) {
    const cudartZipPath = path.join(installDir, cudartAsset.name)
    await downloadFile(cudartAsset.browser_download_url, cudartZipPath, (pct, mb, totalMb) => {
      const mapped = 70 + Math.round(pct * 0.1)
      onProgress({
        stage: 'downloading',
        message: `Downloading CUDA runtime ${mb.toFixed(0)} / ${totalMb.toFixed(0)} MB...`,
        percent: mapped,
        backend,
      })
    })
    onProgress({ stage: 'extracting', message: 'Extracting CUDA runtime...', percent: 81 })
    const extractDir = path.join(installDir, 'bin')
    await extractZip(cudartZipPath, extractDir)
    try { fs.unlinkSync(cudartZipPath) } catch { /* ignore */ }
  }

  // Extract main package
  onProgress({ stage: 'extracting', message: 'Extracting binaries...', percent: 82 })
  const extractDir = path.join(installDir, 'bin')
  await extractZip(zipPath, extractDir)

  // Clean up zip
  try { fs.unlinkSync(zipPath) } catch { /* ignore */ }

  // Find llama-bench binary
  const benchBin = findBinary(extractDir, 'llama-bench')
  if (!benchBin) {
    onProgress({ stage: 'error', message: 'Extraction succeeded but could not find llama-bench binary', percent: 0 })
    throw new Error('llama-bench not found after extraction')
  }

  const binDir = path.dirname(benchBin)
  onProgress({ stage: 'complete', message: `llama.cpp installed successfully (${backendLabel})`, percent: 100, backend })
  return binDir
}
