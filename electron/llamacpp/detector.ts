import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const BINARY_NAMES = ['llama-bench', 'llama-cli', 'llama-perplexity']

export async function detectLlamaCpp(): Promise<string | null> {
  // Try common installation paths
  const candidates = getCandidatePaths()

  for (const dir of candidates) {
    if (hasLlamaCppBinaries(dir)) {
      return dir
    }
  }

  // Try finding via PATH
  const pathResult = findInPath()
  if (pathResult) return pathResult

  return null
}

function getCandidatePaths(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const paths: string[] = []

  if (process.platform === 'win32') {
    paths.push(
      path.join(home, 'llama.cpp', 'build', 'bin', 'Release'),
      path.join(home, 'llama.cpp', 'build', 'bin'),
      'C:\\llama.cpp\\build\\bin\\Release',
      'C:\\llama.cpp\\build\\bin',
      path.join(home, 'Desktop', 'llama.cpp', 'build', 'bin', 'Release'),
      path.join(home, 'Documents', 'llama.cpp', 'build', 'bin', 'Release'),
    )
  } else if (process.platform === 'darwin') {
    paths.push(
      path.join(home, 'llama.cpp', 'build', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
      path.join(home, '.local', 'bin'),
    )
  } else {
    paths.push(
      path.join(home, 'llama.cpp', 'build', 'bin'),
      '/usr/local/bin',
      '/usr/bin',
      path.join(home, '.local', 'bin'),
    )
  }

  return paths
}

function hasLlamaCppBinaries(dir: string): boolean {
  if (!fs.existsSync(dir)) return false
  const ext = process.platform === 'win32' ? '.exe' : ''

  return BINARY_NAMES.some((name) => {
    const fullPath = path.join(dir, name + ext)
    return fs.existsSync(fullPath)
  })
}

function findInPath(): string | null {
  const binaryName = process.platform === 'win32' ? 'llama-bench.exe' : 'llama-bench'
  try {
    const cmd = process.platform === 'win32' ? `where ${binaryName}` : `which ${binaryName}`
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
    if (result) {
      return path.dirname(result.split('\n')[0])
    }
  } catch {
    // Not found in PATH
  }
  return null
}
