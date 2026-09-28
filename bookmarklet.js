// tl;dv transcript collector (bookmarklet source).
// TLDV only fills transcript paragraphs that are near the viewport, so a plain
// "Copy outerHTML" misses most of a long meeting. This scrolls each empty
// paragraph into view, waits for its text, and collects everything.
// bookmarklet.html turns this file into a javascript: link.
(async () => {
  if (window.__tldvRunning) return;
  const container = document.querySelector('#transcript-container');
  if (!container) {
    alert('Transcript not found. Open the meeting on tldv.io and show the transcript first.');
    return;
  }
  window.__tldvRunning = true;

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:360px;max-width:calc(100vw - 32px);' +
    'background:#fff;color:#222;border:1px solid #ccc;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.2);' +
    'padding:12px;font:13px/1.4 system-ui,sans-serif';
  const status = document.createElement('div');
  panel.appendChild(status);
  document.body.appendChild(panel);
  const say = msg => { status.textContent = msg; };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const sel = i => document.querySelector(`#transcript-container p[data-index="${i}"]`);
  const read = p => {
    const s = p.querySelector('[data-speaker="true"]');
    const t = s?.querySelector('a')?.textContent.trim() ?? '';
    const n = (s?.querySelector('button') ?? s?.querySelector('span'))?.textContent.trim() ?? '';
    const txt = [...p.querySelectorAll('[data-speaker="false"]')].map(w => w.textContent.trim()).filter(Boolean).join(' ');
    return txt ? `[${t}] ${n}: ${txt}` : null;
  };
  const seen = new Map();
  const grab = () => document.querySelectorAll('#transcript-container p[data-index]').forEach(p => {
    const l = read(p); if (l) seen.set(+p.dataset.index, l);
  });

  const total = Math.max(...[...document.querySelectorAll('#transcript-container p[data-index]')].map(p => +p.dataset.index)) + 1;
  grab();
  // Paragraphs still empty get retried with longer waits
  for (const delay of [700, 1500, 3000]) {
    for (let i = 0; i < total; i++) {
      if (seen.has(i) || !sel(i)) continue;
      sel(i).scrollIntoView({ block: 'center' });
      await wait(delay);
      grab();
      say(`Collecting transcript… ${seen.size}/${total}`);
    }
    if (seen.size === total) break;
  }

  const fmt = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const text = [...Array(total).keys()]
    .map(i => seen.get(i) ?? `[${fmt(+(sel(i)?.dataset.time ?? 0))}] (empty in tl;dv)`)
    .join('\n') + '\n';
  const missing = total - seen.size;
  say(`${seen.size} of ${total} lines collected` + (missing ? ` (${missing} empty, marked in the text).` : '.'));

  const button = (label, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'margin:8px 8px 0 0;padding:6px 12px;border:0;border-radius:4px;background:#3498db;color:#fff;cursor:pointer;font:inherit';
    b.onclick = onClick;
    panel.appendChild(b);
    return b;
  };
  // Clipboard needs a user click, so copying happens from a button, not automatically
  const copyBtn = button('Copy', async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copied!';
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
      copyBtn.textContent = 'Copied!';
    }
  });
  button('Download .txt', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const d = new Date();
    a.download = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  button('Close', () => { panel.remove(); window.__tldvRunning = false; }).style.background = '#95a5a6';
})();
