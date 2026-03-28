import https from 'https'
import http from 'http'

interface HFModel {
  id: string
  name: string
  author: string
  description: string
  downloads: number
  likes: number
  lastModified: string
  tags: string[]
  files: HFModelFile[]
}

interface HFModelFile {
  filename: string
  sizeMb: number
  quantType: string
  downloadUrl: string
}

interface HFSearchResult {
  models: HFModel[]
  totalCount: number
}

const HF_API_BASE = 'https://huggingface.co/api'

export async function searchModels(query: string, page: number = 0): Promise<HFSearchResult> {
  const searchQuery = query.includes('gguf') ? query : `${query} gguf`
  const params = new URLSearchParams({
    search: searchQuery,
    filter: 'gguf',
    sort: 'downloads',
    direction: '-1',
    limit: '20',
    offset: String(page * 20),
  })

  const url = `${HF_API_BASE}/models?${params}`
  const data = await fetchJSON(url) as any[]

  const models: HFModel[] = data.map((item: any) => {
    const parts = item.modelId?.split('/') || item.id?.split('/') || ['', '']
    return {
      id: item.modelId || item.id || '',
      name: parts[parts.length - 1] || '',
      author: parts[0] || '',
      description: item.pipeline_tag || '',
      downloads: item.downloads || 0,
      likes: item.likes || 0,
      lastModified: item.lastModified || '',
      tags: item.tags || [],
      files: [],
    }
  })

  return { models, totalCount: models.length }
}

export async function getModelDetails(modelId: string): Promise<HFModel> {
  // Get model info
  const modelData = await fetchJSON(`${HF_API_BASE}/models/${modelId}`) as any

  // Get file listing
  const filesData = await fetchJSON(`${HF_API_BASE}/models/${modelId}/tree/main`) as any[]

  const ggufFiles: HFModelFile[] = (filesData || [])
    .filter((f: any) => f.path?.endsWith('.gguf'))
    .map((f: any) => {
      const filename = f.path
      const sizeMb = (f.size || 0) / (1024 * 1024)
      const quantMatch = filename.match(/(Q\d[^.]*|F\d+|IQ\d[^.]*)/i)

      return {
        filename,
        sizeMb,
        quantType: quantMatch ? quantMatch[1] : 'Unknown',
        downloadUrl: `https://huggingface.co/${modelId}/resolve/main/${filename}`,
      }
    })
    .sort((a: HFModelFile, b: HFModelFile) => a.sizeMb - b.sizeMb)

  const parts = modelId.split('/')
  return {
    id: modelId,
    name: parts[parts.length - 1] || '',
    author: parts[0] || '',
    description: modelData.pipeline_tag || modelData.library_name || '',
    downloads: modelData.downloads || 0,
    likes: modelData.likes || 0,
    lastModified: modelData.lastModified || '',
    tags: modelData.tags || [],
    files: ggufFiles,
  }
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, {
      headers: { 'User-Agent': 'LLM-Bench/1.0' },
      timeout: 30000,
    }, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJSON(res.headers.location).then(resolve).catch(reject)
        return
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid JSON response'))
        }
      })
    })

    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timed out'))
    })
  })
}
