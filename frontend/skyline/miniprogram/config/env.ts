interface EnvironmentConfig {
  apiBaseUrl: string
  envVersion: string
}

const DEFAULT_API_BASE_URL = 'https://weimo.ink/biji/api'

const API_BASE_URL_BY_ENV: Record<string, string> = {
  develop: DEFAULT_API_BASE_URL,
  trial: DEFAULT_API_BASE_URL,
  release: DEFAULT_API_BASE_URL,
}

function resolveEnvVersion() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion
  } catch (_error) {
    return 'develop'
  }
}

function normalizeApiBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

const envVersion = resolveEnvVersion()
const apiBaseUrl =
  API_BASE_URL_BY_ENV[envVersion] != null
    ? API_BASE_URL_BY_ENV[envVersion]
    : DEFAULT_API_BASE_URL

export const ENVIRONMENT_CONFIG: EnvironmentConfig = {
  apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
  envVersion,
}
