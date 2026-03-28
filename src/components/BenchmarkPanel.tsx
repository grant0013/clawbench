import { useState } from 'react'
import type { AppSettings, BenchmarkConfig, BenchmarkProgress, BenchmarkType, HardwareInfo, OptimizedSettings } from '../lib/types'
import { api } from '../lib/ipc'

interface Props {
  settings: AppSettings
  progress: BenchmarkProgress
  onRun: (config: BenchmarkConfig) => Promise<any>
  onCancel: () => void
  isPremium: boolean
  hardware: HardwareInfo | null
}

const benchmarkOptions: { type: BenchmarkType; label: string; description: string; premium?: boolean }[] = [
  { type: 'token-speed', label: 'Token Speed', description: 'Measure tokens/sec for prompt processing and generation' },
  { type: 'memory-usage', label: 'Memory Usage', description: 'Track peak RAM and VRAM consumption' },
  { type: 'perplexity', label: 'Perplexity', description: 'Evaluate model quality with perplexity scoring', premium: true },
  { type: 'context-scaling', label: 'Context Scaling', description: 'Test performance at different context lengths', premium: true },
  { type: 'batch-size', label: 'Batch Size', description: 'Compare different batch size configurations', premium: true },
  { type: 'quant-compare', label: 'Quantization Compare', description: 'Compare multiple quantization variants', premium: true },
]

export default function BenchmarkPanel({ settings, progress, onRun, onCancel, isPremium, hardware }: Props) {
  const [modelPath, setModelPath] = useState('')
  const [selected, setSelected] = useState<Set<BenchmarkType>>(new Set(['token-speed']))
  const [gpuLayers, setGpuLayers] = useState(settings.defaultGpuLayers)
  const [threads, setThreads] = useState(settings.defaultThreads)
  const [repetitions, setRepetitions] = useState(1)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizeMsg, setOptimizeMsg] = useState<string[]>([])

  const toggle = (t: BenchmarkType) => {
    const opt = benchmarkOptions.find((o) => o.type === t)
    if (opt?.premium && !isPremium) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const browseModel = async () => {
    const path = await api.selectFile([{ name: 'GGUF Models', extensions: ['gguf'] }])
    if (path) setModelPath(path)
  }

  const handleAutoOptimize = async () => {
    if (!modelPath) return
    setOptimizing(true)
    setOptimizeMsg([])
    try {
      const hw = hardware || await api.detectHardware()
      const opt = await api.optimizeSettings(modelPath, hw)
      setGpuLayers(opt.nGpuLayers)
      setThreads(opt.threads)
      setOptimizeMsg(opt.explanation)
    } finally {
      setOptimizing(false)
    }
  }

  const handleSelectAll = () => {
    const all = benchmarkOptions
      .filter((o) => !o.premium || isPremium)
      .map((o) => o.type)
    setSelected(new Set(all))
  }

  const handleRun = () => {
    if (!modelPath || selected.size === 0) return
    onRun({
      modelPath,
      benchmarks: Array.from(selected),
      nGpuLayers: gpuLayers,
      contextSizes: [512, 1024, 2048, 4096, 8192],
      batchSizes: [128, 256, 512, 1024],
      threads,
      repetitions,
    })
  }

  const noLlamaCpp = !settings.llamaCppPath

  return (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Run Benchmark</h2>

      {noLlamaCpp && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 14,
          color: 'var(--danger)',
        }}>
          No llama.cpp path configured. Go to Settings to set it up.
        </div>
      )}

      {/* Model Selection */}
      <section style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
          Model File (.gguf)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={modelPath}
            onChange={(e) => setModelPath(e.target.value)}
            placeholder="Select a GGUF model file..."
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button onClick={browseModel} style={btnStyle}>Browse</button>
          {isPremium && (
            <button
              onClick={handleAutoOptimize}
              disabled={!modelPath || optimizing}
              style={{
                ...btnStyle,
                background: modelPath ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-hover)',
                border: modelPath ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid var(--border)',
                color: modelPath ? 'var(--success)' : 'var(--text-muted)',
                cursor: !modelPath || optimizing ? 'not-allowed' : 'pointer',
              }}
            >
              {optimizing ? 'Optimizing...' : 'Auto-Optimize'}
            </button>
          )}
        </div>
      </section>

      {/* Auto-Optimize Results */}
      {optimizeMsg.length > 0 && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 6 }}>
            Settings optimized for your hardware:
          </div>
          {optimizeMsg.map((msg, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Benchmark Selection */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Benchmarks to Run
          </label>
          <button onClick={handleSelectAll} style={{
            padding: '4px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 12,
          }}>
            Select All
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {benchmarkOptions.map(({ type, label, description, premium }) => {
            const locked = premium && !isPremium
            return (
              <button
                key={type}
                onClick={() => toggle(type)}
                style={{
                  padding: '12px 14px',
                  background: locked ? 'var(--bg-primary)' :
                    selected.has(type) ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                  border: selected.has(type) && !locked ? '1px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
                  opacity: locked ? 0.6 : 1,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
                  {locked && (
                    <span style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--accent)',
                      borderRadius: 8,
                      fontWeight: 600,
                    }}>PRO</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{description}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Parameters */}
      <section style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>GPU Layers</label>
          <input
            type="number"
            value={gpuLayers}
            onChange={(e) => setGpuLayers(Number(e.target.value))}
            min={0}
            max={999}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Threads</label>
          <input
            type="number"
            value={threads}
            onChange={(e) => setThreads(Number(e.target.value))}
            min={1}
            max={64}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Repetitions</label>
          <input
            type="number"
            value={repetitions}
            onChange={(e) => setRepetitions(Number(e.target.value))}
            min={1}
            max={10}
            style={inputStyle}
          />
        </div>
      </section>

      {/* Progress */}
      {progress.running && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{progress.message}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{Math.round(progress.percent)}%</span>
          </div>
          <div style={{
            height: 8,
            background: 'var(--bg-primary)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progress.percent}%`,
              background: 'var(--accent)',
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </section>
      )}

      {/* Run / Cancel */}
      <div style={{ display: 'flex', gap: 12 }}>
        {!progress.running ? (
          <button
            onClick={handleRun}
            disabled={!modelPath || selected.size === 0 || noLlamaCpp}
            style={{
              ...btnStyle,
              background: (!modelPath || selected.size === 0 || noLlamaCpp) ? 'var(--bg-hover)' : 'var(--accent)',
              color: 'white',
              padding: '12px 32px',
              fontSize: 16,
              fontWeight: 600,
              cursor: (!modelPath || selected.size === 0 || noLlamaCpp) ? 'not-allowed' : 'pointer',
            }}
          >
            Run Benchmark
          </button>
        ) : (
          <button
            onClick={onCancel}
            style={{
              ...btnStyle,
              background: 'var(--danger)',
              color: 'white',
              padding: '12px 32px',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '10px 18px',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 14,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  display: 'block',
  marginBottom: 6,
  color: 'var(--text-secondary)',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
}
