import { useState, useEffect } from 'react'
import { api } from '../lib/ipc'

interface InstallProgress {
  stage: string
  message: string
  percent: number
  backend?: string
}

interface Props {
  onComplete: (llamaCppPath: string) => void
}

const BACKEND_LABELS: Record<string, string> = {
  cuda: 'NVIDIA CUDA',
  vulkan: 'Vulkan (AMD / Intel)',
  avx2: 'CPU (AVX2)',
  cpu: 'CPU',
  metal: 'Apple Metal',
}

export default function SetupWizard({ onComplete }: Props) {
  const [status, setStatus] = useState<'idle' | 'installing' | 'error' | 'done'>('idle')
  const [progress, setProgress] = useState<InstallProgress>({ stage: 'idle', message: '', percent: 0 })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const unsub = api.onInstallProgress((p) => setProgress(p))
    return unsub
  }, [])

  async function startInstall() {
    setStatus('installing')
    setErrorMsg('')
    try {
      const binDir = await api.installLlamaCppPrebuilt(true)
      setStatus('done')
      setProgress({ stage: 'complete', message: 'Ready!', percent: 100 })
      setTimeout(() => onComplete(binDir), 800)
    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err?.message || 'Installation failed')
    }
  }

  const backendLabel = progress.backend ? BACKEND_LABELS[progress.backend] ?? progress.backend : ''

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0f172a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 480, padding: '40px 48px',
        background: '#1e293b',
        borderRadius: 16,
        border: '1px solid #334155',
        textAlign: 'center',
      }}>
        {/* Logo / title */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 40 }}>⚡</span>
        </div>
        <h1 style={{ color: '#f1f5f9', fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
          Welcome to LLM Bench
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 32px', lineHeight: 1.6 }}>
          To get started, LLM Bench needs to install{' '}
          <strong style={{ color: '#e2e8f0' }}>llama.cpp</strong> — the engine that runs your models.
          This is a one-time setup and takes about a minute.
        </p>

        {/* Idle state */}
        {status === 'idle' && (
          <button
            onClick={startInstall}
            style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Install llama.cpp Automatically
          </button>
        )}

        {/* Installing state */}
        {status === 'installing' && (
          <>
            {backendLabel && (
              <div style={{
                display: 'inline-block', marginBottom: 20,
                padding: '4px 12px',
                background: '#0f172a', borderRadius: 20,
                color: '#818cf8', fontSize: 13, fontWeight: 500,
              }}>
                {backendLabel}
              </div>
            )}

            {/* Progress bar */}
            <div style={{
              width: '100%', height: 8,
              background: '#0f172a', borderRadius: 4,
              overflow: 'hidden', marginBottom: 16,
            }}>
              <div style={{
                height: '100%',
                width: `${progress.percent}%`,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>

            <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
              {progress.message || 'Starting...'}
            </p>
          </>
        )}

        {/* Done state */}
        {status === 'done' && (
          <div style={{ color: '#4ade80', fontSize: 15, fontWeight: 600 }}>
            ✓ {progress.message}
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <>
            <div style={{
              padding: '12px 16px', marginBottom: 20,
              background: '#450a0a', borderRadius: 8,
              border: '1px solid #991b1b',
              color: '#fca5a5', fontSize: 13, textAlign: 'left',
            }}>
              {errorMsg}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={startInstall}
                style={{
                  flex: 1, padding: '12px 0',
                  background: '#6366f1', color: '#fff',
                  border: 'none', borderRadius: 8,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => onComplete('')}
                style={{
                  flex: 1, padding: '12px 0',
                  background: 'transparent', color: '#64748b',
                  border: '1px solid #334155', borderRadius: 8,
                  fontSize: 14, cursor: 'pointer',
                }}
              >
                Skip (set path manually)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
