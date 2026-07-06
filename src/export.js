function onOffText(flag) {
  return flag ? '开' : '关';
}

function formatCraftItems(items) {
  return (items || []).map((item) => `${item.name}${item.amount}`).join('/');
}

function buildExportRows(records) {
  const header = [
    '日期', '客户名称', '款号', '重量(克)', '纱线单价(元/公斤)', '织机时长(分钟)', '织机单价(元/分钟)',
    '缝盘(元)', '辅料(元)', '后整(元)', '工艺明细',
    '材料开关', '织机开关', '缝盘开关', '辅料开关', '后整开关', '工艺开关',
    '利润(元)', '利润开关', '税率', '税开关', '总价(元)'
  ];
  const rows = (records || []).map((r) => [
    r.savedAt ? r.savedAt.slice(0, 10) : '',
    r.customerName || '',
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
