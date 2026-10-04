export function calculateBill(items = [], shipping = 0) {
  const allItems = Array.isArray(items) ? items : []
  const subtotal = allItems.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.qty) || 0), 0)
  const shippingTotal = Number(shipping) || 0

  return {
    subtotal,
    discount: 0,
    shipping: shippingTotal,
    total: subtotal + shippingTotal,
    discountEligible: false,
  }
}