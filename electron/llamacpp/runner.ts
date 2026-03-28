import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

export interface RunOptions {
  binary: 'llama-bench' | 'llama-cli' | 'llama-perplexity'
  args: string[]
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
  timeoutMs?: number
}

export interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export class LlamaCppRunner {
  private basePath = ''
  private activeProcess: ChildProcess | null = null

  setPath(basePath: string) {
    this.basePath = basePath
  }

  getBinaryPath(binary: string): string {
    const ext = process.platform === 'win32' ? '.exe' : ''
    return path.join(this.basePath, binary + ext)
  }

  isAvailable(binary: string = 'llama-bench'): boolean {
    return fs.existsSync(this.getBinaryPath(binary))
  }

  async run(options: RunOptions): Promise<RunResult> {
    const binaryPath = this.getBinaryPath(options.binary)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found: ${binaryPath}`)
    }

    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''

      const proc = spawn(binaryPath, options.args, {
        env: { ...process.env },
        cwd: path.dirname(binaryPath), // ensures CUDA/Vulkan DLLs next to the binary are found
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      this.activeProcess = proc

      proc.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        stdout += text
        if (options.onStdout) {
          text.split('\n').filter(Boolean).forEach(options.onStdout)
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        stderr += text
        if (options.onStderr) {
          text.split('\n').filter(Boolean).forEach(options.onStderr)
        }
      })

      let timer: NodeJS.Timeout | undefined
      if (options.timeoutMs) {
        timer = setTimeout(() => {
          proc.kill('SIGTERM')
          reject(new Error(`Process timed out after ${options.timeoutMs}ms`))
        }, options.timeoutMs)
      }

      proc.on('close', (code) => {
        if (timer) clearTimeout(timer)
        this.activeProcess = null
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr,
        })
      })

      proc.on('error', (err) => {
        if (timer) clearTimeout(timer)
        this.activeProcess = null
        reject(err)
      })
    })
  }

  cancel() {
    if (this.activeProcess) {
      this.activeProcess.kill('SIGTERM')
      this.activeProcess = null
    }
  }
}
