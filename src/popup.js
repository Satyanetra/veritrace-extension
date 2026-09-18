document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('enableToggle');
    const btnPick = document.getElementById('btn-pick');
    const msg = document.getElementById('msg');
    const historyEl = document.getElementById('history');
    const btnClear = document.getElementById('btn-clear');

    const showMessage = (text) => {
        msg.textContent = text;
        msg.classList.add('show');
    };

    chrome.storage.sync.get(['enabled'], (r) => { toggle.checked = r.enabled !== false; });
    toggle.addEventListener('change', () => chrome.storage.sync.set({ enabled: toggle.checked }));

    btnPick.addEventListener('click', async () => {
        msg.classList.remove('show');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const url = (tab && tab.url) || '';
        if (!tab || !/^https?:|^file:/.test(url) || /chromewebstore\.google\.com|chrome\.google\.com\/webstore|addons\.mozilla\.org/.test(url)) {
            showMessage("VeriTrace can't check this page. Open a normal website and try again.");
            return;
        }
        chrome.tabs.sendMessage(tab.id, { action: 'startPick' }, () => {
            if (chrome.runtime.lastError) {
                showMessage('Refresh this page, then press the button again.');
            } else {
                window.close();
            }
        });
    });

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const timeAgo = (t) => {
        const s = Math.max(1, Math.round((Date.now() - t) / 1000));
        if (s < 60) return 'Just now';
        const m = Math.round(s / 60);
        if (m < 60) return `${m} min ago`;
        const h = Math.round(m / 60);
        if (h < 24) return `${h} hr ago`;
        const d = Math.round(h / 24);
        return `${d} day${d === 1 ? '' : 's'} ago`;
    };

    const renderHistory = () => {
        chrome.storage.local.get(['vt_history_v2'], (res) => {
            const list = (res && res.vt_history_v2) || [];
            btnClear.hidden = list.length === 0;
            if (list.length === 0) {
                historyEl.innerHTML = '<p class="empty">Nothing checked yet.</p>';
                return;
            }
            historyEl.innerHTML = `<ul class="list">${list.map((item) => `
                <li class="item">
                    <div class="thumb" ${item.thumb ? `style="background-image:url('${esc(item.thumb)}')"` : ''}></div>
                    <div style="min-width:0">
                        <b>${esc(item.title)}</b>
                        <span>${esc(item.host || '')} · ${esc(timeAgo(item.at))}</span>
                    </div>
                    <i class="dot ${esc(item.tone || 'neutral')}" aria-hidden="true"></i>
                </li>`).join('')}</ul>`;
        });
    };

    btnClear.addEventListener('click', () => chrome.storage.local.remove('vt_history_v2', renderHistory));
    renderHistory();
});
