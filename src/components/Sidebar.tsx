import type { AppView } from '../lib/types'

interface Props {
  currentView: AppView
  onNavigate: (view: AppView) => void
  isRunning: boolean
  isPremium: boolean
}

const navItems: { view: AppView; label: string; icon: string; premium?: boolean }[] = [
  { view: 'benchmark', label: 'Benchmark', icon: '▶' },
  { view: 'results', label: 'Results', icon: '📊' },
  { view: 'history', label: 'History', icon: '📋' },
  { view: 'models', label: 'Models', icon: '🤗', premium: true },
  { view: 'hardware', label: 'Hardware', icon: '🖥', premium: true },
  { view: 'settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar({ currentView, onNavigate, isRunning, isPremium }: Props) {
  return (
    <nav style={{
      width: 220,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
    }}>
      <div style={{
        padding: '0 20px 20px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 8,
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
          LLM Bench
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          llama.cpp Benchmarking
        </p>
      </div>

      {navItems.map(({ view, label, icon, premium }) => (
        <button
          key={view}
          onClick={() => onNavigate(view)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            background: currentView === view ? 'var(--bg-hover)' : 'transparent',
            border: 'none',
            color: currentView === view ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 14,
            textAlign: 'left',
            width: '100%',
            borderLeft: currentView === view ? '3px solid var(--accent)' : '3px solid transparent',
          }}
        >
          <span>{icon}</span>
          <span style={{ flex: 1 }}>{label}</span>
          {premium && !isPremium && (
            <span style={{
              fontSize: 10,
              padding: '2px 6px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--accent)',
              borderRadius: 8,
              fontWeight: 600,
            }}>
              PRO
            </span>
          )}
        </button>
      ))}

      <div style={{ marginTop: 'auto', padding: '16px 20px' }}>
        {isRunning && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--accent)',
            textAlign: 'center',
          }}>
            Benchmark Running...
          </div>
        )}
        {!isPremium && (
          <button
            onClick={() => onNavigate('settings')}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '8px 12px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(168,85,247,0.2))',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--accent)',
              cursor: 'pointer',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Upgrade to Premium
          </button>
        )}
      </div>
    </nav>
  )
}
