import path from 'path'
import fs from 'fs'
import { LlamaCppRunner } from '../llamacpp/runner'
import { Database } from '../database'
import crypto from 'crypto'

interface BenchmarkConfig {
  modelPath: string
  benchmarks: string[]
  nGpuLayers: number
  contextSizes: number[]
  batchSizes: number[]
  threads: number
  repetitions: number
}

interface BenchmarkProgress {
  running: boolean
  currentBenchmark: string | null
  currentStep: number
  totalSteps: number
  message: string
  percent: number
}

type ProgressCallback = (progress: BenchmarkProgress) => void

export class BenchmarkSuite {
  private runner: LlamaCppRunner
  private db: Database
  private cancelled = false

  constructor(runner: LlamaCppRunner, db: Database) {
    this.runner = runner
    this.db = db
  }

  cancel() {
    this.cancelled = true
    this.runner.cancel()
  }

  async run(config: BenchmarkConfig, onProgress: ProgressCallback): Promise<any[]> {
    this.cancelled = false
    const results: any[] = []
    const modelName = path.basename(config.modelPath, '.gguf')
    const total = config.benchmarks.length

    for (let i = 0; i < config.benchmarks.length; i++) {
      if (this.cancelled) break
      const bench = config.benchmarks[i]

      onProgress({
        running: true,
        currentBenchmark: bench,
        currentStep: i + 1,
        totalSteps: total,
        message: `Running ${formatType(bench)}...`,
        percent: (i / total) * 100,
      })

      try {
        let data: any
        switch (bench) {
          case 'token-speed':
            data = await this.runTokenSpeed(config)
            break
          case 'memory-usage':
            data = await this.runMemoryUsage(config)
            break
          case 'perplexity':
            data = await this.runPerplexity(config)
            break
          case 'context-scaling':
            data = await this.runContextScaling(config, onProgress, i, total)
            break
          case 'batch-size':
            data = await this.runBatchSize(config, onProgress, i, total)
            break
          case 'quant-compare':
            data = await this.runQuantCompare(config)
            break
          default:
            continue
        }

        const result = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          modelName,
          modelPath: config.modelPath,
          type: bench,
          nGpuLayers: config.nGpuLayers,
          threads: config.threads,
          data,
        }

        results.push(result)
        this.db.saveResult(result)
      } catch (err: any) {
        console.error(`Benchmark ${bench} failed:`, err.message)
      }
    }

    onProgress({
      running: false,
      currentBenchmark: null,
      currentStep: total,
      totalSteps: total,
      message: 'Complete',
      percent: 100,
    })

    return results
  }

  private async runTokenSpeed(config: BenchmarkConfig) {
    // llama-bench outputs structured data with pp and tg metrics
    const result = await this.runner.run({
      binary: 'llama-bench',
      args: [
        '-m', config.modelPath,
        '-ngl', String(config.nGpuLayers),
        '-t', String(config.threads),
        '-r', String(config.repetitions),
        '-o', 'csv',
      ],
      timeoutMs: 600000, // 10 min
    })

    return parseTokenSpeedCsv(result.stdout)
  }

  private async runMemoryUsage(config: BenchmarkConfig) {
    const modelStats = fs.statSync(config.modelPath)
    const modelSizeMb = modelStats.size / (1024 * 1024)

    // Run a quick inference and track the process memory
    const result = await this.runner.run({
      binary: 'llama-cli',
      args: [
        '-m', config.modelPath,
        '-ngl', String(config.nGpuLayers),
        '-t', String(config.threads),
        '-p', 'Hello',
        '-n', '1',
      ],
      timeoutMs: 120000,
    })

    // Parse memory info from stderr (llama.cpp prints memory allocation info)
    const ramMatch = result.stderr.match(/total allocated memory:\s*([\d.]+)\s*MiB/i)
    const vramMatch = result.stderr.match(/VRAM used:\s*([\d.]+)\s*MiB/i) ||
                       result.stderr.match(/offloaded.*?([\d.]+)\s*MiB/i)

    return {
      peakRamMb: ramMatch ? parseFloat(ramMatch[1]) : 0,
      peakVramMb: vramMatch ? parseFloat(vramMatch[1]) : null,
      modelSizeMb,
    }
  }

  private async runPerplexity(config: BenchmarkConfig) {
    const start = Date.now()

    const result = await this.runner.run({
      binary: 'llama-perplexity',
      args: [
        '-m', config.modelPath,
        '-ngl', String(config.nGpuLayers),
        '-t', String(config.threads),
        '--ppl-stride', '0',
      ],
      timeoutMs: 1800000, // 30 min
    })

    const elapsed = (Date.now() - start) / 1000
    const pplMatch = result.stdout.match(/Final estimate:\s*PPL\s*=\s*([\d.]+)/i) ||
                      result.stdout.match(/perplexity\s*=\s*([\d.]+)/i)
    const tokMatch = result.stdout.match(/(\d+)\s*tokens/i)

    return {
      perplexity: pplMatch ? parseFloat(pplMatch[1]) : 0,
      tokens: tokMatch ? parseInt(tokMatch[1]) : 0,
      seconds: elapsed,
    }
  }

  private async runContextScaling(
    config: BenchmarkConfig,
    onProgress: ProgressCallback,
    stepIdx: number,
    totalSteps: number,
  ) {
    const points: { contextSize: number; tokensPerSec: number }[] = []

    for (let i = 0; i < config.contextSizes.length; i++) {
      if (this.cancelled) break
      const ctx = config.contextSizes[i]

      onProgress({
        running: true,
        currentBenchmark: 'context-scaling',
        currentStep: stepIdx + 1,
        totalSteps: totalSteps,
        message: `Context scaling: testing ${ctx} tokens...`,
        percent: ((stepIdx + i / config.contextSizes.length) / totalSteps) * 100,
      })

      const result = await this.runner.run({
        binary: 'llama-bench',
        args: [
          '-m', config.modelPath,
          '-ngl', String(config.nGpuLayers),
          '-t', String(config.threads),
          '-c', String(ctx),
          '-o', 'csv',
        ],
        timeoutMs: 300000,
      })

      const parsed = parseTokenSpeedCsv(result.stdout)
      points.push({
        contextSize: ctx,
        tokensPerSec: parsed.genTokensPerSec || parsed.promptTokensPerSec || 0,
      })
    }

    return { points }
  }

  private async runBatchSize(
    config: BenchmarkConfig,
    onProgress: ProgressCallback,
    stepIdx: number,
    totalSteps: number,
  ) {
    const points: { batchSize: number; tokensPerSec: number }[] = []

    for (let i = 0; i < config.batchSizes.length; i++) {
      if (this.cancelled) break
      const bs = config.batchSizes[i]

      onProgress({
        running: true,
        currentBenchmark: 'batch-size',
        currentStep: stepIdx + 1,
        totalSteps: totalSteps,
        message: `Batch size: testing ${bs}...`,
        percent: ((stepIdx + i / config.batchSizes.length) / totalSteps) * 100,
      })

      const result = await this.runner.run({
        binary: 'llama-bench',
        args: [
          '-m', config.modelPath,
          '-ngl', String(config.nGpuLayers),
          '-t', String(config.threads),
          '-b', String(bs),
          '-o', 'csv',
        ],
        timeoutMs: 300000,
      })

      const parsed = parseTokenSpeedCsv(result.stdout)
      points.push({
        batchSize: bs,
        tokensPerSec: parsed.promptTokensPerSec || 0,
      })
    }

    return { points }
  }

  private async runQuantCompare(config: BenchmarkConfig) {
    // Find sibling quantization files in the same directory
    const dir = path.dirname(config.modelPath)
    const baseName = path.basename(config.modelPath)
    // Extract model base name (remove quant suffix like Q4_K_M)
    const baseMatch = baseName.match(/^(.+?)[-.](?:Q\d|F\d|IQ)/i)
    const prefix = baseMatch ? baseMatch[1] : baseName.replace('.gguf', '')

    const files = fs.readdirSync(dir).filter((f) =>
      f.endsWith('.gguf') && f.startsWith(prefix)
    )

    const variants: any[] = []

    for (const file of files) {
      if (this.cancelled) break
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)
      const quantMatch = file.match(/(Q\d[^.]*|F\d+|IQ\d[^.]*)/i)

      const result = await this.runner.run({
        binary: 'llama-bench',
        args: [
          '-m', filePath,
          '-ngl', String(config.nGpuLayers),
          '-t', String(config.threads),
          '-o', 'csv',
        ],
        timeoutMs: 300000,
      })

      const parsed = parseTokenSpeedCsv(result.stdout)
      variants.push({
        quantName: quantMatch ? quantMatch[1] : file,
        fileSizeMb: stats.size / (1024 * 1024),
        tokensPerSec: parsed.genTokensPerSec || 0,
        perplexity: null, // Would require running perplexity for each - too slow by default
      })
    }

    return { variants }
  }
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

function parseTokenSpeedCsv(stdout: string): {
  promptTokensPerSec: number
  genTokensPerSec: number
  totalTokens: number
  promptMs: number
  genMs: number
} {
  const defaults = { promptTokensPerSec: 0, genTokensPerSec: 0, totalTokens: 0, promptMs: 0, genMs: 0 }

  // Filter to data lines only (skip stderr/info lines)
  const lines = stdout.trim().split('\n').filter((l) => {
    const t = l.trim()
    return t.length > 0 && !t.startsWith('load_backend') && !t.startsWith('llama') &&
           !t.startsWith('ggml') && !t.startsWith('build') && !t.startsWith('#') &&
           !t.startsWith('warning') && !t.startsWith('error')
  })

  if (lines.length === 0) return defaults

  let ppTps = 0
  let tgTps = 0

  for (const line of lines) {
    const parts = parseCSVLine(line)
    if (parts.length < 9) continue

    // llama-bench b8565+ format (all-numeric quoted fields, no header):
    // t/s is at parts[-2], n_prompt at parts[-8], n_gen at parts[-7]
    // Older format with header: detect by checking if line contains 'pp' or 'tg' test label
    const last = parts.length - 1
    const tps = parseFloat(parts[last - 1])
    if (isNaN(tps) || tps <= 0) continue

    // Check for new format (numeric-only, no 'pp512'/'tg128' labels)
    const nPrompt = parseInt(parts[last - 7]) || 0
    const nGen = parseInt(parts[last - 6]) || 0

    if (nPrompt > 0 && nGen === 0) {
      ppTps = tps
    } else if (nGen > 0 && nPrompt === 0) {
      tgTps = tps
    } else {
      // Older format: look for pp/tg label anywhere in the row
      const testField = parts.find((p) => /^pp\d+$/i.test(p))
      const genField = parts.find((p) => /^tg\d+$/i.test(p))
      if (testField) ppTps = tps
      if (genField) tgTps = tps
    }
  }

  return {
    promptTokensPerSec: ppTps,
    genTokensPerSec: tgTps,
    totalTokens: 0,
    promptMs: ppTps > 0 ? (512 / ppTps) * 1000 : 0,
    genMs: tgTps > 0 ? (128 / tgTps) * 1000 : 0,
  }
}

function formatType(type: string): string {
  return type.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}
