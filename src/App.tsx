import { useState, useEffect } from 'react'
import type { AppView, BenchmarkResult, LicenseInfo, HardwareInfo } from './lib/types'
import { useSettings } from './hooks/useSettings'
import { useBenchmark } from './hooks/useBenchmark'
import { api } from './lib/ipc'
import Sidebar from './components/Sidebar'
import BenchmarkPanel from './components/BenchmarkPanel'
import ResultsPanel from './components/ResultsPanel'
import HistoryPanel from './components/HistoryPanel'
import SettingsPanel from './components/SettingsPanel'
import HuggingFaceBrowser from './components/HuggingFaceBrowser'
import HardwarePanel from './components/HardwarePanel'
import SetupWizard from './components/SetupWizard'
import UpdateBanner from './components/UpdateBanner'

export default function App() {
  const [view, setView] = useState<AppView>('benchmark')
  const { settings, updateSettings, detectLlamaCpp } = useSettings()
  const { results, progress, run: runBenchmark, cancel } = useBenchmark()

  const run = async (config: Parameters<typeof runBenchmark>[0]) => {
    const res = await runBenchmark(config)
    if (res && res.length > 0) setView('results')
    return res
  }
  const [historyResults, setHistoryResults] = useState<BenchmarkResult[]>([])
  const [license, setLicense] = useState<LicenseInfo>({
    status: 'none', key: '', expiresAt: null, features: [], isPremium: false,
  })
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null) // null = loading

  useEffect(() => {
    api.getLicenseInfo().then(setLicense)
    api.detectHardware().then(setHardware).catch(() => {/* non-critical */})
    api.getSettings().then((s) => {
      // Show wizard if no path set, or if the binary no longer exists at that path
      if (!s.llamaCppPath) {
        setNeedsSetup(true)
      } else {
        api.detectLlamaCpp().then((found) => {
          setNeedsSetup(!found)
        })
      }
    })
  }, [])

  function handleSetupComplete(binDir: string) {
    if (binDir) {
      updateSettings({ ...settings, llamaCppPath: binDir })
    }
    setNeedsSetup(false)
  }

  function handleReinstall() {
    api.saveSettings({ ...settings, llamaCppPath: '' })
    setNeedsSetup(true)
  }

  // Show nothing while checking settings
  if (needsSetup === null) return null

  if (needsSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />
  }

  const isPremium = license.isPremium

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <UpdateBanner />
      <Sidebar
        currentView={view}
        onNavigate={setView}
        isRunning={progress.running}
        isPremium={isPremium}
      />

      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: '24px 32px',
      }}>
        {view === 'benchmark' && (
          <BenchmarkPanel
            settings={settings}
            progress={progress}
            onRun={run}
            onCancel={cancel}
            isPremium={isPremium}
            hardware={hardware}
          />
        )}
        {view === 'results' && (
          <ResultsPanel results={results} />
        )}
        {view === 'history' && (
          <HistoryPanel results={historyResults} setResults={setHistoryResults} />
        )}
        {view === 'models' && (
          <HuggingFaceBrowser
            isPremium={isPremium}
            modelsDirectory={settings.modelsDirectory}
          />
        )}
        {view === 'hardware' && (
          <HardwarePanel isPremium={isPremium} />
        )}
        {view === 'settings' && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            onDetect={detectLlamaCpp}
            onReinstall={handleReinstall}
            license={license}
            onLicenseChange={setLicense}
            isPremium={isPremium}
            recommendedBackend={hardware?.recommendedBackend || 'cpu'}
          />
        )}
      </main>
    </div>
  )
}
