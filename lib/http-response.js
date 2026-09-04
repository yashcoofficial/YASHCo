function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

export const NextResponse = {
  json(data, init = {}) {
    const response = Response.json(data, init)
    response.cookies = {
      set(name, value, options) {
        response.headers.append('Set-Cookie', serializeCookie(name, value, options))
      },
    }
    return response
  },
}
