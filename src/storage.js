const STORAGE_KEY = 'garmentQuoteHistory';
const CUSTOMERS_KEY = 'garmentQuoteCustomers';

function createStorage(backend) {
  const store = backend || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) throw new Error('No storage backend available');

  function listRecords() {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
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

  function listCustomers() {
    const raw = store.getItem(CUSTOMERS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function addCustomer(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return listCustomers();
    const customers = listCustomers();
    if (!customers.includes(trimmed)) {
      customers.push(trimmed);
      store.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
    }
    return listCustomers();
  }

  return { listRecords, saveRecord, deleteRecord, listCustomers, addCustomer };
}

const GarmentStorage = { createStorage, STORAGE_KEY, CUSTOMERS_KEY };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentStorage;
} else {
  globalThis.GarmentStorage = GarmentStorage;
}
