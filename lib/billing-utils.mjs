export const SALE_DISCOUNT_THRESHOLD = 2200
export const SALE_DISCOUNT_RATE = 0.1

export function calculateBill(items = [], shipping = 0) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.qty) || 0), 0)
  const discount = subtotal > SALE_DISCOUNT_THRESHOLD ? subtotal * SALE_DISCOUNT_RATE : 0
  const shippingTotal = Number(shipping) || 0

  return {
    subtotal,
    discount,
    shipping: shippingTotal,
    total: subtotal - discount + shippingTotal,
    discountEligible: discount > 0,
  }
}