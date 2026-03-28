import { useEffect } from 'react'
import type { BenchmarkResult } from '../lib/types'
import { api } from '../lib/ipc'

interface Props {
  results: BenchmarkResult[]
  setResults: (r: BenchmarkResult[]) => void
}

export default function HistoryPanel({ results, setResults }: Props) {
  useEffect(() => {
    api.getHistory().then(setResults)
  }, [setResults])

  const handleDelete = async (id: string) => {
    await api.deleteHistoryItem(id)
    setResults(results.filter((r) => r.id !== id))
  }

  const handleExport = async (format: 'json' | 'csv') => {
    await api.exportResults(results, format)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>History</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handleExport('json')} style={exportBtn}>Export JSON</button>
          <button onClick={() => handleExport('csv')} style={exportBtn}>Export CSV</button>
        </div>
      </div>

      {results.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 300,
          color: 'var(--text-muted)',
          fontSize: 16,
        }}>
          No benchmark history yet.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Model', 'Benchmark', 'Key Result', ''].map((h) => (
                <th key={h} style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderBottom: '2px solid var(--border)',
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
            {results.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={cellStyle}>{new Date(r.timestamp).toLocaleDateString()}</td>
                <td style={cellStyle}>{r.modelName}</td>
                <td style={cellStyle}>{formatType(r.type)}</td>
                <td style={cellStyle}>{getSummary(r)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{
                      padding: '4px 10px',
                      background: 'transparent',
                      border: '1px solid var(--danger)',
                      borderRadius: 4,
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function getSummary(r: BenchmarkResult): string {
  const d = r.data as any
  switch (r.type) {
    case 'token-speed': return `${d.genTokensPerSec?.toFixed(1)} t/s`
    case 'memory-usage': return `${d.peakRamMb?.toFixed(0)} MB RAM`
    case 'perplexity': return `PPL: ${d.perplexity?.toFixed(2)}`
    case 'context-scaling': return `${d.points?.length} data points`
    case 'batch-size': return `${d.points?.length} batch sizes`
    case 'quant-compare': return `${d.variants?.length} variants`
    default: return ''
  }
}

function formatType(type: string): string {
  return type.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join(' ')
}

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
}

const exportBtn: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--bg-hover)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: 13,
}
