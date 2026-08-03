export function getStockStatusText(product = {}) {
  const stock = Number(product?.stock ?? 0)
  const threshold = Number(product?.lowStockThreshold ?? 3)

  if (stock <= 0) return 'Out of stock'
  if (stock <= threshold) return `Only ${stock} left`
  return ''
}
