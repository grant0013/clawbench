import { execSync, spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

interface BuildPrerequisites {
  git: boolean
  cmake: boolean
  compiler: boolean
  cuda: boolean
  metal: boolean
  vulkan: boolean
  details: string[]
}

interface BuildProgress {
  stage: 'checking' | 'cloning' | 'configuring' | 'building' | 'complete' | 'error'
  message: string
  percent: number
  log: string[]
}

type ProgressCallback = (progress: BuildProgress) => void

export class LlamaCppBuilder {
  private activeProcess: ChildProcess | null = null
  private cancelled = false
  private buildLog: string[] = []

  checkPrerequisites(): BuildPrerequisites {
    const result: BuildPrerequisites = {
      git: false,
      cmake: false,
      compiler: false,
      cuda: false,
      metal: false,
      vulkan: false,
      details: [],
    }

    // Check git
    try {
      const gitVersion = execSync('git --version', { encoding: 'utf-8', timeout: 5000 }).trim()
      result.git = true
      result.details.push(`Git: ${gitVersion}`)
    } catch {
      result.details.push('Git: NOT FOUND - install from https://git-scm.com')
    }

    // Check cmake
    try {
      const cmakeVersion = execSync('cmake --version', { encoding: 'utf-8', timeout: 5000 }).split('\n')[0]
      result.cmake = true
      result.details.push(`CMake: ${cmakeVersion}`)
    } catch {
      result.details.push('CMake: NOT FOUND - install from https://cmake.org')
    }

    // Check compiler
    if (process.platform === 'win32') {
      try {
        execSync('cl', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
        result.compiler = true
        result.details.push('Compiler: MSVC (cl.exe)')
      } catch {
        try {
          const gccVersion = execSync('gcc --version', { encoding: 'utf-8', timeout: 5000 }).split('\n')[0]
          result.compiler = true
          result.details.push(`Compiler: ${gccVersion}`)
        } catch {
          result.details.push('Compiler: NOT FOUND - install Visual Studio Build Tools or MinGW')
        }
      }
    } else {
      try {
        const ccVersion = execSync('cc --version', { encoding: 'utf-8', timeout: 5000 }).split('\n')[0]
        result.compiler = true
        result.details.push(`Compiler: ${ccVersion}`)
      } catch {
        try {
          const gccVersion = execSync('gcc --version', { encoding: 'utf-8', timeout: 5000 }).split('\n')[0]
          result.compiler = true
          result.details.push(`Compiler: ${gccVersion}`)
        } catch {
          result.details.push('Compiler: NOT FOUND - install gcc or clang')
        }
      }
    }

    // Check CUDA
    try {
      const nvccVersion = execSync('nvcc --version', { encoding: 'utf-8', timeout: 5000 })
      const versionMatch = nvccVersion.match(/release ([\d.]+)/)
      result.cuda = true
      result.details.push(`CUDA: ${versionMatch ? versionMatch[1] : 'found'}`)
    } catch {
      result.details.push('CUDA: not available')
    }

    // Check Metal (macOS only)
    if (process.platform === 'darwin') {
      result.metal = true
      result.details.push('Metal: available (macOS)')
    }

    // Check Vulkan
    try {
      execSync('vulkaninfo --summary', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
      result.vulkan = true
      result.details.push('Vulkan: available')
    } catch {
      result.details.push('Vulkan: not available')
    }

    return result
  }

  async build(backend: string, onProgress: ProgressCallback): Promise<string> {
    this.cancelled = false
    this.buildLog = []

    const buildDir = path.join(app.getPath('userData'), 'llama-cpp-build')
    const sourceDir = path.join(buildDir, 'llama.cpp')
    const outputDir = path.join(sourceDir, 'build', 'bin')

    // Stage 1: Check prerequisites
    this.emit(onProgress, 'checking', 'Checking prerequisites...', 5)
    const prereqs = this.checkPrerequisites()
    if (!prereqs.git || !prereqs.cmake || !prereqs.compiler) {
      const missing = []
      if (!prereqs.git) missing.push('git')
      if (!prereqs.cmake) missing.push('cmake')
      if (!prereqs.compiler) missing.push('C/C++ compiler')
      this.emit(onProgress, 'error', `Missing: ${missing.join(', ')}`, 0)
      throw new Error(`Missing prerequisites: ${missing.join(', ')}`)
    }

    // Stage 2: Clone or update
    this.emit(onProgress, 'cloning', 'Downloading llama.cpp...', 15)
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true })

    if (fs.existsSync(sourceDir)) {
      // Pull latest
      await this.runCmd('git', ['pull'], sourceDir, onProgress)
    } else {
      await this.runCmd('git', ['clone', '--depth', '1', 'https://github.com/ggerganov/llama.cpp.git'], buildDir, onProgress)
    }

    if (this.cancelled) throw new Error('Build cancelled')

    // Stage 3: Configure with cmake
    this.emit(onProgress, 'configuring', 'Configuring build...', 40)
    const cmakeBuildDir = path.join(sourceDir, 'build')
    if (fs.existsSync(cmakeBuildDir)) {
      fs.rmSync(cmakeBuildDir, { recursive: true, force: true })
    }
    fs.mkdirSync(cmakeBuildDir, { recursive: true })

    const cmakeArgs = ['-S', sourceDir, '-B', cmakeBuildDir, '-DCMAKE_BUILD_TYPE=Release']

    // Add backend-specific flags
    switch (backend) {
      case 'cuda':
        cmakeArgs.push('-DGGML_CUDA=ON')
        break
      case 'metal':
        cmakeArgs.push('-DGGML_METAL=ON')
        break
      case 'vulkan':
        cmakeArgs.push('-DGGML_VULKAN=ON')
        break
      case 'cpu':
      default:
        break
    }

    await this.runCmd('cmake', cmakeArgs, sourceDir, onProgress)
    if (this.cancelled) throw new Error('Build cancelled')

    // Stage 4: Build
    this.emit(onProgress, 'building', 'Compiling llama.cpp (this may take a few minutes)...', 60)
    const buildArgs = ['--build', cmakeBuildDir, '--config', 'Release', '-j', String(Math.max(1, Math.ceil(require('os').cpus().length / 2)))]
    await this.runCmd('cmake', buildArgs, sourceDir, onProgress)

    if (this.cancelled) throw new Error('Build cancelled')

    // Find the built binaries
    let binPath = outputDir
    // On Windows, binaries may be in Release subfolder
    const releasePath = path.join(outputDir, 'Release')
    if (fs.existsSync(releasePath)) binPath = releasePath
    // Also check build root for some cmake versions
    if (!fs.existsSync(binPath)) binPath = cmakeBuildDir

    this.emit(onProgress, 'complete', `Build complete! Binaries at: ${binPath}`, 100)
    return binPath
  }

  cancel() {
    this.cancelled = true
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM')
      this.activeProcess = null
    }
  }

  private emit(cb: ProgressCallback, stage: BuildProgress['stage'], message: string, percent: number) {
    this.buildLog.push(message)
    cb({ stage, message, percent, log: [...this.buildLog] })
  }

  private runCmd(cmd: string, args: string[], cwd: string, onProgress: ProgressCallback): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
      this.activeProcess = proc

      proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          this.buildLog.push(line)
        }
        // Emit progress with latest log
        onProgress({
          stage: 'building',
          message: lines[lines.length - 1] || 'Building...',
          percent: 60, // Keep at build stage
          log: [...this.buildLog],
        })
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          this.buildLog.push(line)
        }
      })

      proc.on('close', (code) => {
        this.activeProcess = null
        if (code === 0 || code === null) {
          resolve()
        } else {
          reject(new Error(`Command "${cmd}" exited with code ${code}`))
        }
      })

      proc.on('error', (err) => {
        this.activeProcess = null
        reject(err)
      })
    })
  }
}
