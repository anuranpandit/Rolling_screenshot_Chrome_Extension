// capture.js
// Captures the visible viewport, crops out overlays, returns both metrics and the chunk

import { getOverlayMetrics, scrollBy } from './metrics.js';
import { captureVisibleTab, setStatus, delay } from './utils.js';

//Manual scroll and capture
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

//////////////////////////////////////////////////////////////////////////////////////////////////////////
//Full page auto capture
export async function captureFullPage(tab) {
  const chunks = [];
  let scrollY = 0;
  let metrics = await getOverlayMetrics(tab.id);
  let previousScrollY = 0;
  let chunkIndex = 0;

  while (true) {
    await delay(300);
    const dataUrl = await captureVisibleTab(tab.windowId);
    const chunk = await cropImageForFullAutoScroll(dataUrl, metrics, scrollY - previousScrollY, chunkIndex, false);
    chunks.push(chunk);

    const step = Math.max(1, metrics.viewportHeight - metrics.topOverlay - metrics.bottomOverlay);
    const { newY, maxScrollTop } = await scrollBy(step, tab.id);

    if (newY <= scrollY || newY >= maxScrollTop) {
      // Final chunk
      previousScrollY = scrollY;
      scrollY = newY;
      await delay(300);
      metrics = await getOverlayMetrics(tab.id);
      const finalDataUrl = await captureVisibleTab(tab.windowId);
      const finalChunk = await cropImageForFullAutoScroll(finalDataUrl, metrics, scrollY - previousScrollY, chunkIndex + 1, true);
      chunks.push(finalChunk);
      break;
    }

    previousScrollY = scrollY;
    scrollY = newY;
    metrics = await getOverlayMetrics(tab.id);
    chunkIndex++;
  }

  return chunks;
}


async function cropImageForFullAutoScroll(dataUrl, metrics, scrollDelta, chunkIndex, isFinalChunk) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dpr = metrics.dpr || 1;
      const topPx = Math.round(metrics.topOverlay * dpr);
      const bottomPx = Math.round(metrics.bottomOverlay * dpr);
      const fullHeight = img.height;
      const visibleHeight = fullHeight - topPx - bottomPx;
      const scrollPx = Math.round(scrollDelta * dpr);

      let cropTop = topPx;
      let cropHeight = visibleHeight;

      if (chunkIndex === 0) {
        // First chunk: keep full top
        cropTop = 0;
        cropHeight = visibleHeight + topPx;
      } else if (isFinalChunk) {
        // Final chunk: crop from top, keep only scrollDelta
//        cropTop += visibleHeight - scrollPx;
//        cropHeight = scrollPx;

        // Final chunk: keep everything from scrollY to bottom
          cropTop = topPx + scrollPx;
          cropHeight = fullHeight - cropTop - bottomPx;
      } else {
        // Middle chunks: crop based on scroll delta
        cropTop += visibleHeight - scrollPx;
        cropHeight = scrollPx;
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, cropTop, img.width, cropHeight, 0, 0, img.width, cropHeight);

      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      });
    };
    img.onerror = () => {
      resolve({ dataUrl, width: 0, height: 0 });
    };
    img.src = dataUrl;
  });
}




