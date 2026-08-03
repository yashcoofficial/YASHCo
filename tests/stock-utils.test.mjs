import test from 'node:test'
import assert from 'node:assert/strict'

async function loadUtils() {
  return import('../lib/stock-utils.mjs')
}

test('returns a low-stock message when stock is at or below threshold', async () => {
  const { getStockStatusText } = await loadUtils()

  assert.equal(getStockStatusText({ stock: 3, lowStockThreshold: 3 }), 'Only 3 left')
  assert.equal(getStockStatusText({ stock: 2, lowStockThreshold: 3 }), 'Only 2 left')
  assert.equal(getStockStatusText({ stock: 0, lowStockThreshold: 3 }), 'Out of stock')
})

test('returns no message when stock is above threshold', async () => {
  const { getStockStatusText } = await loadUtils()

  assert.equal(getStockStatusText({ stock: 4, lowStockThreshold: 3 }), '')
  assert.equal(getStockStatusText({ stock: 10, lowStockThreshold: 3 }), '')
})
