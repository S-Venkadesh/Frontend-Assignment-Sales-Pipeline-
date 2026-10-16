import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 12)) {
  console.error('Use Node.js 22.12 or newer. Node.js 24 LTS is recommended.')
  process.exit(1)
}

const digest = createHash('sha256')
  .update(readFileSync(join(root, 'package.json')))
  .update(readFileSync(join(root, 'package-lock.json')))
  .digest('hex')
const stamp = join(root, 'node_modules', '.pipeline-dependencies')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

async function run(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  const stop = (signal) => child.kill(signal)
  const interrupt = () => stop('SIGINT')
  const terminate = () => stop('SIGTERM')
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', terminate)
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      process.off('SIGINT', interrupt)
      process.off('SIGTERM', terminate)
      resolve(code ?? (signal === 'SIGINT' ? 130 : 1))
    })
  })
}

try {
  if (!existsSync(join(root, 'node_modules/vite/bin/vite.js')) || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== digest) {
    console.log('Installing locked dependencies for this checkout…')
    const code = await run(npm, ['ci', '--no-audit', '--no-fund'])
    if (code !== 0) process.exit(code)
    writeFileSync(stamp, digest)
  }
  process.exitCode = await run(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), ...process.argv.slice(2)])
} catch (error) {
  console.error(`Could not start Pipeline: ${error.message}`)
  process.exitCode = 1
}
