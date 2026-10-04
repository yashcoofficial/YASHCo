import test from 'node:test'
import assert from 'node:assert/strict'

test('applies no sale discount for any order', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')
  const bill = calculateBill([{ price: 2500, qty: 1 }], 100)

  assert.deepEqual(bill, {
    subtotal: 2500,
    discount: 0,
    shipping: 100,
    total: 2600,
    discountEligible: false,
  })
})

test('applies no T-shirt offer and keeps totals unchanged', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')
  const bill = calculateBill([
    { name: 'Classic Cotton T-Shirt', price: 1500, qty: 1 },
    { name: 'Oxford Shirt', price: 1500, qty: 1 },
  ], 0)

  assert.deepEqual(bill, {
    subtotal: 3000,
    discount: 0,
    shipping: 0,
    total: 3000,
    discountEligible: false,
  })
})

test('does not apply any promotional discount thresholds', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')

  assert.equal(calculateBill([{ price: 2200, qty: 1 }]).discount, 0)
  assert.equal(calculateBill([{ price: 1100, qty: 2 }]).total, 2200)
  assert.equal(calculateBill([{ price: 2500, qty: 1 }]).discountEligible, false)
})