const COLOR_MAP = {
  black: '#0a0a0a', noir: '#0a0a0a', jet: '#000000',
  white: '#ffffff', ivory: '#f5efe6', cream: '#f5efe6', offwhite: '#f5efe6', 'off white': '#f5efe6', beige: '#d9c7a2', sand: '#d9c7a2', taupe: '#bda58a', stone: '#8d8a7d', ash: '#8d8a7d', grey: '#808080', gray: '#808080', silver: '#c0c0c0', charcoal: '#333333',
  navy: '#1e2a44', 'midnight blue': '#1a1a2e', blue: '#3d5a80', denim: '#4f6d8d', sky: '#8bb8d7', teal: '#2a6f6b', mint: '#9ec8b5', sage: '#a3b18a', olive: '#556b2f', 'olive green': '#556b2f', green: '#2e7d32', 'dark green': '#006400', 'forest green': '#228b22', emerald: '#046a38',
  burgundy: '#800020', maroon: '#800000', wine: '#7b1e2b', red: '#b0202e', ruby: '#9b1c31', rose: '#c98b8b', blush: '#f2d3d0', pink: '#e8b4bc', mauve: '#a37f8f', lilac: '#c8a2c8', purple: '#6b3fa0', plum: '#5d3754', lavender: '#b7a3d1',
  brown: '#5b3a1f', chocolate: '#3d2418', tan: '#b48a5b', mocha: '#4a2f1d', camel: '#b48a5b', amber: '#a86e2f', gold: '#c8a15b', champagne: '#dcc8a1', mustard: '#c99a2b', yellow: '#e5b83b', orange: '#c1622b', peach: '#f4c5a0', coral: '#d97762',
  'soft pink': '#efc4d6', 'dusty rose': '#c8909e', 'dusty blue': '#8aa8bf', 'light beige': '#f1e4d0', 'warm ivory': '#f4e9dd', 'ivory white': '#f9f6f1'
}

export function normalizeColorKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function resolveColorValue(value) {
  const raw = String(value ?? '').trim()

  if (!raw) return '#8b7b5a'
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw
  if (/^(rgb|hsl)a?\(/i.test(raw)) return raw

  const key = normalizeColorKey(raw)
  if (COLOR_MAP[key]) return COLOR_MAP[key]

  const compactKey = key.replace(/\s+/g, '')
  if (COLOR_MAP[compactKey]) return COLOR_MAP[compactKey]

  if (typeof document !== 'undefined') {
    const tester = document.createElement('div')
    tester.style.color = raw
    if (tester.style.color) return tester.style.color

    tester.style.color = compactKey
    if (tester.style.color) return tester.style.color
  }

  return '#8b7b5a'
}
