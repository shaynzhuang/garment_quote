function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function computeMaterialCost(weightGrams, yarnPricePerKg) {
  return (toNumber(weightGrams) / 1000) * toNumber(yarnPricePerKg);
}

function computeMachineCost(minutes, ratePerMinute) {
  return toNumber(minutes) * toNumber(ratePerMinute);
}

function sumCraftItems(items) {
  return (items || []).reduce((sum, item) => sum + toNumber(item.amount), 0);
}

function computeSubtotal(fields) {
  let subtotal = 0;
  if (fields.materialOn) subtotal += computeMaterialCost(fields.weightGrams, fields.yarnPricePerKg);
  if (fields.machineOn) subtotal += computeMachineCost(fields.minutes, fields.ratePerMinute);
  if (fields.sewingOn) subtotal += toNumber(fields.sewingCost);
  if (fields.auxOn) subtotal += toNumber(fields.auxCost);
  if (fields.finishingOn) subtotal += toNumber(fields.finishingCost);
  if (fields.craftsOn) subtotal += sumCraftItems(fields.craftItems);
  return subtotal;
}

function computeTotal(subtotal, options) {
  let total = toNumber(subtotal);
  if (options.profitOn) total += toNumber(options.profit);
  if (options.taxOn) total *= (1 + toNumber(options.taxRate));
  return total;
}

const GarmentCalc = { toNumber, computeMaterialCost, computeMachineCost, sumCraftItems, computeSubtotal, computeTotal };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentCalc;
} else {
  globalThis.GarmentCalc = GarmentCalc;
}
