// utils.js
// General helpers: status updates, tab queries, delays, raw capture

export function setStatus(text) {
  document.getElementById('status').textContent = text;
}

export async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

export function delay(ms = 500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function captureVisibleTab(windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: 'png' },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(dataUrl);
        }
      }
    );
  });
}
