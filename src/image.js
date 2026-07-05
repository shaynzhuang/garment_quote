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
