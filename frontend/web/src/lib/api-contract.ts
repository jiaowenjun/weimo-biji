import type { ZodMiniType } from 'zod/mini'

export type ApiContract<T> = ZodMiniType<T>

export type ApiContractIssue = {
  code: string
  message: string
  path: string
}

function formatIssuePath(path: PropertyKey[]) {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') {
      return `${formatted}[${segment}]`
    }

    return `${formatted}.${String(segment)}`
  }, '$')
}

export class ApiContractError extends Error {
  endpoint: string
  issues: ApiContractIssue[]

  constructor(endpoint: string, issues: ApiContractIssue[], cause: unknown) {
    super('服务器返回的数据不符合约定', { cause })
    this.name = 'ApiContractError'
    this.endpoint = endpoint
    this.issues = issues
  }
}

export function parseApiContract<T>(
  endpoint: string,
  contract: ApiContract<T>,
  data: unknown,
): T {
  const result = contract.safeParse(data)

  if (result.success) {
    return result.data
  }

  const issues = result.error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: formatIssuePath(issue.path),
  }))

  throw new ApiContractError(endpoint, issues, result.error)
}
