import { useState } from 'react'
import type { BenchmarkResult, TokenSpeedResult, MemoryResult, PerplexityResult, ScalingResult, BatchResult, QuantResult } from '../lib/types'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { api } from '../lib/ipc'

interface Props {
  results: BenchmarkResult[]
}

function SetupScriptBanner({ results }: { results: BenchmarkResult[] }) {
  const [saving, setSaving] = useState(false)
  const [savedPath, setSavedPath] = useState('')

  const tokenResult = results.find((r) => r.type === 'token-speed')
  if (!tokenResult) return null

  const tps = tokenResult.data as TokenSpeedResult
  const modelPath = tokenResult.modelPath || ''
  const nGpuLayers = tokenResult.nGpuLayers ?? 99
  const threads = tokenResult.threads ?? 4

  const handleGenerate = async () => {
    setSaving(true)
    try {
      const p = await api.generateSetupScript(modelPath, nGpuLayers, threads, tps.genTokensPerSec, tps.promptTokensPerSec)
      setSavedPath(p)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      border: '1px solid #4f46e5',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e7ff', marginBottom: 4 }}>
          Ready to run your model?
        </div>
        <div style={{ fontSize: 13, color: '#a5b4fc' }}>
          Generate a one-click launcher script with your optimised settings — just double-click it to start chatting.
        </div>
        {savedPath && (
          <div style={{ fontSize: 12, color: '#4ade80', marginTop: 6 }}>
            ✓ Saved to your Desktop — your Desktop folder has been opened
          </div>
        )}
      </div>
      <button
        onClick={handleGenerate}
        disabled={saving || !!savedPath}
        style={{
          flexShrink: 0,
          padding: '10px 20px',
          background: savedPath ? '#166534' : '#4f46e5',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: saving || savedPath ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {saving ? 'Saving...' : savedPath ? '✓ Script Saved' : 'Generate Launcher Script'}
      </button>
    </div>
  )
}

export default function ResultsPanel({ results }: Props) {
  if (results.length === 0) {
    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Results</h2>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 300,
          color: 'var(--text-muted)',
          fontSize: 16,
        }}>
          Run a benchmark to see results here.
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Results</h2>

      <SetupScriptBanner results={results} />

      {results.map((r) => (
        <div key={r.id} style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 20,
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>{formatType(r.type)}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{r.modelName}</p>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {new Date(r.timestamp).toLocaleString()}
            </span>
          </div>

          {r.type === 'token-speed' && <TokenSpeedCard data={r.data as TokenSpeedResult} />}
          {r.type === 'memory-usage' && <MemoryCard data={r.data as MemoryResult} />}
          {r.type === 'perplexity' && <PerplexityCard data={r.data as PerplexityResult} />}
          {r.type === 'context-scaling' && <ScalingChart data={r.data as ScalingResult} />}
          {r.type === 'batch-size' && <BatchChart data={r.data as BatchResult} />}
          {r.type === 'quant-compare' && <QuantTable data={r.data as QuantResult} />}
        </div>
      ))}
    </div>
  )
}

function TokenSpeedCard({ data }: { data: TokenSpeedResult }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <MetricBox label="Prompt Processing" value={`${data.promptTokensPerSec.toFixed(1)} t/s`} />
      <MetricBox label="Text Generation" value={`${data.genTokensPerSec.toFixed(1)} t/s`} />
      <MetricBox label="Total Tokens" value={data.totalTokens.toString()} />
      <MetricBox label="Total Time" value={`${((data.promptMs + data.genMs) / 1000).toFixed(1)}s`} />
    </div>
  )
}

function MemoryCard({ data }: { data: MemoryResult }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <MetricBox label="Peak RAM" value={`${data.peakRamMb.toFixed(0)} MB`} />
      <MetricBox label="Peak VRAM" value={data.peakVramMb ? `${data.peakVramMb.toFixed(0)} MB` : 'N/A'} />
      <MetricBox label="Model Size" value={`${data.modelSizeMb.toFixed(0)} MB`} />
    </div>
  )
}

function PerplexityCard({ data }: { data: PerplexityResult }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <MetricBox label="Perplexity" value={data.perplexity.toFixed(2)} />
      <MetricBox label="Tokens Evaluated" value={data.tokens.toString()} />
      <MetricBox label="Time" value={`${data.seconds.toFixed(1)}s`} />
    </div>
  )
}

function ScalingChart({ data }: { data: ScalingResult }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data.points}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="contextSize" stroke="var(--text-muted)" fontSize={12} />
        <YAxis stroke="var(--text-muted)" fontSize={12} />
        <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }} />
        <Line type="monotone" dataKey="tokensPerSec" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} name="Tokens/sec" />
      </LineChart>
    </ResponsiveContainer>
  )
}

function BatchChart({ data }: { data: BatchResult }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data.points}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="batchSize" stroke="var(--text-muted)" fontSize={12} />
        <YAxis stroke="var(--text-muted)" fontSize={12} />
        <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }} />
        <Bar dataKey="tokensPerSec" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Tokens/sec" />
      </BarChart>
    </ResponsiveContainer>
  )
}

function QuantTable({ data }: { data: QuantResult }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {['Quantization', 'File Size', 'Tokens/sec', 'Perplexity'].map((h) => (
            <th key={h} style={{
              textAlign: 'left',
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.variants.map((v) => (
          <tr key={v.quantName}>
            <td style={cellStyle}>{v.quantName}</td>
            <td style={cellStyle}>{v.fileSizeMb.toFixed(0)} MB</td>
            <td style={cellStyle}>{v.tokensPerSec.toFixed(1)} t/s</td>
            <td style={cellStyle}>{v.perplexity?.toFixed(2) ?? 'N/A'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '12px 16px',
      background: 'var(--bg-primary)',
      borderRadius: 8,
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
    </div>
  )
}

function formatType(type: string): string {
  return type.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

const cellStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  fontSize: 14,
}
