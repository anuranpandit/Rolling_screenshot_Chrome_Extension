// metrics.js
// Screen‐overlay detection & scroll helpers

export async function getOverlayMetrics(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const vh = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      let topOverlay = 0, bottomOverlay = 0;
      const threshold = 10;

      document.querySelectorAll('*').forEach((el) => {
        try {
          const style = getComputedStyle(el);
          const pos = style.position;
          if (!['fixed','sticky'].includes(pos)) return;
          if (style.display === 'none' || style.visibility === 'hidden') return;

          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          if (r.right <= 0 || r.left >= window.innerWidth) return;
          if (r.bottom <= 0 || r.top >= vh) return;

          if (r.top <= threshold) {
            topOverlay = Math.max(topOverlay, Math.ceil(r.bottom));
          }
          if (r.bottom >= vh - threshold) {
            bottomOverlay = Math.max(bottomOverlay, Math.ceil(vh - r.top));
          }
        } catch {}
      });

      const maxScrollTop = Math.max(
        document.documentElement.scrollHeight - vh,
        0
      );
      return { topOverlay, bottomOverlay, viewportHeight: vh, maxScrollTop, dpr };
    }
  });
  return result;
}

export async function scrollBy(step, tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (s) => {
      const vh = window.innerHeight;
      const max = Math.max(document.documentElement.scrollHeight - vh, 0);
      const y = Math.min(window.scrollY + s, max);
      window.scrollTo({ top: y, behavior: 'auto' });
      return { newY: y, maxScrollTop: max };
    },
    args: [step]
  });
  return result;
}
