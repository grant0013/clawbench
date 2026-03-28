import { useState } from 'react'
import type { LicenseInfo } from '../lib/types'
import { api } from '../lib/ipc'

interface Props {
  license: LicenseInfo
  onLicenseChange: (license: LicenseInfo) => void
}

const FREE_FEATURES = [
  { name: 'Token Speed Benchmark', included: true },
  { name: 'Memory Usage Benchmark', included: true },
  { name: 'Basic Results View', included: true },
  { name: 'Manual Configuration', included: true },
  { name: 'Hardware Auto-Detection', included: false },
  { name: 'Smart Auto-Optimize', included: false },
  { name: 'HuggingFace Model Browser', included: false },
  { name: 'Model Downloads', included: false },
  { name: 'Auto Build llama.cpp', included: false },
  { name: 'Perplexity Benchmark', included: false },
  { name: 'Context Scaling Analysis', included: false },
  { name: 'Quantization Comparison', included: false },
  { name: 'Export Reports (JSON/CSV)', included: false },
]

export default function LicensePanel({ license, onLicenseChange }: Props) {
  const [key, setKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')

  const handleActivate = async () => {
    if (!key.trim()) return
    setActivating(true)
    setError('')
    try {
      const result = await api.activateLicense(key.trim())
      if (result.status === 'active') {
        onLicenseChange(result)
        setKey('')
      } else if (result.status === 'invalid') {
        setError('Invalid license key. Please check and try again.')
      } else if (result.status === 'expired') {
        setError('This license key has expired.')
      }
    } finally {
      setActivating(false)
    }
  }

  const handleDeactivate = async () => {
    await api.deactivateLicense()
    onLicenseChange({
      status: 'none',
      key: '',
      expiresAt: null,
      features: [],
      isPremium: false,
    })
  }

  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      marginBottom: 28,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>License</h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Unlock all premium features with a license key.
      </p>

      {license.isPremium ? (
        /* Active License */
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 18px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 8,
            marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>✓</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                Premium License Active
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Key: {license.key.substring(0, 9)}...{license.key.substring(license.key.length - 4)}
                {license.expiresAt && ` | Expires: ${new Date(license.expiresAt).toLocaleDateString()}`}
              </div>
            </div>
          </div>
          <button onClick={handleDeactivate} style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--danger)',
            borderRadius: 6,
            color: 'var(--danger)',
            cursor: 'pointer',
            fontSize: 13,
          }}>
            Deactivate License
          </button>
        </div>
      ) : (
        /* License Input */
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="LLMB-XXXX-XXXX-XXXX-XXXX"
              style={{
                flex: 1,
                padding: '10px 14px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                color: 'var(--text-primary)',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'monospace',
                letterSpacing: 1,
              }}
            />
            <button onClick={handleActivate} disabled={activating || !key.trim()} style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: 'white',
              cursor: (!key.trim() || activating) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              opacity: (!key.trim() || activating) ? 0.5 : 1,
            }}>
              {activating ? 'Activating...' : 'Activate'}
            </button>
          </div>
          {error && (
            <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{error}</div>
          )}

          {/* Feature Comparison */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Premium unlocks:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FREE_FEATURES.map((f) => (
                <div key={f.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: f.included ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}>
                  <span style={{
                    color: f.included ? 'var(--success)' : 'var(--accent)',
                    fontSize: 14,
                  }}>
                    {f.included ? '✓' : '★'}
                  </span>
                  {f.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
