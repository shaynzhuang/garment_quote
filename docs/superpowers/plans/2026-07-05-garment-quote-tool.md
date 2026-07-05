# 手机报价小工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个单文件 `index.html`，用于手机端针织/毛衣工厂紧急报价：填成本项、实时算总价、保存历史记录、导出真正的 .xlsx。

**Architecture:** 开发时把逻辑拆成可测试的纯 JS 模块（计算、历史存储、导出行构造、图片缩放尺寸计算）放在 `src/` 下，用 Node 内置测试器验证；DOM 交互层（`app.js`）和最终 HTML 结构不写单元测试，改用浏览器预览工具手工走一遍验证。最后用一个不依赖 npm 包的小构建脚本 `build.js` 把所有脚本内联进 `src/index.template.html`，生成仓库根目录的 `index.html` 作为唯一交付物。

**Tech Stack:** 纯原生 JS/HTML/CSS，无框架；Node.js 内置 `node:test` + `node:assert/strict` 做单元测试（不引入任何 npm 依赖）；vendored SheetJS (`xlsx.full.min.js`，来自官方 `cdn.sheetjs.com`) 用于生成 .xlsx；浏览器 `localStorage` 做持久化。

## Global Constraints

- 设计依据：`docs/superpowers/specs/2026-07-05-garment-quote-tool-design.md`，字段名、开关默认值、公式顺序（先加利润再乘税率）均以该文档为准，不重新讨论。
- 最终交付物是**一个自包含的 `index.html`**（仓库根目录），由 `build.js` 从 `src/` 生成；`src/` 下的源文件才是编辑对象，`index.html` 不手工编辑。
- 所有可测的计算/数据转换逻辑必须是纯函数，放进 `src/*.js`，同时兼容浏览器（挂到 `globalThis.XXX` 命名空间）和 Node（`module.exports`），用同一份代码、同一套测试跑两边。
- 测试用 `node --test src/`（Node 22.19.0 已确认支持），不引入 Jest/Mocha 等 npm 依赖。
- SheetJS 库整份 vendor 进 `src/vendor/xlsx.min.js`（来自 `https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js`），不通过 CDN 在线加载，保证离线可用。
- 移动端交互：所有数值输入用 `inputmode="decimal"`；开关用 checkbox 模拟的 toggle switch。
- 每个任务完成后提交一次 git commit。

---

### Task 1: 计算公式模块 (calc.js)

**Files:**
- Create: `src/calc.js`
- Test: `src/calc.test.js`

**Interfaces:**
- Produces: `GarmentCalc.computeMaterialCost(weightGrams, yarnPricePerKg)`, `GarmentCalc.computeMachineCost(minutes, ratePerMinute)`, `GarmentCalc.sumCraftItems(items)`, `GarmentCalc.computeSubtotal(fields)`, `GarmentCalc.computeTotal(subtotal, options)` — 供 Task 6 (app.js) 消费。

- [ ] **Step 1: 写失败的测试**
```js
// src/calc.test.js
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
```

- [ ] **Step 2: 运行测试，确认失败**
Run: `node --test src/calc.test.js`
Expected: FAIL，报错 `Cannot find module './calc.js'`

- [ ] **Step 3: 写最小实现**
```js
// src/calc.js
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
```

- [ ] **Step 4: 运行测试，确认通过**
Run: `node --test src/calc.test.js`
Expected: PASS，7 个测试全绿

- [ ] **Step 5: 提交**
```bash
git add src/calc.js src/calc.test.js
git commit -m "Add calc.js: pure quote calculation functions with tests"
```

---

### Task 2: 历史记录存储模块 (storage.js)

**Files:**
- Create: `src/storage.js`
- Test: `src/storage.test.js`

**Interfaces:**
- Produces: `GarmentStorage.createStorage(backend?)` returning `{ listRecords(), saveRecord(record), deleteRecord(id) }` — 供 Task 6 (app.js) 消费。

- [ ] **Step 1: 写失败的测试**
```js
// src/storage.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStorage } = require('./storage.js');

function createMemoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key)
  };
}

test('listRecords returns empty array when nothing saved', () => {
  const storage = createStorage(createMemoryBackend());
  assert.deepEqual(storage.listRecords(), []);
});

test('saveRecord adds a record with generated id and savedAt, newest first', () => {
  const storage = createStorage(createMemoryBackend());
  storage.saveRecord({ styleNo: 'A001', total: 100 });
  storage.saveRecord({ styleNo: 'A002', total: 200 });
  const records = storage.listRecords();
  assert.equal(records.length, 2);
  assert.equal(records[0].styleNo, 'A002');
  assert.ok(records[0].id);
  assert.ok(records[0].savedAt);
});

test('deleteRecord removes only the matching record', () => {
  const storage = createStorage(createMemoryBackend());
  const r1 = storage.saveRecord({ styleNo: 'A001', total: 100 });
  storage.saveRecord({ styleNo: 'A002', total: 200 });
  storage.deleteRecord(r1.id);
  const records = storage.listRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].styleNo, 'A002');
});
```

- [ ] **Step 2: 运行测试，确认失败**
Run: `node --test src/storage.test.js`
Expected: FAIL，`Cannot find module './storage.js'`

- [ ] **Step 3: 写最小实现**
```js
// src/storage.js
const STORAGE_KEY = 'garmentQuoteHistory';

function createStorage(backend) {
  const store = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) throw new Error('No storage backend available');

  function listRecords() {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  }

  function saveRecord(record) {
    const records = listRecords();
    const newRecord = Object.assign({}, record, {
      id: record.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: record.savedAt || new Date().toISOString()
    });
    records.unshift(newRecord);
    store.setItem(STORAGE_KEY, JSON.stringify(records));
    return newRecord;
  }

  function deleteRecord(id) {
    const records = listRecords().filter((r) => r.id !== id);
    store.setItem(STORAGE_KEY, JSON.stringify(records));
    return records;
  }

  return { listRecords, saveRecord, deleteRecord };
}

const GarmentStorage = { createStorage, STORAGE_KEY };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentStorage;
} else {
  globalThis.GarmentStorage = GarmentStorage;
}
```

- [ ] **Step 4: 运行测试，确认通过**
Run: `node --test src/storage.test.js`
Expected: PASS，3 个测试全绿

- [ ] **Step 5: 提交**
```bash
git add src/storage.js src/storage.test.js
git commit -m "Add storage.js: localStorage-backed history CRUD with tests"
```

---

### Task 3: 图片压缩尺寸计算模块 (image.js)

**Files:**
- Create: `src/image.js`
- Test: `src/image.test.js`

**Interfaces:**
- Produces: `GarmentImage.computeResizedDimensions(width, height, maxWidth)`（纯函数，单测）, `GarmentImage.compressImageFile(file, maxWidth, quality)`（浏览器专用，Task 8 手工验证）— 供 Task 6 (app.js) 消费。

- [ ] **Step 1: 写失败的测试**
```js
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
```

- [ ] **Step 2: 运行测试，确认失败**
Run: `node --test src/image.test.js`
Expected: FAIL，`Cannot find module './image.js'`

- [ ] **Step 3: 写最小实现**
```js
// src/image.js
function computeResizedDimensions(width, height, maxWidth) {
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * ratio) };
}

function compressImageFile(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('图片加载失败'));
      img.onload = () => {
        const { width, height } = computeResizedDimensions(img.width, img.height, maxWidth || 800);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const GarmentImage = { computeResizedDimensions, compressImageFile };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentImage;
} else {
  globalThis.GarmentImage = GarmentImage;
}
```

- [ ] **Step 4: 运行测试，确认通过**
Run: `node --test src/image.test.js`
Expected: PASS，2 个测试全绿

- [ ] **Step 5: 提交**
```bash
git add src/image.js src/image.test.js
git commit -m "Add image.js: resize dimension calc with tests, plus browser compression helper"
```

---

### Task 4: Vendor SheetJS + 导出行构造模块 (export.js)

**Files:**
- Create: `src/vendor/xlsx.min.js` (vendored, not hand-written)
- Create: `src/export.js`
- Test: `src/export.test.js`

**Interfaces:**
- Consumes: 全局 `XLSX`（由 `src/vendor/xlsx.min.js` 提供，仅浏览器运行时）
- Produces: `GarmentExport.buildExportRows(records)`（纯函数，单测）, `GarmentExport.exportRecordsToXlsx(records, filename)`（浏览器专用，Task 8 手工验证）

- [ ] **Step 1: Vendor SheetJS 库**
```bash
mkdir -p src/vendor
curl -s https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js -o src/vendor/xlsx.min.js
ls -la src/vendor/xlsx.min.js
```
Expected: 文件生成，大小约 900KB~1MB，首行为 `/*! xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com */`

- [ ] **Step 2: 写失败的测试**
```js
// src/export.test.js
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
    savedAt: '2026-07-05T10:00:00.000Z', styleNo: 'A001',
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
    '日期', '款号', '重量(克)', '纱线单价(元/公斤)', '织机时长(分钟)', '织机单价(元/分钟)',
    '缝盘(元)', '辅料(元)', '后整(元)', '工艺明细',
    '材料开关', '织机开关', '缝盘开关', '辅料开关', '后整开关', '工艺开关',
    '利润(元)', '利润开关', '税率', '税开关', '总价(元)'
  ]);
  assert.equal(rows[1][0], '2026-07-05');
  assert.equal(rows[1][1], 'A001');
  assert.equal(rows[1][9], '纽扣15');
  assert.equal(rows[1][10], '开');
  assert.equal(rows[1][13], '关');
  assert.equal(rows[1][20], 135.6);
});
```

- [ ] **Step 3: 运行测试，确认失败**
Run: `node --test src/export.test.js`
Expected: FAIL，`Cannot find module './export.js'`

- [ ] **Step 4: 写最小实现**
```js
// src/export.js
function onOffText(flag) {
  return flag ? '开' : '关';
}

function formatCraftItems(items) {
  return (items || []).map((item) => `${item.name}${item.amount}`).join('/');
}

function buildExportRows(records) {
  const header = [
    '日期', '款号', '重量(克)', '纱线单价(元/公斤)', '织机时长(分钟)', '织机单价(元/分钟)',
    '缝盘(元)', '辅料(元)', '后整(元)', '工艺明细',
    '材料开关', '织机开关', '缝盘开关', '辅料开关', '后整开关', '工艺开关',
    '利润(元)', '利润开关', '税率', '税开关', '总价(元)'
  ];
  const rows = (records || []).map((r) => [
    r.savedAt ? r.savedAt.slice(0, 10) : '',
    r.styleNo || '',
    r.weightGrams, r.yarnPricePerKg, r.minutes, r.ratePerMinute,
    r.sewingCost, r.auxCost, r.finishingCost, formatCraftItems(r.craftItems),
    onOffText(r.materialOn), onOffText(r.machineOn), onOffText(r.sewingOn),
    onOffText(r.auxOn), onOffText(r.finishingOn), onOffText(r.craftsOn),
    r.profit, onOffText(r.profitOn), r.taxRate, onOffText(r.taxOn),
    Math.round((Number(r.total) + Number.EPSILON) * 100) / 100
  ]);
  return [header, ...rows];
}

function exportRecordsToXlsx(records, filename) {
  const rows = buildExportRows(records);
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '报价记录');
  XLSX.writeFile(workbook, filename || `报价记录_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

const GarmentExport = { buildExportRows, formatCraftItems, onOffText, exportRecordsToXlsx };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentExport;
} else {
  globalThis.GarmentExport = GarmentExport;
}
```

- [ ] **Step 5: 运行测试，确认通过**
Run: `node --test src/export.test.js`
Expected: PASS，3 个测试全绿

- [ ] **Step 6: 提交**
```bash
git add src/vendor/xlsx.min.js src/export.js src/export.test.js
git commit -m "Vendor SheetJS and add export.js: xlsx row builder with tests"
```

---

### Task 5: 页面结构与样式 (index.template.html)

**Files:**
- Create: `src/index.template.html`

**Interfaces:**
- Consumes: 无（纯标记+样式）
- Produces: DOM 元素 id/class 约定，供 Task 6 (app.js) 通过 `document.getElementById` 消费：`page-quote`/`page-history` 两个 tab 页，`photo-box`/`photo-input`/`photo-preview`/`photo-placeholder`，`styleNo`，`weightGrams`/`yarnPricePerKg`/`materialOn`，`minutes`/`ratePerMinute`/`machineOn`，`sewingCost`/`sewingOn`，`auxCost`/`auxOn`，`finishingCost`/`finishingOn`，`craftsOn`/`craft-list`/`add-craft-btn`，`profit`/`profitOn`，`taxRate`/`taxOn`，`total-display`/`save-btn`，`history-list`/`history-empty`/`export-btn`，占位符 `<!-- APP_SCRIPTS -->`。

- [ ] **Step 1: 写页面结构与样式**
```html
<!-- src/index.template.html -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>报价小工具</title>
<style>
  :root { --accent: #2563eb; --bg: #f5f5f7; --border: #ddd; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif; background: var(--bg); color: #111; padding-bottom: 90px; }
  .tabs { display: flex; position: sticky; top: 0; background: #fff; border-bottom: 1px solid var(--border); z-index: 10; }
  .tab-btn { flex: 1; padding: 14px; text-align: center; border: none; background: none; font-size: 16px; }
  .tab-btn.active { color: var(--accent); font-weight: 600; border-bottom: 2px solid var(--accent); }
  .page { display: none; padding: 12px; }
  .page.active { display: block; }
  .field-row { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
  .field-row .label { font-size: 14px; color: #333; width: 120px; flex-shrink: 0; }
  .field-row input[type=text], .field-row input[type=number] { flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 8px; font-size: 16px; min-width: 0; margin-right: 8px; }
  .field-row.off input[type=text], .field-row.off input[type=number] { opacity: .4; }
  .switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; inset: 0; background: #ccc; border-radius: 24px; transition: .2s; cursor: pointer; }
  .slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; }
  .switch input:checked + .slider { background: var(--accent); }
  .switch input:checked + .slider::before { transform: translateX(20px); }
  .photo-box { width: 120px; height: 120px; border: 1px dashed #999; border-radius: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 12px; background: #fff; }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; }
  .craft-row { display: flex; gap: 8px; margin-bottom: 6px; }
  .craft-list.off { opacity: .4; }
  .craft-row input[type=text] { flex: 2; border: 1px solid var(--border); border-radius: 8px; padding: 8px; font-size: 16px; }
  .craft-row input[type=number] { flex: 1; border: 1px solid var(--border); border-radius: 8px; padding: 8px; font-size: 16px; }
  .craft-row button { border: none; background: #f3d1d1; border-radius: 8px; padding: 0 12px; }
  .add-craft-btn { width: 100%; padding: 10px; border: 1px dashed var(--accent); background: none; color: var(--accent); border-radius: 8px; margin-bottom: 8px; }
  .section-title { font-size: 13px; color: #888; margin: 16px 0 6px; }
  .bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid var(--border); padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
  .bottom-bar .total { font-size: 22px; font-weight: 700; color: var(--accent); }
  .bottom-bar button { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 12px 18px; font-size: 15px; }
  .history-item { display: flex; gap: 10px; background: #fff; border-radius: 10px; padding: 10px; margin-bottom: 8px; align-items: center; }
  .history-item img { width: 56px; height: 56px; object-fit: cover; border-radius: 8px; background: #eee; }
  .history-item .info { flex: 1; }
  .history-item .info .style { font-weight: 600; }
  .history-item .info .meta { font-size: 12px; color: #888; }
  .history-item .total { font-weight: 700; color: var(--accent); margin-right: 8px; }
  .history-item .delete-btn { border: none; background: #f3d1d1; border-radius: 8px; padding: 8px 10px; }
  .export-btn { width: 100%; padding: 12px; border: none; background: var(--accent); color: #fff; border-radius: 8px; margin-bottom: 12px; font-size: 15px; }
  .empty-hint { text-align: center; color: #999; padding: 30px 0; }
</style>
</head>
<body>
  <div class="tabs">
    <button class="tab-btn active" data-tab="quote">报价</button>
    <button class="tab-btn" data-tab="history">历史</button>
  </div>

  <div class="page active" id="page-quote">
    <div class="photo-box" id="photo-box">
      <span id="photo-placeholder">点击拍照</span>
      <img id="photo-preview" style="display:none">
    </div>
    <input type="file" id="photo-input" accept="image/*" capture="environment" style="display:none">

    <div class="field-row">
      <span class="label">款号/备注</span>
      <input type="text" id="styleNo" placeholder="如 A001">
    </div>

    <div class="section-title">材料</div>
    <div class="field-row" id="row-material">
      <span class="label">重量(克)</span>
      <input type="number" inputmode="decimal" id="weightGrams">
      <label class="switch"><input type="checkbox" id="materialOn" checked><span class="slider"></span></label>
    </div>
    <div class="field-row" id="row-material2">
      <span class="label">纱线单价(元/公斤)</span>
      <input type="number" inputmode="decimal" id="yarnPricePerKg">
    </div>

    <div class="section-title">织机</div>
    <div class="field-row" id="row-machine">
      <span class="label">织机时长(分钟)</span>
      <input type="number" inputmode="decimal" id="minutes">
      <label class="switch"><input type="checkbox" id="machineOn" checked><span class="slider"></span></label>
    </div>
    <div class="field-row" id="row-machine2">
      <span class="label">织机单价(元/分钟)</span>
      <input type="number" inputmode="decimal" id="ratePerMinute">
    </div>

    <div class="section-title">加工</div>
    <div class="field-row" id="row-sewing">
      <span class="label">缝盘(元)</span>
      <input type="number" inputmode="decimal" id="sewingCost">
      <label class="switch"><input type="checkbox" id="sewingOn" checked><span class="slider"></span></label>
    </div>
    <div class="field-row" id="row-aux">
      <span class="label">辅料(元)</span>
      <input type="number" inputmode="decimal" id="auxCost">
      <label class="switch"><input type="checkbox" id="auxOn" checked><span class="slider"></span></label>
    </div>
    <div class="field-row" id="row-finishing">
      <span class="label">后整(元)</span>
      <input type="number" inputmode="decimal" id="finishingCost">
      <label class="switch"><input type="checkbox" id="finishingOn" checked><span class="slider"></span></label>
    </div>

    <div class="section-title">
      工艺
      <label class="switch" style="float:right"><input type="checkbox" id="craftsOn" checked><span class="slider"></span></label>
    </div>
    <div id="craft-list" class="craft-list"></div>
    <button type="button" class="add-craft-btn" id="add-craft-btn">＋添加工艺</button>

    <div class="section-title">利润</div>
    <div class="field-row" id="row-profit">
      <span class="label">利润(元)</span>
      <input type="number" inputmode="decimal" id="profit" value="0">
      <label class="switch"><input type="checkbox" id="profitOn"><span class="slider"></span></label>
    </div>

    <div class="section-title">税</div>
    <div class="field-row" id="row-tax">
      <span class="label">税率</span>
      <input type="number" inputmode="decimal" id="taxRate" value="0.13" step="0.01">
      <label class="switch"><input type="checkbox" id="taxOn" checked><span class="slider"></span></label>
    </div>
  </div>

  <div class="page" id="page-history">
    <button type="button" class="export-btn" id="export-btn">导出Excel</button>
    <div id="history-list"></div>
    <div class="empty-hint" id="history-empty" style="display:none">暂无历史记录</div>
  </div>

  <div class="bottom-bar">
    <span class="total" id="total-display">￥0.00</span>
    <button type="button" id="save-btn">保存记录</button>
  </div>

  <!-- APP_SCRIPTS -->
</body>
</html>
```

- [ ] **Step 2: 提交**
```bash
git add src/index.template.html
git commit -m "Add HTML structure and CSS for quote/history tabs"
```

---

### Task 6: 交互逻辑 (app.js)

**Files:**
- Create: `src/app.js`

**Interfaces:**
- Consumes: `GarmentCalc`（Task 1）、`GarmentStorage`（Task 2）、`GarmentImage`（Task 3）、`GarmentExport`（Task 4）、`src/index.template.html` 的 DOM id（Task 5）
- Produces: 页面运行时行为，最终由 Task 7 内联进 `index.html`

- [ ] **Step 1: 写交互逻辑**
```js
// src/app.js
(function () {
  const { computeSubtotal, computeTotal } = GarmentCalc;
  const { createStorage } = GarmentStorage;
  const { compressImageFile } = GarmentImage;
  const { exportRecordsToXlsx } = GarmentExport;

  const storage = createStorage();

  const els = {
    tabs: document.querySelectorAll('.tab-btn'),
    pages: { quote: document.getElementById('page-quote'), history: document.getElementById('page-history') },
    photoBox: document.getElementById('photo-box'),
    photoInput: document.getElementById('photo-input'),
    photoPreview: document.getElementById('photo-preview'),
    photoPlaceholder: document.getElementById('photo-placeholder'),
    styleNo: document.getElementById('styleNo'),
    weightGrams: document.getElementById('weightGrams'),
    yarnPricePerKg: document.getElementById('yarnPricePerKg'),
    materialOn: document.getElementById('materialOn'),
    minutes: document.getElementById('minutes'),
    ratePerMinute: document.getElementById('ratePerMinute'),
    machineOn: document.getElementById('machineOn'),
    sewingCost: document.getElementById('sewingCost'),
    sewingOn: document.getElementById('sewingOn'),
    auxCost: document.getElementById('auxCost'),
    auxOn: document.getElementById('auxOn'),
    finishingCost: document.getElementById('finishingCost'),
    finishingOn: document.getElementById('finishingOn'),
    craftsOn: document.getElementById('craftsOn'),
    craftList: document.getElementById('craft-list'),
    addCraftBtn: document.getElementById('add-craft-btn'),
    profit: document.getElementById('profit'),
    profitOn: document.getElementById('profitOn'),
    taxRate: document.getElementById('taxRate'),
    taxOn: document.getElementById('taxOn'),
    totalDisplay: document.getElementById('total-display'),
    saveBtn: document.getElementById('save-btn'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    exportBtn: document.getElementById('export-btn')
  };

  let currentPhotoDataUrl = '';

  function addCraftRow(name, amount) {
    const row = document.createElement('div');
    row.className = 'craft-row';
    row.innerHTML =
      '<input type="text" class="craft-name" placeholder="名称,如纽扣">' +
      '<input type="number" inputmode="decimal" class="craft-amount" placeholder="金额">' +
      '<button type="button" class="craft-remove">删</button>';
    row.querySelector('.craft-name').value = name || '';
    row.querySelector('.craft-amount').value = amount != null ? amount : '';
    row.querySelector('.craft-name').addEventListener('input', recalc);
    row.querySelector('.craft-amount').addEventListener('input', recalc);
    row.querySelector('.craft-remove').addEventListener('click', () => {
      row.remove();
      recalc();
    });
    els.craftList.appendChild(row);
  }

  function readCraftItems() {
    return Array.from(els.craftList.querySelectorAll('.craft-row')).map((row) => ({
      name: row.querySelector('.craft-name').value,
      amount: Number(row.querySelector('.craft-amount').value) || 0
    }));
  }

  function readFields() {
    return {
      materialOn: els.materialOn.checked,
      weightGrams: Number(els.weightGrams.value) || 0,
      yarnPricePerKg: Number(els.yarnPricePerKg.value) || 0,
      machineOn: els.machineOn.checked,
      minutes: Number(els.minutes.value) || 0,
      ratePerMinute: Number(els.ratePerMinute.value) || 0,
      sewingOn: els.sewingOn.checked,
      sewingCost: Number(els.sewingCost.value) || 0,
      auxOn: els.auxOn.checked,
      auxCost: Number(els.auxCost.value) || 0,
      finishingOn: els.finishingOn.checked,
      finishingCost: Number(els.finishingCost.value) || 0,
      craftsOn: els.craftsOn.checked,
      craftItems: readCraftItems()
    };
  }

  function readTotalOptions() {
    return {
      profitOn: els.profitOn.checked,
      profit: Number(els.profit.value) || 0,
      taxOn: els.taxOn.checked,
      taxRate: Number(els.taxRate.value) || 0
    };
  }

  function setRowOff(rowId, off) {
    const row = document.getElementById(rowId);
    if (row) row.classList.toggle('off', off);
  }

  function recalc() {
    const fields = readFields();
    const totalOptions = readTotalOptions();
    const subtotal = computeSubtotal(fields);
    const total = computeTotal(subtotal, totalOptions);
    els.totalDisplay.textContent = '￥' + total.toFixed(2);

    setRowOff('row-material', !fields.materialOn);
    setRowOff('row-material2', !fields.materialOn);
    setRowOff('row-machine', !fields.machineOn);
    setRowOff('row-machine2', !fields.machineOn);
    setRowOff('row-sewing', !fields.sewingOn);
    setRowOff('row-aux', !fields.auxOn);
    setRowOff('row-finishing', !fields.finishingOn);
    els.craftList.classList.toggle('off', !fields.craftsOn);
    setRowOff('row-profit', !totalOptions.profitOn);
    setRowOff('row-tax', !totalOptions.taxOn);

    return { fields, totalOptions, subtotal, total };
  }

  function switchTab(name) {
    els.tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === name));
    Object.keys(els.pages).forEach((key) => els.pages[key].classList.toggle('active', key === name));
    if (name === 'history') renderHistory();
  }

  function renderHistory() {
    const records = storage.listRecords();
    els.historyList.innerHTML = '';
    els.historyEmpty.style.display = records.length ? 'none' : 'block';
    records.forEach((record) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML =
        '<img src="' + (record.photo || '') + '">' +
        '<div class="info"><div class="style"></div><div class="meta"></div></div>' +
        '<span class="total"></span>' +
        '<button type="button" class="delete-btn">删除</button>';
      item.querySelector('.style').textContent = record.styleNo || '(未命名)';
      item.querySelector('.meta').textContent = (record.savedAt || '').slice(0, 10);
      item.querySelector('.total').textContent = '￥' + Number(record.total).toFixed(2);
      item.querySelector('.delete-btn').addEventListener('click', () => {
        storage.deleteRecord(record.id);
        renderHistory();
      });
      els.historyList.appendChild(item);
    });
  }

  els.tabs.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  els.photoBox.addEventListener('click', () => els.photoInput.click());
  els.photoInput.addEventListener('change', async () => {
    const file = els.photoInput.files[0];
    if (!file) return;
    currentPhotoDataUrl = await compressImageFile(file, 800, 0.8);
    els.photoPreview.src = currentPhotoDataUrl;
    els.photoPreview.style.display = 'block';
    els.photoPlaceholder.style.display = 'none';
  });

  els.addCraftBtn.addEventListener('click', () => addCraftRow('', ''));

  [
    els.styleNo, els.weightGrams, els.yarnPricePerKg, els.materialOn,
    els.minutes, els.ratePerMinute, els.machineOn,
    els.sewingCost, els.sewingOn, els.auxCost, els.auxOn,
    els.finishingCost, els.finishingOn, els.craftsOn,
    els.profit, els.profitOn, els.taxRate, els.taxOn
  ].forEach((el) => el.addEventListener('input', recalc));

  els.saveBtn.addEventListener('click', () => {
    const { fields, totalOptions, subtotal, total } = recalc();
    storage.saveRecord({
      styleNo: els.styleNo.value,
      photo: currentPhotoDataUrl,
      weightGrams: fields.weightGrams, yarnPricePerKg: fields.yarnPricePerKg, materialOn: fields.materialOn,
      minutes: fields.minutes, ratePerMinute: fields.ratePerMinute, machineOn: fields.machineOn,
      sewingCost: fields.sewingCost, sewingOn: fields.sewingOn,
      auxCost: fields.auxCost, auxOn: fields.auxOn,
      finishingCost: fields.finishingCost, finishingOn: fields.finishingOn,
      craftItems: fields.craftItems, craftsOn: fields.craftsOn,
      profit: totalOptions.profit, profitOn: totalOptions.profitOn,
      taxRate: totalOptions.taxRate, taxOn: totalOptions.taxOn,
      subtotal, total
    });
    alert('已保存到历史记录');
  });

  els.exportBtn.addEventListener('click', () => {
    const records = storage.listRecords();
    if (!records.length) {
      alert('暂无记录可导出');
      return;
    }
    exportRecordsToXlsx(records);
  });

  recalc();
})();
```

- [ ] **Step 2: 提交**
```bash
git add src/app.js
git commit -m "Add app.js: wire calc/storage/image/export modules to the DOM"
```

---

### Task 7: 构建脚本 (build.js)，生成最终 index.html

**Files:**
- Create: `build.js`
- Create: `package.json`
- Generate: `index.html`（仓库根目录，交付物）

**Interfaces:**
- Consumes: `src/index.template.html`（Task 5）、`src/calc.js`/`src/storage.js`/`src/image.js`/`src/export.js`/`src/vendor/xlsx.min.js`/`src/app.js`（Tasks 1-4, 6）
- Produces: 仓库根目录的 `index.html`

- [ ] **Step 1: 写构建脚本**
```js
// build.js
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const templatePath = path.join(srcDir, 'index.template.html');
const outputPath = path.join(__dirname, 'index.html');

const scriptFiles = ['calc.js', 'storage.js', 'image.js', 'export.js', 'vendor/xlsx.min.js', 'app.js'];

const template = fs.readFileSync(templatePath, 'utf8');
const scripts = scriptFiles
  .map((file) => `<script>\n${fs.readFileSync(path.join(srcDir, file), 'utf8')}\n</script>`)
  .join('\n');

if (!template.includes('<!-- APP_SCRIPTS -->')) {
  throw new Error('Template is missing the <!-- APP_SCRIPTS --> placeholder');
}

const output = template.replace('<!-- APP_SCRIPTS -->', scripts);
fs.writeFileSync(outputPath, output, 'utf8');
console.log(`Built ${outputPath} (${(output.length / 1024).toFixed(0)} KB)`);
```

- [ ] **Step 2: 写最小 package.json**
```json
{
  "name": "garment-quote-tool",
  "private": true,
  "scripts": {
    "test": "node --test src/",
    "build": "node build.js"
  }
}
```

- [ ] **Step 3: 运行构建，确认生成文件**
Run: `node build.js`
Expected: 输出 `Built /Users/shayn/cc/garment_quote/index.html (约 950~1000 KB)`，且 `index.html` 存在

- [ ] **Step 4: 跑全部单元测试确认没有回归**
Run: `npm test`
Expected: `calc.test.js`、`storage.test.js`、`image.test.js`、`export.test.js` 全部 PASS

- [ ] **Step 5: 提交**
```bash
git add build.js package.json index.html
git commit -m "Add build script and generate self-contained index.html"
```

---

### Task 8: 浏览器端到端验证

**Files:** 无新文件，仅验证 Task 7 生成的 `index.html`

**Interfaces:** 无

- [ ] **Step 1: 启动预览服务器并打开 index.html**
用预览工具（`preview_start`，需要时先在 `.claude/launch.json` 里加一个用静态文件服务器打开仓库根目录的配置，例如 `npx serve .`）加载 `index.html`。

- [ ] **Step 2: 验证初始状态**
用 `preview_snapshot` 确认页面有"报价"/"历史"两个标签，"报价"为当前激活标签，底部悬浮总价显示 `￥0.00`。

- [ ] **Step 3: 验证实时计算**
用 `preview_fill` 依次填入：重量 500、纱线单价 40、织机时长 30、织机单价 2、缝盘 10、辅料 5、后整 8；点击"＋添加工艺"用 `preview_click`，填入名称"纽扣"、金额 15。
预期总价：材料20+织机60+缝盘10+辅料5+后整8+工艺15=118，税开(13%)、利润关 → 118×1.13=133.34。用 `preview_snapshot` 确认悬浮总价显示 `￥133.34`。

- [ ] **Step 4: 验证开关生效**
用 `preview_click` 关闭"材料"开关，预期总价变为 (118-20)×1.13=110.74，确认对应输入框视觉变灰（`preview_inspect` 检查 `#row-material` 的 opacity）。

- [ ] **Step 5: 验证保存与历史列表**
点击"保存记录"，切到"历史"标签，用 `preview_snapshot` 确认列表里出现一条记录，总价与刚才一致。

- [ ] **Step 6: 验证删除**
点击该记录的"删除"按钮，确认历史列表变为空状态提示"暂无历史记录"。

- [ ] **Step 7: 验证导出无报错**
重新保存一条记录，点击"导出Excel"，用 `preview_console_logs` 确认没有 JS 报错（浏览器下载行为本身不一定能被工具直接抓取，但至少确认 `XLSX.writeFile` 调用未抛异常）。

- [ ] **Step 8: 验证移动端视口**
用 `preview_resize` 切到 `mobile` 预设，`preview_screenshot` 截图确认布局无横向溢出、按钮可点击区域够大。

- [ ] **Step 9: 记录验证结果**
如发现问题，回到对应 Task 的源文件修复，重新跑 `node build.js` 再验证，直到全部通过。全部通过后无需额外 commit（若修复了源码则按对应文件正常提交）。

---

## Self-Review

- **Spec coverage**：设计文档中的字段、开关、公式顺序（Task 1-2）、图片压缩(Task 3)、动态工艺列表与开关可视化(Task 5-6)、历史记录 CRUD(Task 2/6)、真正 .xlsx 导出且不含图片列(Task 4/6)、移动端 `inputmode=decimal`(Task 5)、单文件交付(Task 7) 均已覆盖。
- **Placeholder scan**：所有代码块均为完整实现，无 TBD/TODO。
- **Type consistency**：`GarmentCalc`/`GarmentStorage`/`GarmentImage`/`GarmentExport` 的函数签名在 Task 1-4 定义后，在 Task 6 (app.js) 中的调用方式（参数、返回值结构）保持一致；`record` 对象字段名在 Task 2 (storage)、Task 4 (export)、Task 6 (app.js 保存时) 三处保持一致。
