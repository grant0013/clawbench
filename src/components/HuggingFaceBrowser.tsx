import { useState, useEffect } from 'react'
import type { HFModel, HFModelFile, DownloadProgress } from '../lib/types'
import { api } from '../lib/ipc'
import { LockedOverlay } from './HardwarePanel'

interface Props {
  isPremium: boolean
  modelsDirectory: string
}

export default function HuggingFaceBrowser({ isPremium, modelsDirectory }: Props) {
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<HFModel[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedModel, setSelectedModel] = useState<HFModel | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [download, setDownload] = useState<DownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = api.onDownloadProgress((p) => setDownload(p))
    return unsub
  }, [])

  // Load popular models on mount
  useEffect(() => {
    if (isPremium) handleSearch('gguf')
  }, [isPremium])

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query
    if (!q.trim()) return
    setSearching(true)
    setSelectedModel(null)
    try {
      const result = await api.searchModels(q)
      setModels(result.models)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectModel = async (model: HFModel) => {
    setLoadingDetails(true)
    try {
      const details = await api.getModelDetails(model.id)
      setSelectedModel(details)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDownload = async (file: HFModelFile) => {
    const destDir = modelsDirectory || (await api.selectDirectory())
    if (!destDir) return
    setDownloadError(null)
    try {
      await api.downloadModel(selectedModel!.id, file.filename, destDir)
    } catch (err: any) {
      setDownloadError(err?.message ?? 'Download failed. Please try again.')
    }
  }

  if (!isPremium) {
    return (
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Model Browser</h2>
        <LockedOverlay feature="HuggingFace Model Browser" />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Model Browser</h2>

      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search HuggingFace for GGUF models (e.g. llama, mistral, phi)..."
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-primary)',
            fontSize: 15,
            outline: 'none',
          }}
        />
        <button onClick={() => handleSearch()} disabled={searching} style={{
          ...btnPrimary,
          opacity: searching ? 0.6 : 1,
        }}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Quick Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['llama', 'mistral', 'phi', 'qwen', 'gemma', 'deepseek'].map((tag) => (
          <button key={tag} onClick={() => { setQuery(tag); handleSearch(tag) }} style={chipStyle}>
            {tag}
          </button>
        ))}
      </div>

      {/* Download Progress */}
      {download && download.status === 'downloading' && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 10,
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              Downloading {download.filename}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {download.downloadedMb} / {download.totalMb} MB ({download.speedMbps} MB/s)
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-primary)', borderRadius: 4 }}>
            <div style={{
              height: '100%',
              width: `${download.percent}%`,
              background: 'var(--accent)',
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{download.percent.toFixed(1)}%</span>
            <button onClick={() => api.cancelDownload()} style={{
              padding: '4px 12px',
              background: 'transparent',
              border: '1px solid var(--danger)',
              borderRadius: 4,
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: 12,
            }}>Cancel</button>
          </div>
        </div>
      )}

      {download?.status === 'complete' && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 10,
          marginBottom: 20,
          color: 'var(--success)',
          fontSize: 14,
        }}>
          Download complete: {download.filename}
        </div>
      )}

      {downloadError && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 10,
          marginBottom: 20,
          color: 'var(--danger)',
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>Download failed: {downloadError}</span>
          <button onClick={() => setDownloadError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Model List */}
        <div style={{ flex: 1 }}>
          {models.length === 0 && !searching ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Search for models to get started
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model)}
                  style={{
                    padding: '14px 18px',
                    background: selectedModel?.id === model.id ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                    border: selectedModel?.id === model.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{model.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    by {model.author}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span>Downloads: {formatNumber(model.downloads)}</span>
                    <span>Likes: {formatNumber(model.likes)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Model Details / File List */}
        {selectedModel && (
          <div style={{ width: 380 }}>
            <div style={{
              padding: '18px 20px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              position: 'sticky',
              top: 0,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{selectedModel.name}</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                by {selectedModel.author} | {selectedModel.description}
              </div>

              {loadingDetails ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading files...</div>
              ) : selectedModel.files.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No GGUF files found</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Available Downloads ({selectedModel.files.length} files)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflow: 'auto' }}>
                    {selectedModel.files.map((file) => (
                      <div key={file.filename} style={{
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{file.quantType}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {file.sizeMb >= 1024 ? `${(file.sizeMb / 1024).toFixed(1)} GB` : `${file.sizeMb.toFixed(0)} MB`}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(file)}
                          disabled={download?.status === 'downloading'}
                          style={{
                            padding: '6px 14px',
                            background: 'var(--accent)',
                            border: 'none',
                            borderRadius: 6,
                            color: 'white',
                            cursor: download?.status === 'downloading' ? 'not-allowed' : 'pointer',
                            fontSize: 12,
                            fontWeight: 600,
                            opacity: download?.status === 'downloading' ? 0.5 : 1,
                          }}
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

const btnPrimary: React.CSSProperties = {
  padding: '12px 24px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 8,
  color: 'white',
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 600,
}

const chipStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 13,
}
