export const SALE_DISCOUNT_THRESHOLD = 2200
export const SALE_DISCOUNT_RATE = 0.1
export const TSHIRT_DISCOUNT_RATE = 0.4

function isTshirtItem(item = {}) {
  const haystack = [
    item?.name,
    item?.collection,
    item?.category,
    item?.slug,
    item?.product?.name,
    item?.product?.collection,
    item?.product?.slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return /t-?shirt|tshirt|tee/.test(haystack)
}

export function calculateBill(items = [], shipping = 0) {
  const allItems = Array.isArray(items) ? items : []
  const tshirtItems = allItems.filter(isTshirtItem)
  const otherItems = allItems.filter((item) => !isTshirtItem(item))

  const subtotal = allItems.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.qty) || 0), 0)
  const tshirtSubtotal = tshirtItems.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.qty) || 0), 0)
  const otherSubtotal = otherItems.reduce((sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.qty) || 0), 0)

  const tshirtDiscount = tshirtSubtotal * TSHIRT_DISCOUNT_RATE
  const otherDiscount = otherSubtotal > SALE_DISCOUNT_THRESHOLD ? otherSubtotal * SALE_DISCOUNT_RATE : 0
  const discount = tshirtDiscount + otherDiscount
  const shippingTotal = Number(shipping) || 0

  return {
    subtotal,
    discount,
    shipping: shippingTotal,
    total: subtotal - discount + shippingTotal,
    discountEligible: discount > 0,
  }
}