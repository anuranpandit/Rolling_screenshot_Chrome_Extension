// popup.js - Rolling Screenshot v3
let chunks = []; // each chunk: {dataUrl, width, height}
let lastMetrics = null; // metrics from last capture (viewportHeight, topOverlay, bottomOverlay, dpr, maxScrollTop)
const startBtn = document.getElementById('startBtn');
const scrollBtn = document.getElementById('scrollBtn');
const endBtn = document.getElementById('endBtn');
const statusEl = document.getElementById('status');

function setStatus(t) { statusEl.textContent = t; }

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// Get overlay metrics from page: topOverlay and bottomOverlay in CSS pixels, viewportHeight, maxScrollTop, devicePixelRatio
async function getOverlayMetrics(tabId) {
  const res = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      let topOverlay = 0;
      let bottomOverlay = 0;
      const els = Array.from(document.querySelectorAll('*'));
      const topThreshold = 10;   // px tolerance to consider "at the top"
      const bottomThreshold = 10; // px tolerance to consider "at the bottom"
      for (const el of els) {
        try {
          const style = getComputedStyle(el);
          if (!(style.position === 'fixed' || style.position === 'sticky')) continue;
          if (style.display === 'none' || style.visibility === 'hidden' || el.offsetParent === null && style.position !== 'fixed') continue;
          const rect = el.getBoundingClientRect();
          if (!rect || rect.width === 0 || rect.height === 0) continue;
          // check intersection with viewport horizontally and vertically
          if (rect.right <= 0 || rect.left >= window.innerWidth) continue;
          if (rect.bottom <= 0 || rect.top >= viewportHeight) continue;
          // top anchored (near 0)
          if (rect.top <= topThreshold) {
            topOverlay = Math.max(topOverlay, Math.ceil(rect.bottom));
          }
          // bottom anchored (near viewport bottom)
          if (rect.bottom >= viewportHeight - bottomThreshold) {
            bottomOverlay = Math.max(bottomOverlay, Math.ceil(viewportHeight - rect.top));
          }
        } catch (e) {
          // ignore cross-origin or computed style errors for some elements
        }
      }
      const maxScrollTop = Math.max(document.documentElement.scrollHeight - viewportHeight, 0);
      return { topOverlay, bottomOverlay, viewportHeight, maxScrollTop, dpr };
    }
  });
  return res[0].result;
}

// Capture the visible tab, crop out overlays (topOverlay & bottomOverlay) and add to chunks.
async function captureAndCrop(tab) {
  // get metrics for this scroll position
  const metrics = await getOverlayMetrics(tab.id);
  lastMetrics = metrics;
  setStatus(`Capturing (top:${metrics.topOverlay}px bottom:${metrics.bottomOverlay}px)...`);
  const dataUrl = await new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(dataUrl);
    });
  });
  // draw and crop according to device pixel ratio
  await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const dpr = metrics.dpr || 1;
        const srcW = img.width;
        const srcH = img.height;
        const topPx = Math.round(metrics.topOverlay * dpr);
        const bottomPx = Math.round(metrics.bottomOverlay * dpr);
        const cropHeight = Math.max(0, srcH - topPx - bottomPx);
        // if cropHeight <= 0 fallback to the full image minus topPx
        const finalCropH = cropHeight > 0 ? cropHeight : Math.max(1, srcH - topPx);
        const canvas = document.createElement('canvas');
        canvas.width = srcW;
        canvas.height = finalCropH;
        const ctx = canvas.getContext('2d');
        // draw the crop region from the captured image
        ctx.drawImage(img, 0, topPx, srcW, finalCropH, 0, 0, srcW, finalCropH);
        const cropped = canvas.toDataURL('image/png');
        chunks.push({ dataUrl: cropped, width: canvas.width, height: canvas.height });
        setStatus(`Captured chunk #${chunks.length} (cropped ${topPx}px top, ${bottomPx}px bottom).`);
      } catch (e) {
        console.error('Crop/draw error', e);
        // fallback: push original data url
        chunks.push({ dataUrl, width: img.width, height: img.height });
        setStatus(`Captured chunk #${chunks.length} (uncropped fallback).`);
      }
      resolve();
    };
    img.onerror = () => {
      // fallback push raw dataUrl
      chunks.push({ dataUrl, width: 0, height: 0 });
      setStatus('Captured (but image load failed — pushed raw).');
      resolve();
    };
    img.src = dataUrl;
  });
  return metrics;
}

// Scroll by the cropped content height (viewportHeight - topOverlay - bottomOverlay)
// returns { newY, maxScrollTop }
async function scrollByContent(tab, scrollStep) {
  const res = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (step) => {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const maxScrollTop = Math.max(document.documentElement.scrollHeight - viewportHeight, 0);
      const newY = Math.min(window.scrollY + step, maxScrollTop);
      window.scrollTo({ top: newY, behavior: 'auto' });
      return { newY, maxScrollTop };
    },
    args: [scrollStep]
  });
  return res[0].result;
}

startBtn.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    chunks = [];
    lastMetrics = null;
    setStatus('Starting capture...');
    await captureAndCrop(tab);
    setStatus('Captured first chunk. Use "Scroll (auto) & Capture" to capture next portions.');
  } catch (e) {
    console.error(e);
    alert('Error: ' + (e.message || e));
    setStatus('Error during start');
  }
});

scrollBtn.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (!lastMetrics) {
      alert('Start capture first.');
      return;
    }
    // compute scroll step in CSS pixels based on lastMetrics
    const step = Math.max(1, lastMetrics.viewportHeight - lastMetrics.topOverlay - lastMetrics.bottomOverlay);
    setStatus('Scrolling by ' + step + 'px and capturing...');
    const { newY, maxScrollTop } = await scrollByContent(tab, step);
    // wait for repaint / lazy-loads
    await new Promise(r => setTimeout(r, 550));
    await captureAndCrop(tab);
    if (newY >= maxScrollTop) {
      setStatus('Reached bottom of page. Click End & Download.');
    } else {
      setStatus('Captured after scroll. Position: ' + Math.round(newY) + ' / ' + Math.round(maxScrollTop));
    }
  } catch (e) {
    console.error(e);
    alert('Error during scroll & capture: ' + (e.message || e));
    setStatus('Error during scroll');
  }
});

endBtn.addEventListener('click', async () => {
  try {
    if (chunks.length === 0) {
      alert('No captures to stitch.');
      return;
    }
    setStatus('Stitching ' + chunks.length + ' chunks...');
    // load all chunk images
    const imgs = await Promise.all(chunks.map(c => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = c.dataUrl;
    })));
    // compute width (use first non-null)
    const firstImg = imgs.find(i => i !== null);
    if (!firstImg) {
      alert('Failed to load captured images.');
      setStatus('Stitch failed');
      return;
    }
    const width = firstImg.width;
    const totalHeight = imgs.reduce((sum, im) => sum + (im ? im.height : 0), 0);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    let y = 0;
    for (const im of imgs) {
      if (!im) continue;
      ctx.drawImage(im, 0, y);
      y += im.height;
    }
    const finalDataUrl = canvas.toDataURL('image/png');
    // download
    const link = document.createElement('a');
    link.href = finalDataUrl;
    link.download = 'fullpage_screenshot_v3.png';
    link.click();
    setStatus('Downloaded stitched screenshot. Done.');
    // reset
    chunks = [];
    lastMetrics = null;
  } catch (e) {
    console.error(e);
    alert('Stitching error: ' + (e.message || e));
    setStatus('Stitching error');
  }
});
