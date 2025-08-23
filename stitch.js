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

//  const w = valid[0].width;
//  const totalH = valid.reduce((sum, i) => sum + i.height, 0);
//  const cv = document.createElement('canvas');
//  cv.width = w;
//  cv.height = totalH;
//  const ctx = cv.getContext('2d');

    try {
          const canvas = document.createElement('canvas');
          canvas.width = valid[0].width;
          canvas.height = valid.reduce((sum, img) => sum + img.height, 0);;
          const ctx = canvas.getContext('2d');

//          let offsetY = 0;
//          for (const im of valid) {
//            ctx.drawImage(im, 0, 0, im.width, im.height, 0, offsetY, im.width, im.height);
//            offsetY += im.height;
//          }

          let y = 0;
            for (const im of valid) {
              ctx.drawImage(im, 0, y);
              y += im.height;
            }

          const link = document.createElement('a');
          link.href = canvas.toDataURL('image/png');
          link.download = 'fullpage_screenshot.png';
          link.click();

          setStatus('Download complete.');

    }catch(e) {
        console.error(e);
        throw e;
    }

  // trigger download

}
