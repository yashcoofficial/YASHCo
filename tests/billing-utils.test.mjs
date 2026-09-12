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

test('does not discount orders at or below the threshold', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')

  assert.equal(calculateBill([{ price: 2200, qty: 1 }]).discount, 0)
  assert.equal(calculateBill([{ price: 1100, qty: 2 }]).total, 2200)
})