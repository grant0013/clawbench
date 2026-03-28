import { useState, useEffect, useRef } from 'react'
import type { BuildPrerequisites, BuildProgress } from '../lib/types'
import { api } from '../lib/ipc'

interface Props {
  isPremium: boolean
  recommendedBackend: string
  onBuildComplete: (binPath: string) => void
}

export default function BuildPanel({ isPremium, recommendedBackend, onBuildComplete }: Props) {
  const [prereqs, setPrereqs] = useState<BuildPrerequisites | null>(null)
  const [checking, setChecking] = useState(false)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState<BuildProgress | null>(null)
  const [backend, setBackend] = useState(recommendedBackend || 'cpu')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setBackend(recommendedBackend || 'cpu')
  }, [recommendedBackend])

  useEffect(() => {
    const unsub = api.onBuildProgress((p) => {
      setProgress(p)
      if (p.stage === 'complete' || p.stage === 'error') {
        setBuilding(false)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [progress?.log])

  const checkPrereqs = async () => {
    setChecking(true)
    try {
      const result = await api.checkBuildPrerequisites()
      setPrereqs(result)
    } finally {
      setChecking(false)
    }
  }

  const startBuild = async () => {
    setBuilding(true)
    setProgress(null)
    try {
      const binPath = await api.buildLlamaCpp(backend)
      onBuildComplete(binPath)
    } catch (err: any) {
      // Error handled via progress callback
    }
  }

  if (!isPremium) return null

  const canBuild = prereqs?.git && prereqs?.cmake && prereqs?.compiler

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 28,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        Download & Build llama.cpp
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Automatically download and compile llama.cpp optimized for your hardware.
      </p>

      {/* Step 1: Check Prerequisites */}
      {!prereqs && !building && (
        <button onClick={checkPrereqs} disabled={checking} style={btnStyle}>
          {checking ? 'Checking...' : '1. Check Prerequisites'}
        </button>
      )}

      {/* Prerequisites Results */}
      {prereqs && !building && !progress && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {prereqs.details.map((d, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--text-secondary)',
              }}>
                <span style={{ color: d.includes('NOT FOUND') ? 'var(--danger)' : 'var(--success)' }}>
                  {d.includes('NOT FOUND') ? '✗' : '✓'}
                </span>
                {d}
              </div>
            ))}
          </div>

          {canBuild ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <select
                value={backend}
                onChange={(e) => setBackend(e.target.value)}
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-primary)',
                  fontSize: 14,
                }}
              >
                <option value="cpu">CPU Only</option>
                {prereqs.cuda && <option value="cuda">CUDA (NVIDIA)</option>}
                {prereqs.metal && <option value="metal">Metal (Apple)</option>}
                {prereqs.vulkan && <option value="vulkan">Vulkan (AMD/Intel)</option>}
              </select>
              <button onClick={startBuild} style={{
                ...btnStyle,
                background: 'var(--accent)',
                color: 'white',
                fontWeight: 600,
              }}>
                2. Download & Build
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--danger)' }}>
              Missing prerequisites. Install the required tools above before building.
            </div>
          )}
        </div>
      )}

      {/* Build Progress */}
      {(building || progress) && (
        <div>
          {/* Progress Bar */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {progress?.message || 'Starting build...'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {Math.round(progress?.percent || 0)}%
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--bg-primary)', borderRadius: 4 }}>
              <div style={{
                height: '100%',
                width: `${progress?.percent || 0}%`,
                background: progress?.stage === 'error' ? 'var(--danger)' :
                  progress?.stage === 'complete' ? 'var(--success)' : 'var(--accent)',
                borderRadius: 4,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* Build Log */}
          <div
            ref={logRef}
            style={{
              maxHeight: 200,
              overflow: 'auto',
              background: '#000',
              borderRadius: 6,
              padding: '10px 14px',
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.6,
              color: '#a0a0a0',
            }}
          >
            {progress?.log.slice(-50).map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

          {building && (
            <button onClick={() => api.cancelBuild()} style={{
              ...btnStyle,
              marginTop: 12,
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              background: 'transparent',
            }}>
              Cancel Build
            </button>
          )}

          {progress?.stage === 'complete' && (
            <div style={{
              marginTop: 12,
              padding: '10px 16px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--success)',
            }}>
              Build complete! llama.cpp path has been automatically configured.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 14,
}
