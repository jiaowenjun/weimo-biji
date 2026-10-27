'use strict'

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const miniprogramRoot = path.join(__dirname, '..')
const configPath = path.join(miniprogramRoot, 'tsconfig.runtime.json')
const runtimeRoot = path.join(miniprogramRoot, '..', '.generated', 'miniprogram-runtime')

function formatDiagnostics(diagnostics) {
  const host = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => miniprogramRoot,
    getNewLine: () => '\n',
  }

  return ts.formatDiagnosticsWithColorAndContext(diagnostics, host)
}

function loadConfig() {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error]))
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    miniprogramRoot,
    undefined,
    configPath,
  )

  if (parsed.errors.length > 0) {
    throw new Error(formatDiagnostics(parsed.errors))
  }

  return parsed
}

function buildRuntime(outputRoot = runtimeRoot) {
  const parsed = loadConfig()
  fs.rmSync(outputRoot, { recursive: true, force: true })

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: {
      ...parsed.options,
      outDir: outputRoot,
    },
  })

  const emitResult = program.emit()
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)

  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics))
  }
}

if (require.main === module) {
  try {
    buildRuntime()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  }
}

module.exports = {
  buildRuntime,
  runtimeRoot,
}
