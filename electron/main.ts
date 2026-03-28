import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { pathToFileURL } from 'url'
import { detectLlamaCpp } from './llamacpp/detector'
import { LlamaCppRunner } from './llamacpp/runner'
import { LlamaCppBuilder } from './llamacpp/builder'
import { BenchmarkSuite } from './benchmarks/suite'
import { Database } from './database'
import { getSettings, saveSettings } from './settings'
import { detectHardware } from './hardware/detector'
import { optimizeSettings } from './hardware/optimizer'
import { searchModels, getModelDetails } from './huggingface/api'
import { ModelDownloader } from './huggingface/downloader'
import { activateLicense, getLicenseInfo, deactivateLicense } from './license'
import { installPrebuiltLlamaCpp } from './llamacpp/prebuilt'

let mainWindow: BrowserWindow | null = null
let runner: LlamaCppRunner | null = null
let benchmarkSuite: BenchmarkSuite | null = null
let db: Database | null = null
let builder: LlamaCppBuilder | null = null
let downloader: ModelDownloader | null = null

const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html')
    mainWindow.loadURL(pathToFileURL(indexPath).href)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Fallback: show after 3s in case ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
    }
  }, 3000)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  db = new Database()
  runner = new LlamaCppRunner()
  benchmarkSuite = new BenchmarkSuite(runner, db)
  builder = new LlamaCppBuilder()
  downloader = new ModelDownloader()
  createWindow()
  registerIpcHandlers()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function registerIpcHandlers() {
  // --- Existing handlers ---
  ipcMain.handle('select-file', async (_, filters) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: filters ?? [],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('get-settings', () => getSettings())
  ipcMain.handle('save-settings', (_, settings) => saveSettings(settings))
  ipcMain.handle('detect-llamacpp', () => {
    // Check saved path first before searching common locations
    const settings = getSettings()
    if (settings.llamaCppPath) {
      const ext = process.platform === 'win32' ? '.exe' : ''
      const bench = require('path').join(settings.llamaCppPath, 'llama-bench' + ext)
      if (require('fs').existsSync(bench)) return settings.llamaCppPath
    }
    return detectLlamaCpp()
  })

  ipcMain.handle('run-benchmark', async (_, config) => {
    const settings = getSettings()
    runner!.setPath(settings.llamaCppPath)
    return benchmarkSuite!.run(config, (progress) => {
      mainWindow?.webContents.send('benchmark-progress', progress)
    })
  })

  ipcMain.handle('cancel-benchmark', () => {
    benchmarkSuite?.cancel()
  })

  ipcMain.handle('get-history', () => db!.getAllResults())
  ipcMain.handle('delete-history-item', (_, id) => db!.deleteResult(id))

  ipcMain.handle('export-results', async (_, results, format) => {
    const ext = format === 'json' ? 'json' : 'csv'
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `benchmark-results.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }],
    })
    if (result.canceled || !result.filePath) return ''
    const fs = await import('fs')
    if (format === 'json') {
      fs.writeFileSync(result.filePath, JSON.stringify(results, null, 2))
    } else {
      const csv = resultsToCsv(results)
      fs.writeFileSync(result.filePath, csv)
    }
    return result.filePath
  })

  // --- Hardware Detection ---
  ipcMain.handle('detect-hardware', () => detectHardware())
  ipcMain.handle('optimize-settings', (_, modelPath, hardwareInfo) => {
    return optimizeSettings(modelPath, hardwareInfo)
  })

  // --- HuggingFace ---
  ipcMain.handle('search-models', (_, query, page) => searchModels(query, page))
  ipcMain.handle('get-model-details', (_, modelId) => getModelDetails(modelId))

  ipcMain.handle('download-model', async (_, modelId, filename, destDir) => {
    const url = `https://huggingface.co/${modelId}/resolve/main/${filename}`
    return downloader!.download(url, destDir, modelId, filename, (progress) => {
      mainWindow?.webContents.send('download-progress', progress)
    })
  })

  ipcMain.handle('cancel-download', () => {
    downloader?.cancel()
  })

  // --- Build llama.cpp ---
  ipcMain.handle('check-build-prerequisites', () => {
    return builder!.checkPrerequisites()
  })

  ipcMain.handle('build-llamacpp', async (_, backend) => {
    const binPath = await builder!.build(backend, (progress) => {
      mainWindow?.webContents.send('build-progress', progress)
    })
    // Auto-set the llama.cpp path
    const settings = getSettings()
    settings.llamaCppPath = binPath
    saveSettings(settings)
    return binPath
  })

  ipcMain.handle('cancel-build', () => {
    builder?.cancel()
  })

  // --- Auto-install prebuilt llama.cpp ---
  ipcMain.handle('install-llamacpp-prebuilt', async (_, force = false) => {
    if (force) {
      // Clear existing install so it re-downloads
      const fs = await import('fs')
      const installDir = require('path').join(app.getPath('userData'), 'llama-cpp')
      if (fs.existsSync(installDir)) fs.rmSync(installDir, { recursive: true, force: true })
    }
    const binDir = await installPrebuiltLlamaCpp((progress) => {
      mainWindow?.webContents.send('install-progress', progress)
    })
    const settings = getSettings()
    settings.llamaCppPath = binDir
    saveSettings(settings)
    return binDir
  })

  // --- Generate Setup Script ---
  ipcMain.handle('generate-setup-script', async (_, modelPath: string, nGpuLayers: number, threads: number, genTps: number, ppTps: number) => {
    const fs = await import('fs')
    const pathMod = await import('path')
    const settings = getSettings()
    const llamaBin = pathMod.join(settings.llamaCppPath, process.platform === 'win32' ? 'llama-cli.exe' : 'llama-cli')
    const modelName = pathMod.basename(modelPath, '.gguf')
    const desktop = pathMod.join(app.getPath('home'), 'Desktop')
    const scriptPath = pathMod.join(desktop, `Run ${modelName}.bat`)

    const perfLine = ppTps > 0 ? `Prompt speed: ${ppTps.toFixed(0)} tokens/sec  ^|  Generation speed: ${genTps.toFixed(0)} tokens/sec` : ''

    const script = [
      `@echo off`,
      `title Claw Chat - ${modelName}`,
      `color 0A`,
      `echo.`,
      `echo  ================================================`,
      `echo   Claw Chat - Powered by ClawBench`,
      `echo  ================================================`,
      `echo.`,
      `echo   Model  : ${modelName}`,
      `echo   GPU    : ${nGpuLayers === 99 ? 'All layers on GPU (fastest)' : nGpuLayers + ' layers on GPU'}`,
      `echo   Threads: ${threads}`,
      ...(perfLine ? [`echo   Speed  : ${perfLine}`] : []),
      `echo.`,
      `echo  Starting... (this may take a few seconds)`,
      `echo  Type your message and press Enter to chat. Type /bye to quit.`,
      `echo.`,
      ``,
      `"${llamaBin}" -m "${modelPath}" -ngl ${nGpuLayers} -t ${threads} -c 4096 --repeat-penalty 1.1 -cnv --color on`,
      ``,
      `if %ERRORLEVEL% neq 0 (`,
      `  echo.`,
      `  echo  ERROR: llama-cli exited with code %ERRORLEVEL%`,
      `  echo  Please check the model path exists and try again.`,
      `  echo.`,
      `)`,
      `echo  Session ended. Press any key to close.`,
      `pause > nul`,
    ].join('\r\n')

    fs.writeFileSync(scriptPath, script, 'utf-8')

    // Open Desktop folder so user can see the file
    const { exec } = await import('child_process')
    if (process.platform === 'win32') exec(`explorer "${desktop}"`)

    return scriptPath
  })

  // --- License ---
  ipcMain.handle('activate-license', (_, key) => activateLicense(key))
  ipcMain.handle('get-license-info', () => getLicenseInfo())
  ipcMain.handle('deactivate-license', () => deactivateLicense())
}

function resultsToCsv(results: any[]): string {
  if (results.length === 0) return ''
  const lines = ['timestamp,model,type,data']
  for (const r of results) {
    lines.push(`${r.timestamp},"${r.modelName}","${r.type}","${JSON.stringify(r.data).replace(/"/g, '""')}"`)
  }
  return lines.join('\n')
}
