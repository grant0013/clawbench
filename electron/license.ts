import crypto from 'crypto'
import { getSettings, saveSettings } from './settings'

interface LicenseInfo {
  status: 'none' | 'active' | 'expired' | 'invalid'
  key: string
  expiresAt: string | null
  features: string[]
  isPremium: boolean
}

const PREMIUM_FEATURES = [
  'hardware-detection',
  'auto-optimize',
  'huggingface-browser',
  'model-download',
  'auto-build',
  'advanced-benchmarks',
  'export-reports',
]

// License key format: LLMB-XXXX-XXXX-XXXX-XXXX
// Validation uses a simple checksum algorithm
// In production, you'd want server-side validation

const LICENSE_SECRET = 'llm-bench-v1-2024'

export function activateLicense(key: string): LicenseInfo {
  const normalized = key.trim().toUpperCase()

  if (!isValidFormat(normalized)) {
    return { status: 'invalid', key: normalized, expiresAt: null, features: [], isPremium: false }
  }

  if (!isValidChecksum(normalized)) {
    return { status: 'invalid', key: normalized, expiresAt: null, features: [], isPremium: false }
  }

  // Extract expiration from key (embedded in the last segment)
  const expiresAt = extractExpiration(normalized)
  if (expiresAt && new Date(expiresAt) < new Date()) {
    const settings = getSettings()
    settings.licenseKey = normalized
    settings.licenseStatus = 'expired'
    saveSettings(settings)
    return { status: 'expired', key: normalized, expiresAt, features: [], isPremium: false }
  }

  // Valid license
  const settings = getSettings()
  settings.licenseKey = normalized
  settings.licenseStatus = 'active'
  saveSettings(settings)

  return {
    status: 'active',
    key: normalized,
    expiresAt,
    features: PREMIUM_FEATURES,
    isPremium: true,
  }
}

export function getLicenseInfo(): LicenseInfo {
  const settings = getSettings()

  if (!settings.licenseKey || settings.licenseStatus === 'none') {
    return { status: 'none', key: '', expiresAt: null, features: [], isPremium: false }
  }

  if (settings.licenseStatus === 'active') {
    const expiresAt = extractExpiration(settings.licenseKey)
    if (expiresAt && new Date(expiresAt) < new Date()) {
      settings.licenseStatus = 'expired'
      saveSettings(settings)
      return { status: 'expired', key: settings.licenseKey, expiresAt, features: [], isPremium: false }
    }

    return {
      status: 'active',
      key: settings.licenseKey,
      expiresAt,
      features: PREMIUM_FEATURES,
      isPremium: true,
    }
  }

  return {
    status: settings.licenseStatus as any,
    key: settings.licenseKey,
    expiresAt: null,
    features: [],
    isPremium: false,
  }
}

export function deactivateLicense(): void {
  const settings = getSettings()
  settings.licenseKey = ''
  settings.licenseStatus = 'none'
  saveSettings(settings)
}

// Generate a license key (for your admin/sales tool)
export function generateLicenseKey(expirationYear: number = 2030): string {
  const seg1 = 'LLMB'
  const seg2 = randomHex(4)
  const seg3 = randomHex(4)
  // Encode expiration year in segment 4
  const seg4 = expirationYear.toString(16).toUpperCase().padStart(4, '0')

  const raw = `${seg1}-${seg2}-${seg3}-${seg4}`
  // Generate checksum segment
  const checksum = computeChecksum(raw)
  return `${raw}-${checksum}`
}

function isValidFormat(key: string): boolean {
  return /^LLMB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)
}

function isValidChecksum(key: string): boolean {
  const parts = key.split('-')
  if (parts.length !== 5) return false
  const rawPart = parts.slice(0, 4).join('-')
  const expectedChecksum = computeChecksum(rawPart)
  return parts[4] === expectedChecksum
}

function computeChecksum(raw: string): string {
  // Simple deterministic hash - matches the keygen app algorithm
  let hash = 0
  const str = raw + LICENSE_SECRET
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').substring(0, 4)
}

function extractExpiration(key: string): string | null {
  const parts = key.split('-')
  if (parts.length < 4) return null
  const yearHex = parts[3]
  const year = parseInt(yearHex, 16)
  if (year < 2024 || year > 2100) return null
  return `${year}-12-31T23:59:59Z`
}

function randomHex(length: number): string {
  return crypto.randomBytes(length)
    .toString('hex')
    .toUpperCase()
    .substring(0, length)
}
