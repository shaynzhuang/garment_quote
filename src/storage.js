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
    // Drop any existing record with the same id so editing-and-resaving
    // updates it in place instead of appending a duplicate.
    const records = listRecords().filter((r) => r.id !== record.id);
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

// Sentinel used by filterRecords/UI to mean "records with no customer name".
// An empty customer/month value means "no filter".
const UNSPECIFIED_CUSTOMER = '__UNSPECIFIED__';

function filterRecords(records, filters) {
  const { search, customer, month } = filters || {};
  const needle = (search || '').trim().toLowerCase();
  return records.filter((record) => {
    if (needle) {
      const haystack = `${record.styleNo || ''} ${record.customerName || ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    if (customer) {
      const name = (record.customerName || '').trim();
      if (customer === UNSPECIFIED_CUSTOMER) {
        if (name) return false;
      } else if (name !== customer) {
        return false;
      }
    }
    if (month) {
      if ((record.savedAt || '').slice(0, 7) !== month) return false;
    }
    return true;
  });
}

function listRecordCustomers(records) {
  const names = [];
  records.forEach((record) => {
    const name = (record.customerName || '').trim();
    if (name && !names.includes(name)) names.push(name);
  });
  return names;
}

function listRecordMonths(records) {
  const months = [];
  records.forEach((record) => {
    const month = (record.savedAt || '').slice(0, 7);
    if (month && !months.includes(month)) months.push(month);
  });
  return months.sort().reverse();
}

const GarmentStorage = {
  createStorage,
  filterRecords,
  listRecordCustomers,
  listRecordMonths,
  UNSPECIFIED_CUSTOMER,
  STORAGE_KEY,
  CUSTOMERS_KEY
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GarmentStorage;
} else {
  globalThis.GarmentStorage = GarmentStorage;
}
