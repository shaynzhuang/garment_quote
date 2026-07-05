// src/image.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeResizedDimensions } = require('./image.js');

test('keeps original size when already narrower than max width', () => {
  assert.deepEqual(computeResizedDimensions(400, 300, 800), { width: 400, height: 300 });
});

test('scales down proportionally when wider than max width', () => {
  assert.deepEqual(computeResizedDimensions(1600, 800, 800), { width: 800, height: 400 });
});
