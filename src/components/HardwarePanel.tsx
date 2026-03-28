import { useState, useEffect } from 'react'
import type { HardwareInfo, OptimizedSettings } from '../lib/types'
import { api } from '../lib/ipc'

interface Props {
  isPremium: boolean
}

export default function HardwarePanel({ isPremium }: Props) {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [optimized, setOptimized] = useState<OptimizedSettings | null>(null)

  const detect = async () => {
    setLoading(true)
    try {
      const hw = await api.detectHardware()
      setHardware(hw)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isPremium) detect()
  }, [isPremium])

  if (!isPremium) {
    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Hardware Detection</h2>
        <LockedOverlay feature="Hardware Detection" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Hardware Detection</h2>
        <button onClick={detect} disabled={loading} style={btnStyle}>
          {loading ? 'Scanning...' : 'Rescan Hardware'}
        </button>
      </div>

      {!hardware ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          {loading ? 'Scanning your hardware...' : 'Click "Rescan Hardware" to detect your system.'}
        </div>
      ) : (
        <>
          {/* GPU Section */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={sectionTitle}>GPU{hardware.gpus.length > 1 ? 's' : ''}</h3>
            {hardware.gpus.length === 0 ? (
              <div style={cardStyle}>
                <span style={{ color: 'var(--warning)' }}>No GPU detected - CPU-only mode</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: hardware.gpus.length > 1 ? '1fr 1fr' : '1fr', gap: 12 }}>
                {hardware.gpus.map((gpu, i) => (
                  <div key={i} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{gpu.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                          {gpu.type.toUpperCase()} | Driver: {gpu.driver}
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        background: gpu.type === 'nvidia' ? 'rgba(34, 197, 94, 0.15)' :
                          gpu.type === 'apple' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: gpu.type === 'nvidia' ? 'var(--success)' :
                          gpu.type === 'apple' ? 'var(--accent)' : 'var(--warning)',
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {gpu.type === 'nvidia' ? 'CUDA' : gpu.type === 'apple' ? 'Metal' : gpu.type === 'amd' ? 'Vulkan' : 'CPU'}
                      </span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>VRAM</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {gpu.vramMb >= 1024 ? `${(gpu.vramMb / 1024).toFixed(1)} GB` : `${gpu.vramMb} MB`}
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3 }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, (gpu.vramMb / 24576) * 100)}%`,
                          background: 'var(--accent)',
                          borderRadius: 3,
                        }} />
                      </div>
                    </div>
                    {gpu.cudaVersion && (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        CUDA {gpu.cudaVersion}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* CPU & RAM */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>CPU</h3>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{hardware.cpu.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {hardware.cpu.cores} cores / {hardware.cpu.threads} threads | {hardware.cpu.architecture}
              </div>
            </div>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Memory</h3>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {(hardware.ram.totalMb / 1024).toFixed(0)} GB Total
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {(hardware.ram.availableMb / 1024).toFixed(1)} GB Available
              </div>
              <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3, marginTop: 8 }}>
                <div style={{
                  height: '100%',
                  width: `${((hardware.ram.totalMb - hardware.ram.availableMb) / hardware.ram.totalMb) * 100}%`,
                  background: 'var(--warning)',
                  borderRadius: 3,
                }} />
              </div>
            </div>
          </div>

          {/* Recommended Backend */}
          <div style={{
            ...cardStyle,
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
              Recommended Backend: {hardware.recommendedBackend.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {hardware.recommendedBackend === 'cuda' && 'NVIDIA CUDA will provide the best performance for your GPU.'}
              {hardware.recommendedBackend === 'metal' && 'Apple Metal will provide native GPU acceleration on your Mac.'}
              {hardware.recommendedBackend === 'vulkan' && 'Vulkan will provide GPU acceleration for your AMD/Intel GPU.'}
              {hardware.recommendedBackend === 'cpu' && 'No compatible GPU detected. CPU inference will be used.'}
            </div>
          </div>

          {/* Optimization Preview */}
          {optimized && (
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Optimized Settings</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                <MetricBox label="GPU Layers" value={String(optimized.nGpuLayers)} />
                <MetricBox label="Threads" value={String(optimized.threads)} />
                <MetricBox label="Batch Size" value={String(optimized.batchSize)} />
                <MetricBox label="Context" value={String(optimized.contextSize)} />
              </div>
              <ul style={{ marginTop: 12, paddingLeft: 20 }}>
                {optimized.explanation.map((e, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
    </div>
  )
}

export function LockedOverlay({ feature }: { feature: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 300,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      textAlign: 'center',
      padding: 40,
    }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{feature}</h3>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 400 }}>
        This feature requires a Premium license. Go to Settings to enter your license key.
      </p>
    </div>
  )
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 12,
  textTransform: 'uppercase',
  letterSpacing: 1,
}

const cardStyle: React.CSSProperties = {
  padding: '16px 20px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
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
