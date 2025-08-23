chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "capture") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, dataUrl => {
      sendResponse(dataUrl);
    });
    return true; // keep the message channel open
  }
});
