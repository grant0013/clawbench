import { useState, useCallback, useEffect } from 'react'
import type { BenchmarkConfig, BenchmarkResult, BenchmarkProgress } from '../lib/types'
import { api } from '../lib/ipc'

export function useBenchmark() {
  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [progress, setProgress] = useState<BenchmarkProgress>({
    running: false,
    currentBenchmark: null,
    currentStep: 0,
    totalSteps: 0,
    message: 'Ready',
    percent: 0,
  })

  useEffect(() => {
    const unsub = api.onBenchmarkProgress((p) => setProgress(p))
    return unsub
  }, [])

  const run = useCallback(async (config: BenchmarkConfig) => {
    setResults([])
    setProgress({
      running: true,
      currentBenchmark: null,
      currentStep: 0,
      totalSteps: config.benchmarks.length,
      message: 'Starting benchmarks...',
      percent: 0,
    })
    try {
      const res = await api.runBenchmark(config)
      setResults(res)
      return res
    } finally {
      setProgress((p) => ({ ...p, running: false, message: 'Complete', percent: 100 }))
    }
  }, [])

  const cancel = useCallback(async () => {
    await api.cancelBenchmark()
    setProgress((p) => ({ ...p, running: false, message: 'Cancelled' }))
  }, [])

  return { results, progress, run, cancel }
}
