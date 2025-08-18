// stitch.js
// Loads all chunk images into one tall canvas and triggers download

import { setStatus } from './utils.js';

export async function stitchAndDownload(chunks) {
  setStatus(`Stitching ${chunks.length} chunks…`);

  // load images
  const imgs = await Promise.all(
    chunks.map((c) =>
      new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = c.dataUrl;
      })
    )
  );

  const valid = imgs.filter(Boolean);
  if (!valid.length) {
    throw new Error('No valid chunk images to stitch');
  }

  const w = valid[0].width;
  const totalH = valid.reduce((sum, i) => sum + i.height, 0);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = totalH;
  const ctx = cv.getContext('2d');

  let y = 0;
  for (const im of valid) {
    ctx.drawImage(im, 0, y);
    y += im.height;
  }

  // trigger download
  const link = document.createElement('a');
  link.href = cv.toDataURL('image/png');
  link.download = 'fullpage_screenshot.png';
  link.click();

  setStatus('Download complete.');
}
