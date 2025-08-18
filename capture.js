// capture.js
// Captures the visible viewport, crops out overlays, returns both metrics and the chunk

import { getOverlayMetrics, scrollBy } from './metrics.js';
import { captureVisibleTab, setStatus } from './utils.js';

export async function captureAndCrop(tab) {
  const m = await getOverlayMetrics(tab.id);
  setStatus(`Capturing (top:${m.topOverlay}px bottom:${m.bottomOverlay}px)…`);

  const dataUrl = await captureVisibleTab(tab.windowId);
  const chunk = await cropImage(dataUrl, m);
  setStatus(
    `Captured chunk #${chunk.index} (cropped ${chunk.topPx}px top, ${chunk.bottomPx}px bottom).`
  );

  return { metrics: m, chunk };
}

async function cropImage(dataUrl, m) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const srcW = img.width;
      const srcH = img.height;
      const dpr = m.dpr;
      const topPx = Math.round(m.topOverlay * dpr);
      const bottomPx = Math.round(m.bottomOverlay * dpr);
      const h = Math.max(1, srcH - topPx - bottomPx);

      const cv = document.createElement('canvas');
      cv.width = srcW;
      cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, topPx, srcW, h, 0, 0, srcW, h);

      resolve({
        dataUrl: cv.toDataURL('image/png'),
        width: srcW,
        height: h,
        topPx,
        bottomPx
      });
    };
    img.onerror = () => {
      // fallback: return raw
      resolve({ dataUrl, width: 0, height: 0, topPx: 0, bottomPx: 0 });
    };
    img.src = dataUrl;
  });
}
