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

test('listRecords recovers to an empty array when stored data is corrupted', () => {
  const backend = createMemoryBackend();
  backend.setItem('garmentQuoteHistory', '{not valid json');
  const storage = createStorage(backend);
  assert.deepEqual(storage.listRecords(), []);
});
