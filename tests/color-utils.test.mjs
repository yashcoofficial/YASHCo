import test from 'node:test'
import assert from 'node:assert/strict'

const { resolveColorValue } = await import('../lib/color-utils.mjs')

test('returns the exact hex for admin-provided colors', () => {
  assert.equal(resolveColorValue('#ff6600'), '#ff6600')
  assert.equal(resolveColorValue('Dark Green'), '#006400')
  assert.equal(resolveColorValue('forest green'), '#228b22')
  assert.equal(resolveColorValue('dusty rose'), '#c8909e')
  assert.equal(resolveColorValue('light blue'), '#add8e6')
  assert.equal(resolveColorValue('rose gold'), '#b76e79')
})

test('falls back only for truly unknown values', () => {
  assert.equal(resolveColorValue('unknown shade'), '#8b7b5a')
})
