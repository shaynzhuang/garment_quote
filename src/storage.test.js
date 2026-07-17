const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createStorage,
  filterRecords,
  listRecordCustomers,
  listRecordMonths,
  UNSPECIFIED_CUSTOMER
} = require('./storage.js');

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

test('saveRecord with an existing id updates that record in place instead of duplicating', () => {
  const storage = createStorage(createMemoryBackend());
  const r1 = storage.saveRecord({ styleNo: 'A001', total: 100 });
  storage.saveRecord({ styleNo: 'A002', total: 200 });
  storage.saveRecord({ id: r1.id, styleNo: 'A001-edited', total: 150 });
  const records = storage.listRecords();
  assert.equal(records.length, 2);
  assert.equal(records[0].styleNo, 'A001-edited');
  assert.equal(records[0].id, r1.id);
  assert.equal(records[1].styleNo, 'A002');
});

test('listRecords recovers to an empty array when stored data is corrupted', () => {
  const backend = createMemoryBackend();
  backend.setItem('garmentQuoteHistory', '{not valid json');
  const storage = createStorage(backend);
  assert.deepEqual(storage.listRecords(), []);
});

test('listCustomers returns empty array when nothing saved', () => {
  const storage = createStorage(createMemoryBackend());
  assert.deepEqual(storage.listCustomers(), []);
});

test('addCustomer adds a trimmed name and persists it', () => {
  const storage = createStorage(createMemoryBackend());
  storage.addCustomer('  张三  ');
  assert.deepEqual(storage.listCustomers(), ['张三']);
});

test('addCustomer does not add duplicates', () => {
  const storage = createStorage(createMemoryBackend());
  storage.addCustomer('张三');
  storage.addCustomer('张三');
  assert.deepEqual(storage.listCustomers(), ['张三']);
});

test('addCustomer ignores empty/blank names', () => {
  const storage = createStorage(createMemoryBackend());
  storage.addCustomer('');
  storage.addCustomer('   ');
  assert.deepEqual(storage.listCustomers(), []);
});

const sampleRecords = [
  { styleNo: 'A001', customerName: '张三', savedAt: '2026-07-10T08:00:00.000Z', total: 100 },
  { styleNo: 'B200', customerName: '李四', savedAt: '2026-06-05T08:00:00.000Z', total: 200 },
  { styleNo: 'A002', customerName: '张三', savedAt: '2026-07-12T08:00:00.000Z', total: 150 },
  { styleNo: 'C300', customerName: '', savedAt: '2026-05-01T08:00:00.000Z', total: 300 }
];

test('filterRecords by customer keeps only that customer', () => {
  const result = filterRecords(sampleRecords, { customer: '张三' });
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.styleNo), ['A001', 'A002']);
});

test('filterRecords with UNSPECIFIED_CUSTOMER keeps records with a blank customer name', () => {
  const records = sampleRecords.concat([{ styleNo: 'D400', customerName: '   ', savedAt: '2026-05-02T08:00:00.000Z' }]);
  const result = filterRecords(records, { customer: UNSPECIFIED_CUSTOMER });
  assert.deepEqual(result.map((r) => r.styleNo), ['C300', 'D400']);
});

test('filterRecords by month matches the year-month of savedAt', () => {
  const result = filterRecords(sampleRecords, { month: '2026-07' });
  assert.deepEqual(result.map((r) => r.styleNo), ['A001', 'A002']);
});

test('filterRecords search matches style number', () => {
  const result = filterRecords(sampleRecords, { search: 'B200' });
  assert.deepEqual(result.map((r) => r.styleNo), ['B200']);
});

test('filterRecords search matches customer name', () => {
  const result = filterRecords(sampleRecords, { search: '李四' });
  assert.deepEqual(result.map((r) => r.styleNo), ['B200']);
});

test('filterRecords search is case-insensitive substring match', () => {
  const result = filterRecords(sampleRecords, { search: 'a0' });
  assert.deepEqual(result.map((r) => r.styleNo), ['A001', 'A002']);
});

test('filterRecords combines filters with AND logic', () => {
  const result = filterRecords(sampleRecords, { customer: '张三', month: '2026-07', search: 'A002' });
  assert.deepEqual(result.map((r) => r.styleNo), ['A002']);
});

test('filterRecords returns empty array when nothing matches', () => {
  assert.deepEqual(filterRecords(sampleRecords, { search: 'nope' }), []);
});

test('filterRecords with no filters returns all records', () => {
  assert.equal(filterRecords(sampleRecords, {}).length, sampleRecords.length);
});

test('listRecordCustomers returns distinct non-empty customer names', () => {
  assert.deepEqual(listRecordCustomers(sampleRecords), ['张三', '李四']);
});

test('listRecordMonths returns distinct year-months in descending order', () => {
  assert.deepEqual(listRecordMonths(sampleRecords), ['2026-07', '2026-06', '2026-05']);
});
