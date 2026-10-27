/// <reference path="./types/index.d.ts" />

interface WeimoSessionUser {
  username: string
  nickname: string
  login_name: string
  has_login_password: boolean
}

interface WeimoSessionState {
  accessToken: string | null
  refreshToken: string | null
  user: WeimoSessionUser | null
}

interface IAppOption extends WechatMiniprogram.IAnyObject {
  globalData: {
    session?: WeimoSessionState
    skylineSupported?: boolean
    theme?: 'light' | 'dark'
  }
  detectSkyline(): void
  initTheme(): void
}

type MemoComposeMode = 'create' | 'edit'
type MemoComposeTagPickerMode = 'insert' | 'update' | 'pick'
type MemoRefId = string

interface MemoComposeInitPayload {
  mode: MemoComposeMode
  memoId?: number
  initialContent: string
  initialTags: string[]
  initialRefs: MemoRefId[]
  initialReferencePreview?: string | null
}

interface MemoComposeSavedPayload {
  mode: MemoComposeMode
  memoId?: number
}

interface MemoComposeTagPickerInitPayload {
  /** `pick`：只从已有标签树选一条；`insert` / `update`：可新建、替换或重命名。 */
  mode: MemoComposeTagPickerMode
  targetTag: string
  selectedTags: string[]
  initialDraft: string
  allowEmptyRemove?: boolean
}

interface MemoComposeTagPickerApplyPayload {
  selectedTags: string[]
}

interface SkylineNavigateToRouteConfig {
  popGestureDirection?: 'vertical' | 'horizontal' | 'multi'
  fullscreenDrag?: boolean
  canTransitionFrom?: boolean
  canTransitionTo?: boolean
}

interface SkylineNavigateToRouteOptions {
  height?: number
  round?: boolean
}

interface SkylineNavigateToOption extends WechatMiniprogram.NavigateToOption {
  routeType?: string
  routeConfig?: SkylineNavigateToRouteConfig
  routeOptions?: SkylineNavigateToRouteOptions
}

interface SkylineSharedValue<T> {
  value: T
}

interface SkylineSpringConfig {
  mass?: number
  stiffness?: number
  damping?: number
}

type SkylineAnimationCallback = (finished: boolean) => void

interface SkylineEasing {
  cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number
  in(easing: (t: number) => number): (t: number) => number
  out(easing: (t: number) => number): (t: number) => number
  ease: (t: number) => number
}

interface SkylineWorkletModule {
  shared<T>(value: T): SkylineSharedValue<T>
  derived(fn: () => number): SkylineSharedValue<number>
  Easing: SkylineEasing
  spring(toValue: number, config?: SkylineSpringConfig, callback?: SkylineAnimationCallback): number
  timing(
    toValue: number,
    config?: { duration?: number; easing?: (t: number) => number },
    callback?: SkylineAnimationCallback,
  ): number
  runOnJS<TArgs extends unknown[]>(fn: (...args: TArgs) => void): (...args: TArgs) => void
  runOnUI<TArgs extends unknown[]>(fn: (...args: TArgs) => void): (...args: TArgs) => void
}

interface SkylineInfo {
  isSupported: boolean
  version?: string
  reason?: string
}

interface AppBaseInfo {
  SDKVersion: string
  [key: string]: unknown
}

interface WindowInfo {
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  safeArea?: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
}

interface DeviceInfo {
  platform: string
  [key: string]: unknown
}

declare namespace WechatMiniprogram {
  interface Wx {
    worklet: SkylineWorkletModule
    router: {
      addRouteBuilder(name: string, builder: (ctx: unknown) => unknown): void
      removeRouteBuilder(name: string): void
    }
    getSkylineInfoSync(): SkylineInfo
    getAppBaseInfo(): AppBaseInfo
    getWindowInfo(): WindowInfo
    getDeviceInfo(): DeviceInfo
    getMenuButtonBoundingClientRect(): {
      width: number
      height: number
      top: number
      right: number
      bottom: number
      left: number
    }
    enableAlertBeforeUnload(option: { message: string }): void
    disableAlertBeforeUnload(): void
    preloadSkylineView(option: { url: string }): void
  }
}
