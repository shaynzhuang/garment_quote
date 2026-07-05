const test = require('node:test');
const assert = require('node:assert/strict');
const { computeMaterialCost, computeMachineCost, sumCraftItems, computeSubtotal, computeTotal } = require('./calc.js');

test('computeMaterialCost converts grams to kg and multiplies by price', () => {
  assert.equal(computeMaterialCost(500, 40), 20);
});

test('computeMachineCost multiplies minutes by rate', () => {
  assert.equal(computeMachineCost(30, 2), 60);
});

test('sumCraftItems sums amounts, ignoring invalid values', () => {
  assert.equal(
    sumCraftItems([
      { name: 'buttons', amount: 15 },
      { name: 'embroidery', amount: '30' },
      { name: 'bad', amount: 'x' }
    ]),
    45
  );
});

test('computeSubtotal only includes items whose switch is on', () => {
  const fields = {
    materialOn: true, weightGrams: 500, yarnPricePerKg: 40,
    machineOn: false, minutes: 30, ratePerMinute: 2,
    sewingOn: true, sewingCost: 10,
    auxOn: false, auxCost: 5,
    finishingOn: true, finishingCost: 8,
    craftsOn: true, craftItems: [{ name: 'buttons', amount: 15 }]
  };
  // material 20 + sewing 10 + finishing 8 + crafts 15 = 53 (machine, aux off)
  assert.equal(computeSubtotal(fields), 53);
});

test('computeSubtotal excludes crafts when craftsOn is false', () => {
  const fields = {
    materialOn: false, weightGrams: 500, yarnPricePerKg: 40,
    machineOn: false, minutes: 30, ratePerMinute: 2,
    sewingOn: false, sewingCost: 10,
    auxOn: false, auxCost: 5,
    finishingOn: false, finishingCost: 8,
    craftsOn: false, craftItems: [{ name: 'buttons', amount: 15 }]
  };
  assert.equal(computeSubtotal(fields), 0);
});

test('computeTotal adds profit before applying tax', () => {
  const total = computeTotal(100, { profitOn: true, profit: 20, taxOn: true, taxRate: 0.13 });
  assert.ok(Math.abs(total - 135.6) < 1e-9);
});

test('computeTotal skips profit and tax when switches are off', () => {
  assert.equal(computeTotal(100, { profitOn: false, profit: 20, taxOn: false, taxRate: 0.13 }), 100);
});
