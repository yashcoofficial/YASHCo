import http from 'node:http'
import { dirname, resolve } from 'node:path'
import { URL } from 'node:url'
import { fileURLToPath } from 'node:url'

const serviceDirectory = dirname(fileURLToPath(import.meta.url))
process.loadEnvFile?.(resolve(serviceDirectory, '../../.env.local'))

let routeHandlers

const port = Number(process.env.API_PORT || 4000)

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const separator = value.indexOf('=')
    return separator < 0 ? [value, ''] : [value.slice(0, separator), decodeURIComponent(value.slice(separator + 1))]
  }))
}

function makeRequest(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http'
  const host = request.headers.host || `localhost:${port}`
  const url = new URL(request.url || '/', `${protocol}://${host}`)
  const chunks = []
  return new Promise((resolve, reject) => {
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      const body = chunks.length ? Buffer.concat(chunks) : undefined
      const headers = new Headers()
      for (const [name, value] of Object.entries(request.headers)) {
        if (Array.isArray(value)) value.forEach(item => headers.append(name, item))
        else if (value !== undefined) headers.set(name, value)
      }
      const webRequest = new Request(url, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method || '') ? undefined : body,
      })
      const cookies = parseCookies(request.headers.cookie)
      Object.defineProperty(webRequest, 'cookies', { value: { get: name => ({ value: cookies[name] }) } })
      resolve(webRequest)
    })
    request.on('error', reject)
  })
}

async function handle(request, response) {
  try {
    const webRequest = await makeRequest(request)
    routeHandlers ||= await import('../../app/api/[[...path]]/route.js')
    const methodHandler = routeHandlers[request.method]
    if (!methodHandler) {
      response.writeHead(405, { Allow: 'GET, POST, PUT, DELETE, PATCH' })
      response.end(JSON.stringify({ error: 'Method not allowed' }))
      return
    }
    const pathname = new URL(request.url || '/', 'http://localhost').pathname
    const path = pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const result = await methodHandler(webRequest, { params: Promise.resolve({ path }) })
    const headers = Object.fromEntries(result.headers.entries())
    response.writeHead(result.status, headers)
    response.end(await result.text())
  } catch (error) {
    console.error('API service error', error)
    response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Server error' }))
  }
}

const server = http.createServer(handle)
server.listen(port, '0.0.0.0', () => {
  console.log(`YASH API service listening on http://localhost:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
