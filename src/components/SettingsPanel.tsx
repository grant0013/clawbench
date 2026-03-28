import { useState } from 'react'
import type { AppSettings, LicenseInfo } from '../lib/types'
import { api } from '../lib/ipc'
import LicensePanel from './LicensePanel'
import BuildPanel from './BuildPanel'

interface Props {
  settings: AppSettings
  onUpdate: (updates: Partial<AppSettings>) => Promise<void>
  onDetect: () => Promise<string | null>
  onReinstall: () => void
  license: LicenseInfo
  onLicenseChange: (license: LicenseInfo) => void
  isPremium: boolean
  recommendedBackend: string
}

export default function SettingsPanel({ settings, onUpdate, onDetect, onReinstall, license, onLicenseChange, isPremium, recommendedBackend }: Props) {
  const [detecting, setDetecting] = useState(false)
  const [detectMsg, setDetectMsg] = useState('')

  const handleDetect = async () => {
    setDetecting(true)
    setDetectMsg('')
    const path = await onDetect()
    if (path) {
      setDetectMsg(`Found: ${path}`)
    } else {
      setDetectMsg('Not found. Please set the path manually.')
    }
    setDetecting(false)
  }

  const browseLlamaCpp = async () => {
    const path = await api.selectDirectory()
    if (path) onUpdate({ llamaCppPath: path })
  }

  const browseModels = async () => {
    const dir = await api.selectDirectory()
    if (dir) onUpdate({ modelsDirectory: dir })
  }

  const handleBuildComplete = (binPath: string) => {
    onUpdate({ llamaCppPath: binPath })
  }

  return (
    <div style={{ maxWidth: 650 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Settings</h2>

      {/* License Section */}
      <LicensePanel license={license} onLicenseChange={onLicenseChange} />

      {/* Auto Build llama.cpp (Premium) */}
      <BuildPanel
        isPremium={isPremium}
        recommendedBackend={recommendedBackend}
        onBuildComplete={handleBuildComplete}
      />

      {/* llama.cpp Path */}
      <section style={{ marginBottom: 28 }}>
        <label style={labelStyle}>llama.cpp Path</label>
        <p style={descStyle}>Path to your llama.cpp build directory (containing llama-bench, llama-cli, etc.)</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={settings.llamaCppPath}
            onChange={(e) => onUpdate({ llamaCppPath: e.target.value })}
            placeholder="/path/to/llama.cpp/build/bin"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={browseLlamaCpp} style={btnStyle}>Browse</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleDetect} disabled={detecting} style={btnStyle}>
            {detecting ? 'Detecting...' : 'Auto-Detect'}
          </button>
          <button
            onClick={onReinstall}
            style={{ ...btnStyle, background: '#7c3aed', color: '#fff', border: 'none' }}
          >
            Reinstall llama.cpp
          </button>
          {detectMsg && <span style={{ fontSize: 13, color: detectMsg.startsWith('Found') ? 'var(--success)' : 'var(--warning)' }}>{detectMsg}</span>}
        </div>
      </section>

      {/* Models Directory */}
      <section style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Default Models Directory</label>
        <p style={descStyle}>Default folder to browse for GGUF model files</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={settings.modelsDirectory}
            onChange={(e) => onUpdate({ modelsDirectory: e.target.value })}
            placeholder="~/models"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={browseModels} style={btnStyle}>Browse</button>
        </div>
      </section>

      {/* GPU Layers */}
      <section style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Default GPU Layers</label>
        <p style={descStyle}>Number of layers to offload to GPU (99 = all layers)</p>
        <input
          type="number"
          value={settings.defaultGpuLayers}
          onChange={(e) => onUpdate({ defaultGpuLayers: Number(e.target.value) })}
          min={0}
          max={999}
          style={{ ...inputStyle, width: 120 }}
        />
      </section>

      {/* Threads */}
      <section style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Default Threads</label>
        <p style={descStyle}>Number of CPU threads to use for inference</p>
        <input
          type="number"
          value={settings.defaultThreads}
          onChange={(e) => onUpdate({ defaultThreads: Number(e.target.value) })}
          min={1}
          max={64}
          style={{ ...inputStyle, width: 120 }}
        />
      </section>

      {/* Version Info */}
      <section style={{
        padding: '16px 20px',
        background: 'var(--bg-primary)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>LLM Bench v2.0.0</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Automatic LLM Benchmarking Tool for llama.cpp
          {isPremium && <span style={{ color: 'var(--success)', marginLeft: 8 }}>Premium</span>}
        </div>
      </section>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  display: 'block',
  marginBottom: 4,
  color: 'var(--text-primary)',
}

const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  marginBottom: 10,
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
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
