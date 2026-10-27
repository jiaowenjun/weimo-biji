import { vi } from 'vitest'

export type TestComponentInstance = {
  data: Record<string, unknown>
  properties: Record<string, unknown>
  setData: (patch: Record<string, unknown>) => void
  triggerEvent: (...args: unknown[]) => void
}

export type TestComponentMethod<TInstance extends TestComponentInstance = TestComponentInstance> =
  (this: TInstance, ...args: unknown[]) => unknown

export type TestComponentOptions<TInstance extends TestComponentInstance = TestComponentInstance> = {
  properties: Record<string, { type: unknown; value: unknown }>
  data?: Record<string, unknown>
  observers?: Record<string, (...args: unknown[]) => void>
  methods?: Record<string, TestComponentMethod<TInstance>>
}

export async function captureComponentOptions(
  loadModule: () => Promise<unknown>,
): Promise<TestComponentOptions> {
  let captured: TestComponentOptions | undefined

  vi.stubGlobal('Component', (options: TestComponentOptions) => {
    captured = options
  })

  await loadModule()

  if (!captured) {
    throw new Error('Component options were not captured')
  }

  return captured
}

export function createComponentInstance(
  options: TestComponentOptions,
  data: Record<string, unknown> = {},
): TestComponentInstance {
  const properties = Object.fromEntries(
    Object.entries(options.properties ?? {}).map(([key, descriptor]) => [key, descriptor.value]),
  )

  for (const key of Object.keys(properties)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      properties[key] = data[key]
    }
  }

  return {
    data: {
      ...(options.data ?? {}),
      ...data,
    },
    properties,
    setData(patch) {
      this.data = { ...this.data, ...patch }
    },
    triggerEvent: vi.fn(),
  }
}
