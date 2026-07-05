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
