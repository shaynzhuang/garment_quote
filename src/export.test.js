const test = require('node:test');
const assert = require('node:assert/strict');
const { buildExportRows, formatCraftItems, onOffText } = require('./export.js');

test('onOffText converts booleans to Chinese labels', () => {
  assert.equal(onOffText(true), '开');
  assert.equal(onOffText(false), '关');
});

test('formatCraftItems joins name+amount pairs with slash', () => {
  assert.equal(formatCraftItems([{ name: '纽扣', amount: 15 }, { name: '绣花', amount: 30 }]), '纽扣15/绣花30');
  assert.equal(formatCraftItems([]), '');
});

test('buildExportRows produces a header row plus one row per record', () => {
  const records = [{
    savedAt: '2026-07-05T10:00:00.000Z', customerName: '张三', styleNo: 'A001',
    weightGrams: 500, yarnPricePerKg: 40, minutes: 30, ratePerMinute: 2,
    sewingCost: 10, auxCost: 5, finishingCost: 8,
    craftItems: [{ name: '纽扣', amount: 15 }],
    materialOn: true, machineOn: true, sewingOn: true, auxOn: false, finishingOn: true, craftsOn: true,
    profit: 20, profitOn: true, taxRate: 0.13, taxOn: true,
    total: 135.6
  }];
  const rows = buildExportRows(records);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], [
    '日期', '客户名称', '款号', '重量(克)', '纱线单价(元/公斤)', '织机时长(分钟)', '织机单价(元/分钟)',
    '缝盘(元)', '辅料(元)', '后整(元)', '工艺明细',
    '材料开关', '织机开关', '缝盘开关', '辅料开关', '后整开关', '工艺开关',
    '利润(元)', '利润开关', '税率', '税开关', '总价(元)'
  ]);
  assert.equal(rows[1][0], '2026-07-05');
  assert.equal(rows[1][1], '张三');
  assert.equal(rows[1][2], 'A001');
  assert.equal(rows[1][10], '纽扣15');
  assert.equal(rows[1][11], '开');
  assert.equal(rows[1][14], '关');
  assert.equal(rows[1][21], 135.6);
});
