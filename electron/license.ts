import { getSettings, saveSettings } from './settings'

// ── Types ─────────────────────────────────────────────────────────────────────
export type LicenseTier = 'standard' | 'lifetime'

export interface LicenseInfo {
  status: 'none' | 'active' | 'invalid'
  key: string
  expiresAt: string | null
  features: string[]
  isPremium: boolean
  tier: LicenseTier | null
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Standard licences cover this major version only.
// Bump this when releasing a new major version.
const APP_MAJOR_VERSION = 2

const PREMIUM_FEATURES = [
  'hardware-detection',
  'auto-optimize',
  'huggingface-browser',
  'model-download',
  'auto-build',
  'advanced-benchmarks',
  'export-reports',
]

// ── djb2 hash — must match keygen.js on the purchase server exactly ───────────
function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
    hash = hash >>> 0
  }
  return hash
}

function generateSegment(seed: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  let h = djb2(seed)
  for (let i = 0; i < 4; i++) {
    result += chars[h % chars.length]
    h = djb2(result + seed + i)
  }
  return result
}

// ── Key format ────────────────────────────────────────────────────────────────
// Standard:  LLMB-XXXX-XXXX-XXXX-XXXX  (v2.x only)
// Lifetime:  LLML-XXXX-XXXX-XXXX-XXXX  (all future versions)

function detectTier(key: string): LicenseTier | null {
  if (/^LLMB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(key)) return 'standard'
  if (/^LLML-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(key)) return 'lifetime'
  return null
}

function isValidChecksum(key: string, tier: LicenseTier): boolean {
  const parts = key.split('-')
  if (parts.length !== 5) return false
  const [, s1, s2, s3, checksum] = parts
  const salt = tier === 'lifetime' ? 'CLAWBENCH-LIFETIME' : 'CLAWBENCH'
  return checksum === generateSegment(s1 + s2 + s3 + salt)
}

function isVersionCompatible(tier: LicenseTier): boolean {
  if (tier === 'lifetime') return true
  return APP_MAJOR_VERSION === 2
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function activateLicense(key: string): LicenseInfo {
  const normalized = key.trim().toUpperCase()

  const tier = detectTier(normalized)
  if (!tier) {
    return { status: 'invalid', key: normalized, expiresAt: null, features: [], isPremium: false, tier: null }
  }

  if (!isValidChecksum(normalized, tier)) {
    return { status: 'invalid', key: normalized, expiresAt: null, features: [], isPremium: false, tier: null }
  }

  if (!isVersionCompatible(tier)) {
    return { status: 'invalid', key: normalized, expiresAt: null, features: [], isPremium: false, tier: null }
  }

  const settings = getSettings()
  settings.licenseKey = normalized
  settings.licenseStatus = 'active'
  settings.licenseTier = tier
  saveSettings(settings)

  return { status: 'active', key: normalized, expiresAt: null, features: PREMIUM_FEATURES, isPremium: true, tier }
}

export function getLicenseInfo(): LicenseInfo {
  const settings = getSettings()

  if (!settings.licenseKey || settings.licenseStatus === 'none') {
    return { status: 'none', key: '', expiresAt: null, features: [], isPremium: false, tier: null }
  }

  const tier: LicenseTier | null = (settings.licenseTier as LicenseTier) || detectTier(settings.licenseKey)

  if (settings.licenseStatus === 'active' && tier) {
    if (!isVersionCompatible(tier)) {
      return { status: 'invalid', key: settings.licenseKey, expiresAt: null, features: [], isPremium: false, tier }
    }
    return { status: 'active', key: settings.licenseKey, expiresAt: null, features: PREMIUM_FEATURES, isPremium: true, tier }
  }

  return { status: 'none', key: '', expiresAt: null, features: [], isPremium: false, tier: null }
}

export function deactivateLicense(): void {
  const settings = getSettings()
  settings.licenseKey = ''
  settings.licenseStatus = 'none'
  settings.licenseTier = ''
  saveSettings(settings)
}
