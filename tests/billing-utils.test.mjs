import test from 'node:test'
import assert from 'node:assert/strict'

test('applies 10 percent discount only above the sale price threshold', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')
  const bill = calculateBill([{ price: 2500, qty: 1 }], 100)

  assert.deepEqual(bill, {
    subtotal: 2500,
    discount: 250,
    shipping: 100,
    total: 2350,
    discountEligible: true,
  })
})

test('applies 40 percent discount to T-shirts while keeping the other sale offer intact', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')
  const bill = calculateBill([
    { name: 'Classic Cotton T-Shirt', price: 1500, qty: 1 },
    { name: 'Oxford Shirt', price: 1500, qty: 1 },
  ], 0)

  assert.deepEqual(bill, {
    subtotal: 3000,
    discount: 600,
    shipping: 0,
    total: 2400,
    discountEligible: true,
  })
})

test('does not discount orders at or below the threshold', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')

  assert.equal(calculateBill([{ price: 2200, qty: 1 }]).discount, 0)
  assert.equal(calculateBill([{ price: 1100, qty: 2 }]).total, 2200)
})