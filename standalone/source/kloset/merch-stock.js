/* Stock notices verified against the official store. Update merch-stock.json
   when the store's public LOW STOCK labels change; no quantities are inferred. */
(() => {
  'use strict';
  let lowStock = new Set();
  let scheduled = false;
  function update() {
    scheduled = false;
    for (const card of document.querySelectorAll('.merch-card')) {
      const slug = new URL(card.href, location.href).pathname.split('/').filter(Boolean).pop();
      const existing = card.querySelector('[data-stock-notice]');
      const low = lowStock.has(slug);
      if (low && !existing) {
        const badge = document.createElement('span');
        badge.className = 'merch-badge';
        badge.dataset.stockNotice = 'low';
        badge.textContent = 'LOW STOCK';
        card.querySelector('.merch-image')?.append(badge);
      } else if (!low && existing) existing.remove();
      const label = card.getAttribute('aria-label') || '';
      const clean = label.replace(' — Low stock', '');
      const next = clean + (low ? ' — Low stock' : '');
      if (next !== label) card.setAttribute('aria-label', next);
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; queueMicrotask(update); }
  }
  // Catalog filters and cached popup mounts replace cards, so refresh notices
  // after those DOM changes without touching the catalog or its link handlers.
  new MutationObserver(records => {
    if (records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 &&
      (n.matches('.merch-card, .merch-grid') || n.querySelector('.merch-card'))))) schedule();
  }).observe(document.body, { childList: true, subtree: true });
  fetch('/kloset/merch-stock.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error('Stock notices unavailable'); return r.json(); })
    .then(data => { lowStock = new Set(data.lowStock || []); update(); })
    .catch(() => {});
})();
