import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

interface DownloadProgress {
  modelId: string
  filename: string
  downloadedMb: number
  totalMb: number
  percent: number
  speedMbps: number
  status: 'downloading' | 'complete' | 'error' | 'cancelled'
  error?: string
}

type ProgressCallback = (progress: DownloadProgress) => void

export class ModelDownloader {
  private abortController: AbortController | null = null
  private cancelled = false

  async download(
    url: string,
    destDir: string,
    modelId: string,
    filename: string,
    onProgress: ProgressCallback,
  ): Promise<string> {
    this.cancelled = false

    // Ensure destination directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    const destPath = path.join(destDir, filename)
    const tempPath = destPath + '.part'

    // Support resume: check if partial file exists
    let startByte = 0
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath)
      startByte = stats.size
    }

    return new Promise((resolve, reject) => {
      const makeRequest = (requestUrl: string) => {
        const client = requestUrl.startsWith('https') ? https : http
        const headers: Record<string, string> = {
          'User-Agent': 'LLM-Bench/1.0',
        }
        if (startByte > 0) {
          headers['Range'] = `bytes=${startByte}-`
        }

        const req = client.get(requestUrl, { headers, timeout: 30000 }, (res) => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            makeRequest(res.headers.location)
            return
          }

          if (res.statusCode && res.statusCode >= 400) {
            onProgress({
              modelId, filename, downloadedMb: 0, totalMb: 0,
              percent: 0, speedMbps: 0, status: 'error',
              error: `HTTP ${res.statusCode}`,
            })
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }

          const contentLength = parseInt(res.headers['content-length'] || '0')
          const totalBytes = contentLength + startByte
          let downloadedBytes = startByte
          const startTime = Date.now()

          const writeStream = fs.createWriteStream(tempPath, {
            flags: startByte > 0 ? 'a' : 'w',
          })

          res.on('data', (chunk: Buffer) => {
            if (this.cancelled) {
              res.destroy()
              writeStream.close()
              onProgress({
                modelId, filename,
                downloadedMb: downloadedBytes / (1024 * 1024),
                totalMb: totalBytes / (1024 * 1024),
                percent: 0, speedMbps: 0, status: 'cancelled',
              })
              reject(new Error('Download cancelled'))
              return
            }

            writeStream.write(chunk)
            downloadedBytes += chunk.length

            const elapsed = (Date.now() - startTime) / 1000
            const speedMbps = elapsed > 0 ? (downloadedBytes - startByte) / (1024 * 1024) / elapsed : 0
            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0

            onProgress({
              modelId, filename,
              downloadedMb: Math.round(downloadedBytes / (1024 * 1024) * 10) / 10,
              totalMb: Math.round(totalBytes / (1024 * 1024) * 10) / 10,
              percent: Math.round(percent * 10) / 10,
              speedMbps: Math.round(speedMbps * 10) / 10,
              status: 'downloading',
            })
          })

          res.on('end', () => {
            writeStream.close(() => {
              // Rename from .part to final filename
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
              fs.renameSync(tempPath, destPath)

              onProgress({
                modelId, filename,
                downloadedMb: Math.round(totalBytes / (1024 * 1024) * 10) / 10,
                totalMb: Math.round(totalBytes / (1024 * 1024) * 10) / 10,
                percent: 100, speedMbps: 0, status: 'complete',
              })

              resolve(destPath)
            })
          })

          res.on('error', (err) => {
            writeStream.close()
            onProgress({
              modelId, filename, downloadedMb: 0, totalMb: 0,
              percent: 0, speedMbps: 0, status: 'error', error: err.message,
            })
            reject(err)
          })
        })

        req.on('error', (err) => {
          onProgress({
            modelId, filename, downloadedMb: 0, totalMb: 0,
            percent: 0, speedMbps: 0, status: 'error', error: err.message,
          })
          reject(err)
        })

        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Download timed out'))
        })
      }

      makeRequest(url)
    })
  }

  cancel() {
    this.cancelled = true
  }
}
