import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const frontend = spawn(resolve(root, 'node_modules/next/dist/bin/next'), [
  'dev', '--hostname', '0.0.0.0', '--port', process.env.PORT || '3000',
], {
  cwd: root,
  env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=1536' },
  stdio: 'inherit',
})
const backend = spawn(resolve(root, 'services/api/mvnw'), ['spring-boot:run'], {
  cwd: resolve(root, 'services/api'),
  env: process.env,
  stdio: 'inherit',
})
const children = [frontend, backend]
let stopping = false

function stop(signal = 'SIGTERM') {
  if (stopping) return
  stopping = true
  children.forEach(child => {
    if (child.exitCode === null) child.kill(signal)
  })
}

children.forEach(child => {
  child.on('error', error => {
    console.error(error)
    process.exitCode = 1
    stop()
  })
  child.on('exit', (code, signal) => {
    if (!stopping) {
      process.exitCode = code ?? (signal ? 1 : 0)
      stop()
    }
  })
})

process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))