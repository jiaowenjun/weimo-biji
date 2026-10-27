const fs = require('node:fs')
const path = require('node:path')

function listFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const out = []
  for (const ent of entries) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listFilesRecursive(p))
    else out.push(p)
  }
  return out
}

function findIconWxss() {
  const root = path.join(__dirname, 'node_modules', 'tdesign-miniprogram')
  if (!fs.existsSync(root)) throw new Error(`tdesign-miniprogram not found at ${root}`)
  const files = listFilesRecursive(root).filter((p) => p.endsWith(`${path.sep}icon${path.sep}icon.wxss`))
  if (files.length === 0) throw new Error('icon.wxss not found under tdesign-miniprogram')
  return files[0]
}

function parseIconWxss(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const re = /\.t-icon-([a-z0-9-]+):before\s*\{\s*content:\s*['"]\\([0-9a-fA-F]+)['"]\s*;\s*\}/g
  const map = new Map()
  for (const m of text.matchAll(re)) {
    map.set(m[1], m[2].toLowerCase())
  }
  if (map.size === 0) throw new Error(`no icons parsed from ${filePath}`)
  return map
}

function parseIconsList(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/g).map((l) => l.trim()).filter(Boolean)
  const out = []
  const seen = new Set()
  const targets = new Set()
  for (const line of lines) {
    if (line.startsWith('#')) continue
    const parts = line.split(/\s+/g)
    if (parts.length !== 2 && parts.length !== 3) throw new Error(`invalid line: ${line}`)
    const [name, target, sourceName] = parts
    if (seen.has(name)) throw new Error(`duplicate name: ${name}`)
    if (targets.has(target)) throw new Error(`duplicate target: ${target}`)
    seen.add(name)
    targets.add(target)
    out.push({ name, target: target.toLowerCase(), sourceName })
  }
  return out
}

function main() {
  const iconsListPath = path.join(__dirname, 'biji-skyline-icons.txt')
  const iconWxssPath = process.argv[2] ? path.resolve(process.argv[2]) : findIconWxss()
  const tdesignMap = parseIconWxss(iconWxssPath)
  const icons = parseIconsList(iconsListPath)

  const missing = []
  const mapping = icons.map(({ name, target, sourceName }) => {
    const lookup = sourceName || name
    const source = tdesignMap.get(lookup)
    if (!source) missing.push(lookup)
    return { name, source, target }
  })
  if (missing.length) throw new Error(`icons not found in tdesign icon.wxss: ${[...new Set(missing)].sort().join(', ')}`)

  const mappingPath = path.join(__dirname, 'mapping.json')
  fs.writeFileSync(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8')
  process.stdout.write(`icons: ${mapping.length}\n`)
  process.stdout.write(`icon.wxss: ${iconWxssPath}\n`)
  process.stdout.write(`mapping.json: ${mappingPath}\n`)
}

main()
