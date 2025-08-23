// popup.js
// Wires UI buttons to our modules

import { setStatus, getActiveTab, delay } from './utils.js';
import { captureAndCrop, captureFullPage } from './capture.js';
import { scrollBy } from './metrics.js';
import { stitchAndDownload } from './stitch.js';

const startBtn  = document.getElementById('startBtn');
const scrollBtn = document.getElementById('scrollBtn');
const endBtn    = document.getElementById('endBtn');
const fullPageBtn = document.getElementById('fullPageBtn');

let chunks = [];
let lastMetrics = null;

console.log('popup.js loaded');

// START
startBtn.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    chunks = [];
    lastMetrics = null;
    setStatus('Starting capture…');
    const { metrics, chunk } = await captureAndCrop(tab);
    chunks.push(chunk);
    lastMetrics = metrics;
    scrollBtn.disabled = false;
    endBtn.disabled = false;
    setStatus('First chunk captured. Scroll & capture next.');
  } catch (e) {
    console.error(e);
    setStatus('Start error');
  }
});

// SCROLL & CAPTURE
scrollBtn.addEventListener('click', async () => {
  if (!lastMetrics) {
    alert('Please start capture first.');
    return;
  }
  try {
    const tab = await getActiveTab();
    const step = Math.max(
      1,
      lastMetrics.viewportHeight - lastMetrics.topOverlay - lastMetrics.bottomOverlay
    );

    setStatus(`Scrolling by ${step}px…`);
    const { newY, maxScrollTop } = await scrollBy(step, tab.id);

    await delay(550); // allow lazy loads
    const { metrics, chunk } = await captureAndCrop(tab);
    chunks.push(chunk);
    lastMetrics = metrics;

    if (newY >= maxScrollTop) {
      setStatus('Reached bottom. Click End to download.');
    } else {
      setStatus(`Captured at ${Math.round(newY)} of ${Math.round(maxScrollTop)}.`);
    }
  } catch (e) {
    console.error(e);
    setStatus('Scroll error');
  }
});

// END & DOWNLOAD
endBtn.addEventListener('click', async () => {
  if (!chunks.length) {
    alert('No screenshots to stitch.');
    return;
  }
  try {
    await stitchAndDownload(chunks);
    // reset UI
    chunks = [];
    lastMetrics = null;
    scrollBtn.disabled = true;
    endBtn.disabled    = true;
  } catch (e) {
    console.error(e);
    setStatus('Stitch error');
  }
});

//AUTO CAPTURE FULL PAGE BY SCROLLING TO THE END
fullPageBtn.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    setStatus('Capturing full page...');

    //disable buttons during auto capture
    startBtn.disabled = true;
    scrollBtn.disabled = true;
    endBtn.disabled = true;
    fullPageBtn.disabled = true;

    const chunks = await captureFullPage(tab);
    setStatus(`Captured ${chunks.length} chunks. Stitching...`);
    await stitchAndDownload(chunks);

    // Re-enable after stitching
    startBtn.disabled = false;
    scrollBtn.disabled = false;
    endBtn.disabled = false;
    fullPageBtn.disabled = false;
    setStatus('Full page screenshot downloaded.');
  } catch (e) {
    console.error(e);
    // Re-enable if error
    startBtn.disabled = false;
    scrollBtn.disabled = false;
    endBtn.disabled = false;
    fullPageBtn.disabled = false;
    setStatus('Error during full page capture');
  }
});
