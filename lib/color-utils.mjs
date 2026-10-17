const COLOR_MAP = {
  black: '#171715', noir: '#171715', 'atelier black': '#171715', jet: '#000000',
  white: '#ffffff', ivory: '#f6f3ed', cream: '#f6f3ed', linen: '#f6f3ed', pearl: '#f6f3ed', offwhite: '#f6f3ed', 'off white': '#f6f3ed', 'soft white': '#f7f3ee', 'pearl white': '#f8f6f3', 'ivory white': '#f9f6f1', bone: '#e5d9c3', 'warm ivory': '#f6f3ed',
  beige: '#d9cebe', sand: '#d9cebe', 'stone beige': '#d9cebe', taupe: '#bda58a', stone: '#d9cebe', ash: '#8d8a7d', grey: '#808080', gray: '#808080', silver: '#c0c0c0', charcoal: '#393a37', 'soft charcoal': '#393a37', 'warm grey': '#8a8a8a', 'light grey': '#d3d3d3', 'light gray': '#d3d3d3',
  navy: '#1e2a44', 'midnight blue': '#1a1a2e', 'dark blue': '#00008b', blue: '#3d5a80', denim: '#4f6d8d', 'royal blue': '#4169e1', 'sky blue': '#87ceeb', 'light blue': '#add8e6', 'dusty blue': '#8aa8bf', 'powder blue': '#b0e0e6', teal: '#2a6f6b', mint: '#9ec8b5', sage: '#a3b18a', olive: '#556b2f', 'olive green': '#556b2f', green: '#2e7d32', 'dark green': '#006400', 'forest green': '#228b22', emerald: '#046a38',
  burgundy: '#800020', maroon: '#800000', wine: '#7b1e2b', red: '#b0202e', ruby: '#9b1c31', rose: '#c98b8b', blush: '#f2d3d0', pink: '#e8b4bc', mauve: '#a37f8f', lilac: '#c8a2c8', purple: '#6b3fa0', plum: '#5d3754', lavender: '#b7a3d1',
  brown: '#5b3a1f', 'espresso brown': '#46382f', chocolate: '#3d2418', tan: '#b48a5b', mocha: '#4a2f1d', camel: '#b48a5b', amber: '#a86e2f', gold: '#b49a70', 'champagne gold': '#b49a70', 'rose gold': '#b76e79', 'golden beige': '#d1b57a', champagne: '#b49a70', mustard: '#c99a2b', yellow: '#e5b83b', orange: '#c1622b', peach: '#f4c5a0', coral: '#d97762',
  'soft pink': '#efc4d6', 'dusty rose': '#c8909e', 'blush rose': '#f4d0d7', 'rose pink': '#f7c7d6', 'light beige': '#f1e4d0',
  'dark brown': '#3b2f2f', 'coffee brown': '#4b301a', 'khaki': '#b7a56d', 'olive drab': '#6b8e23'
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

export function getColorSwatches(colorNames = [], colorHexes = []) {
  const names = Array.isArray(colorNames) ? colorNames : []
  const hexes = Array.isArray(colorHexes) ? colorHexes : []

  return names.map((name, index) => {
    const exactHex = typeof hexes[index] === 'string' ? hexes[index].trim() : ''
    return exactHex || resolveColorValue(name)
  })
}
