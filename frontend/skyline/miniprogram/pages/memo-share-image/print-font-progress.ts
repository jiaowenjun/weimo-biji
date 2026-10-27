export interface PrintFontProgressOptions {
  onProgress: (progress: number) => void
  onTimeout: () => void
}

export interface PrintFontProgress {
  start: () => void
  stop: () => void
  fillToComplete: (onDone: () => void) => void
  destroy: () => void
}

const PHASE1_DURATION = 60
const PHASE2_DURATION = 60
const TOTAL_TIMEOUT = PHASE1_DURATION + PHASE2_DURATION
const PHASE1_TARGET = 80
const PHASE2_TARGET = 95
const SIMULATION_INTERVAL = 1000
const FILL_INTERVAL = 50
const FILL_HOLD = 300

export function createPrintFontProgress(options: PrintFontProgressOptions): PrintFontProgress {
  let timer: ReturnType<typeof setInterval> | null = null
  let startTime = 0
  let fillTimer: ReturnType<typeof setInterval> | null = null
  let current = 0

  function clearSimulation() {
    if (timer != null) {
      clearInterval(timer)
      timer = null
    }
  }

  function clearFill() {
    if (fillTimer != null) {
      clearInterval(fillTimer)
      fillTimer = null
    }
  }

  return {
    start() {
      clearSimulation()
      startTime = Date.now()
      current = 0
      timer = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000
        let progress: number
        if (elapsed <= PHASE1_DURATION) {
          progress = (elapsed / PHASE1_DURATION) * PHASE1_TARGET
        } else if (elapsed <= TOTAL_TIMEOUT) {
          progress = PHASE1_TARGET + ((elapsed - PHASE1_DURATION) / PHASE2_DURATION) * (PHASE2_TARGET - PHASE1_TARGET)
        } else {
          clearSimulation()
          options.onTimeout()
          return
        }
        current = Math.min(Math.floor(progress), PHASE2_TARGET)
        options.onProgress(current)
      }, SIMULATION_INTERVAL)
    },

    stop() {
      clearSimulation()
    },

    fillToComplete(onDone: () => void) {
      clearSimulation()
      if (current >= 100) {
        options.onProgress(100)
        onDone()
        return
      }
      const step = Math.max(2, Math.ceil((100 - current) / 10))
      fillTimer = setInterval(() => {
        current += step
        if (current >= 100) {
          current = 100
          clearFill()
          options.onProgress(100)
          setTimeout(onDone, FILL_HOLD)
        } else {
          options.onProgress(current)
        }
      }, FILL_INTERVAL)
    },

    destroy() {
      clearSimulation()
      clearFill()
    },
  }
}
