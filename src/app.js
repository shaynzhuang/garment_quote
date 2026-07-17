// src/app.js
(function () {
  const { computeSubtotal, computeTotal } = GarmentCalc;
  const { createStorage, filterRecords, listRecordCustomers, listRecordMonths, UNSPECIFIED_CUSTOMER } = GarmentStorage;
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
    clearBtn: document.getElementById('clear-btn'),
    customerName: document.getElementById('customerName'),
    customerNameList: document.getElementById('customerNameList'),
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
    saveAsNewBtn: document.getElementById('save-as-new-btn'),
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    exportBtn: document.getElementById('export-btn'),
    filterSearch: document.getElementById('filter-search'),
    filterCustomer: document.getElementById('filter-customer'),
    filterMonth: document.getElementById('filter-month')
  };

  let currentPhotoDataUrl = '';
  let editingRecordId = null;

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
    els.clearBtn.style.display = name === 'quote' ? '' : 'none';
    if (name === 'history') renderHistory();
  }

  function readFilters() {
    return {
      search: els.filterSearch.value,
      customer: els.filterCustomer.value,
      month: els.filterMonth.value
    };
  }

  function fillSelect(select, options, preferred) {
    const keep = options.some((o) => o.value === preferred) ? preferred : '';
    select.innerHTML = '';
    options.forEach((o) => {
      const el = document.createElement('option');
      el.value = o.value;
      el.textContent = o.label;
      select.appendChild(el);
    });
    select.value = keep;
  }

  function rebuildFilterOptions(records) {
    const customerOptions = [{ value: '', label: '全部客户' }];
    listRecordCustomers(records).forEach((name) => customerOptions.push({ value: name, label: name }));
    if (records.some((r) => !(r.customerName || '').trim())) {
      customerOptions.push({ value: UNSPECIFIED_CUSTOMER, label: '(未指定)' });
    }
    fillSelect(els.filterCustomer, customerOptions, els.filterCustomer.value);

    const monthOptions = [{ value: '', label: '全部月份' }];
    listRecordMonths(records).forEach((month) => monthOptions.push({ value: month, label: month }));
    fillSelect(els.filterMonth, monthOptions, els.filterMonth.value);
  }

  function getFilteredRecords() {
    return filterRecords(storage.listRecords(), readFilters());
  }

  function renderHistory() {
    const allRecords = storage.listRecords();
    rebuildFilterOptions(allRecords);
    const records = filterRecords(allRecords, readFilters());
    els.historyList.innerHTML = '';
    els.historyEmpty.style.display = records.length ? 'none' : 'block';
    records.forEach((record) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML =
        '<img>' +
        '<div class="info"><div class="style"></div><div class="meta"></div></div>' +
        '<span class="total"></span>' +
        '<button type="button" class="delete-btn">删除</button>';
      item.querySelector('img').src = record.photo || '';
      item.querySelector('.style').textContent = record.styleNo || '(未命名)';
      const date = (record.savedAt || '').slice(0, 10);
      item.querySelector('.meta').textContent = record.customerName ? `${record.customerName} · ${date}` : date;
      item.querySelector('.total').textContent = '￥' + Number(record.total).toFixed(2);
      item.querySelector('.delete-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        storage.deleteRecord(record.id);
        renderHistory();
      });
      item.addEventListener('click', () => {
        loadRecordForEdit(record);
        switchTab('quote');
      });
      els.historyList.appendChild(item);
    });
  }

  function updateSaveButtonLabel() {
    const editing = !!editingRecordId;
    els.saveBtn.textContent = editing ? '更新记录' : '保存记录';
    els.saveAsNewBtn.style.display = editing ? '' : 'none';
  }

  function loadRecordForEdit(record) {
    editingRecordId = record.id;
    els.customerName.value = record.customerName || '';
    els.styleNo.value = record.styleNo || '';
    els.weightGrams.value = record.weightGrams || '';
    els.yarnPricePerKg.value = record.yarnPricePerKg || '';
    els.materialOn.checked = !!record.materialOn;
    els.minutes.value = record.minutes || '';
    els.ratePerMinute.value = record.ratePerMinute || '';
    els.machineOn.checked = !!record.machineOn;
    els.sewingCost.value = record.sewingCost || '';
    els.sewingOn.checked = !!record.sewingOn;
    els.auxCost.value = record.auxCost || '';
    els.auxOn.checked = !!record.auxOn;
    els.finishingCost.value = record.finishingCost || '';
    els.finishingOn.checked = !!record.finishingOn;
    els.craftsOn.checked = !!record.craftsOn;
    els.craftList.innerHTML = '';
    (record.craftItems || []).forEach((item) => addCraftRow(item.name, item.amount));
    els.profit.value = record.profit != null ? record.profit : 0;
    els.profitOn.checked = !!record.profitOn;
    els.taxRate.value = record.taxRate != null ? record.taxRate : 0.13;
    els.taxOn.checked = !!record.taxOn;
    currentPhotoDataUrl = record.photo || '';
    els.photoInput.value = '';
    if (currentPhotoDataUrl) {
      els.photoPreview.src = currentPhotoDataUrl;
      els.photoPreview.style.display = 'block';
      els.photoPlaceholder.style.display = 'none';
    } else {
      els.photoPreview.style.display = 'none';
      els.photoPlaceholder.style.display = 'block';
    }
    recalc();
    updateSaveButtonLabel();
  }

  function renderCustomerOptions() {
    const customers = storage.listCustomers();
    els.customerNameList.innerHTML = '';
    customers.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      els.customerNameList.appendChild(option);
    });
  }

  function resetForm() {
    editingRecordId = null;
    updateSaveButtonLabel();
    els.customerName.value = '';
    els.styleNo.value = '';
    els.weightGrams.value = '';
    els.yarnPricePerKg.value = '';
    els.materialOn.checked = true;
    els.minutes.value = '';
    els.ratePerMinute.value = '';
    els.machineOn.checked = true;
    els.sewingCost.value = '';
    els.sewingOn.checked = true;
    els.auxCost.value = '';
    els.auxOn.checked = true;
    els.finishingCost.value = '';
    els.finishingOn.checked = true;
    els.craftsOn.checked = true;
    els.craftList.innerHTML = '';
    els.profit.value = '0';
    els.profitOn.checked = false;
    els.taxRate.value = '0.13';
    els.taxOn.checked = true;
    currentPhotoDataUrl = '';
    els.photoInput.value = '';
    els.photoPreview.src = '';
    els.photoPreview.style.display = 'none';
    els.photoPlaceholder.style.display = 'block';
    recalc();
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

  els.clearBtn.addEventListener('click', () => resetForm());

  [
    els.styleNo, els.weightGrams, els.yarnPricePerKg, els.materialOn,
    els.minutes, els.ratePerMinute, els.machineOn,
    els.sewingCost, els.sewingOn, els.auxCost, els.auxOn,
    els.finishingCost, els.finishingOn, els.craftsOn,
    els.profit, els.profitOn, els.taxRate, els.taxOn
  ].forEach((el) => el.addEventListener('input', recalc));

  function saveCurrentQuote(forceNew) {
    const { fields, totalOptions, subtotal, total } = recalc();
    storage.addCustomer(els.customerName.value);
    renderCustomerOptions();
    const wasUpdating = !forceNew && !!editingRecordId;
    storage.saveRecord({
      id: forceNew ? undefined : (editingRecordId || undefined),
      customerName: els.customerName.value,
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
    editingRecordId = null;
    updateSaveButtonLabel();
    alert(wasUpdating ? '已更新历史记录' : '已保存到历史记录');
  }

  els.saveBtn.addEventListener('click', () => saveCurrentQuote(false));
  els.saveAsNewBtn.addEventListener('click', () => saveCurrentQuote(true));

  els.exportBtn.addEventListener('click', () => {
    const records = getFilteredRecords();
    if (!records.length) {
      alert('暂无记录可导出');
      return;
    }
    exportRecordsToXlsx(records);
  });

  els.filterSearch.addEventListener('input', renderHistory);
  els.filterCustomer.addEventListener('change', renderHistory);
  els.filterMonth.addEventListener('change', renderHistory);

  renderCustomerOptions();
  recalc();
})();
