import { useState, useEffect } from 'react'
import { api } from '../lib/ipc'

type UpdateState = 'idle' | 'available' | 'downloading' | 'ready' | 'not-entitled'

const PURCHASE_URL = 'https://purchase.openclawarcade.org'

export default function UpdateBanner() {
  const [state, setState]     = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [percent, setPercent] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvailable = api.onUpdateAvailable((info) => {
      setVersion(info.version)
      setState('available')
    })
    const offProgress = api.onUpdateProgress((progress) => {
      setState('downloading')
      setPercent(progress.percent)
    })
    const offDownloaded = api.onUpdateDownloaded((info) => {
      setVersion(info.version)
      setState('ready')
    })
    const offNotEntitled = api.onUpdateNotEntitled((info) => {
      setVersion(info.version)
      setState('not-entitled')
    })
    return () => { offAvailable(); offProgress(); offDownloaded(); offNotEntitled() }
  }, [])

  if (dismissed || state === 'idle') return null

  const styles = {
    banner: {
      position: 'fixed' as const,
      bottom: 20,
      right: 20,
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 12,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 9999,
      maxWidth: 380,
      animation: 'slideIn 0.3s ease',
    },
    icon: { fontSize: 22, flexShrink: 0 },
    text: { flex: 1 },
    title: { fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 },
    sub: { fontSize: 12, color: '#64748b' },
    btn: {
      padding: '7px 14px',
      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      border: 'none',
      borderRadius: 7,
      color: 'white',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
    },
    dismiss: {
      background: 'none',
      border: 'none',
      color: '#475569',
      cursor: 'pointer',
      fontSize: 16,
      padding: '0 4px',
      flexShrink: 0,
    },
    bar: {
      height: 3,
      background: '#1e3a5f',
      borderRadius: 2,
      marginTop: 6,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
      borderRadius: 2,
      transition: 'width 0.3s ease',
      width: `${percent}%`,
    },
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={styles.banner}>
        <span style={styles.icon}>
          {state === 'ready' ? '✅' : state === 'downloading' ? '⬇️' : state === 'not-entitled' ? '🔒' : '⚡'}
        </span>
        <div style={styles.text}>
          {state === 'available' && (
            <>
              <div style={styles.title}>Update available — v{version}</div>
              <div style={styles.sub}>Downloading in the background…</div>
            </>
          )}
          {state === 'downloading' && (
            <>
              <div style={styles.title}>Downloading v{version}… {percent}%</div>
              <div style={styles.bar}><div style={styles.fill}/></div>
            </>
          )}
          {state === 'ready' && (
            <>
              <div style={styles.title}>v{version} ready to install</div>
              <div style={styles.sub}>Restart ClawBench to apply the update</div>
            </>
          )}
          {state === 'not-entitled' && (
            <>
              <div style={styles.title}>v{version} — Licence upgrade required</div>
              <div style={styles.sub}>Your Standard licence covers v2.x only. Upgrade to Lifetime for all future versions.</div>
            </>
          )}
        </div>
        {state === 'ready' && (
          <button style={styles.btn} onClick={() => api.installUpdate()}>
            Restart & Install
          </button>
        )}
        {state === 'not-entitled' && (
          <button style={styles.btn} onClick={() => api.openExternal(PURCHASE_URL)}>
            Buy Lifetime →
          </button>
        )}
        {state !== 'downloading' && (
          <button style={styles.dismiss} onClick={() => setDismissed(true)}>✕</button>
        )}
      </div>
    </>
  )
}
