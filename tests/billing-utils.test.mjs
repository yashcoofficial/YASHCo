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

test('YASH15 requires a valid code and subtotal above 4999', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')

  assert.equal(calculateBill([{ price: 5000, qty: 1 }], 0).discount, 0)
  assert.equal(calculateBill([{ price: 4999, qty: 1 }], 0, 'YASH15').discountEligible, false)
  assert.equal(calculateBill([{ price: 5000, qty: 1 }], 0, 'OTHER15').discountEligible, false)
})

test('YASH15 discounts merchandise subtotal and preserves shipping', async () => {
  const { calculateBill } = await import('../lib/billing-utils.mjs')
  const bill = calculateBill([{ price: 5000, qty: 1 }], 120, ' yash15 ')

  assert.deepEqual(bill, {
    subtotal: 5000,
    discount: 750,
    shipping: 120,
    total: 4370,
    discountEligible: true,
  })
})

test('uses offer prices in the subtotal and calculates the percent off', async () => {
  const { calculateBill, getDiscountPercentage } = await import('../lib/billing-utils.mjs')
  const product = { price: 2000, salePrice: 1500, qty: 2 }
  const bill = calculateBill([product], 100)

  assert.equal(getDiscountPercentage(product), 25)
  assert.deepEqual(bill, {
    subtotal: 3000,
    discount: 0,
    shipping: 100,
    total: 3100,
    discountEligible: false,
  })
})