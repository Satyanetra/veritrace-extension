(() => {
    if (window.__veritraceLensLoaded) return;
    window.__veritraceLensLoaded = true;

    const MIN_SIZE = 90;
    const WEB_APP = 'https://verify.dpkvtrading.online';

    let extensionEnabled = true;
    let hoverTarget = null;
    let hideTimer = null;
    let pickMode = false;
    let pickTarget = null;
    let checkToken = 0;
    let cardAnchor = null;
    let stepTimers = [];

    const host = document.createElement('div');
    host.id = 'veritrace-lens-root';
    host.style.cssText = 'all:initial; position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647;';
    const root = host.attachShadow({ mode: 'open' });

    root.innerHTML = `
    <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .vt {
            --bg: #ffffff; --text: #17171a; --sub: #5b5b63; --border: #e2e2e6; --soft: #f5f5f7;
            --accent: #2a7bc4; --good: #0e9f6e; --info: #2a7bc4; --warn: #b96a00; --neutral: #5b5b63;
            --good-bg: rgba(14,159,110,.10); --info-bg: rgba(42,123,196,.10);
            --warn-bg: rgba(185,106,0,.10); --neutral-bg: rgba(91,91,99,.10);
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px; line-height: 1.45; color: var(--text);
        }
        @media (prefers-color-scheme: dark) {
            .vt {
                --bg: #1d1d20; --text: #ececee; --sub: #a3a3ab; --border: #34343a; --soft: #26262a;
                --accent: #4c9be0; --good: #00d395; --info: #4c9be0; --warn: #f5a623; --neutral: #a3a3ab;
                --good-bg: rgba(0,211,149,.12); --info-bg: rgba(76,155,224,.14);
                --warn-bg: rgba(245,166,35,.13); --neutral-bg: rgba(163,163,171,.14);
            }
        }
        button { font: inherit; color: inherit; cursor: pointer; }
        svg { display: block; flex: none; }

        .badge {
            position: fixed; display: none; align-items: center; gap: 6px;
            padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,.22);
            background: rgba(23,23,26,.9); color: #fff; font-size: 12px; font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,.3); pointer-events: auto; white-space: nowrap;
            animation: fade .12s ease;
        }
        .badge:hover { background: #000; border-color: rgba(255,255,255,.4); }
        .badge:focus-visible { outline: 2px solid #4c9be0; outline-offset: 2px; }

        .pickbar {
            position: fixed; top: 12px; left: 50%; transform: translateX(-50%); display: none;
            align-items: center; gap: 12px; padding: 10px 12px 10px 16px; border-radius: 8px;
            background: rgba(23,23,26,.95); color: #fff; font-size: 13px; pointer-events: auto;
            box-shadow: 0 6px 24px rgba(0,0,0,.35); max-width: calc(100vw - 24px);
        }
        .pickbar b { font-weight: 600; }
        .pickbar button {
            border: 1px solid rgba(255,255,255,.3); background: transparent; color: #fff;
            border-radius: 6px; padding: 4px 10px; font-size: 12px;
        }
        .pickbar button:hover { background: rgba(255,255,255,.12); }
        .pickbox {
            position: fixed; display: none; pointer-events: none; border-radius: 4px;
            border: 2px solid #4c9be0; background: rgba(76,155,224,.14);
        }

        .card {
            position: fixed; top: 0; left: 0; width: 372px; max-width: calc(100vw - 24px);
            max-height: calc(100vh - 24px); overflow-y: auto; display: none;
            background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,.28); pointer-events: auto; animation: rise .16s ease;
        }
        .card:focus { outline: none; }
        .head {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--border);
        }
        .brand { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; }
        .x {
            width: 28px; height: 28px; display: grid; place-items: center; border: 0;
            background: transparent; border-radius: 6px; color: var(--sub);
        }
        .x:hover { background: var(--soft); color: var(--text); }
        .body { padding: 16px; }
        .verdict { display: flex; gap: 12px; align-items: flex-start; }
        .thumb {
            width: 56px; height: 56px; border-radius: 8px; border: 1px solid var(--border);
            background: var(--soft) center / cover no-repeat; flex: none;
            display: grid; place-items: center; color: var(--sub);
        }
        .title { font-size: 17px; font-weight: 700; line-height: 1.25; margin: 0 0 4px; }
        .tag {
            display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px 2px 6px;
            border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 6px;
        }
        .tone-good .tag { color: var(--good); background: var(--good-bg); }
        .tone-info .tag { color: var(--info); background: var(--info-bg); }
        .tone-warn .tag { color: var(--warn); background: var(--warn-bg); }
        .tone-neutral .tag { color: var(--neutral); background: var(--neutral-bg); }
        .summary { margin: 12px 0 0; color: var(--text); }
        .note { margin: 8px 0 0; font-size: 12px; color: var(--sub); }
        .facts { margin: 14px 0 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
        .fact { display: flex; justify-content: space-between; gap: 12px; padding: 9px 12px; font-size: 13px; }
        .fact + .fact { border-top: 1px solid var(--border); }
        .fact span:first-child { color: var(--sub); flex: none; }
        .fact span:last-child { text-align: right; font-weight: 600; word-break: break-word; }
        .actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
        .btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
            border: 1px solid var(--border); background: var(--bg); text-decoration: none; color: var(--text);
        }
        .btn:hover { background: var(--soft); }
        .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
        .btn.primary:hover { filter: brightness(1.08); }
        .btn.grow { flex: 1; }
        .toggle {
            display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 4px 0;
            background: none; border: 0; color: var(--sub); font-size: 12px; font-weight: 600;
        }
        .toggle:hover { color: var(--text); }
        .toggle svg { transition: transform .15s ease; }
        .toggle[aria-expanded="true"] svg { transform: rotate(90deg); }
        .tech { display: none; margin-top: 6px; }
        .tech.open { display: block; }
        .tech .k { font-size: 11px; font-weight: 700; color: var(--sub); text-transform: uppercase; letter-spacing: .04em; margin: 10px 0 3px; }
        .tech code {
            display: block; padding: 6px 8px; border-radius: 6px; background: var(--soft);
            font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all;
        }
        .tech .links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
        .tech a { color: var(--accent); font-size: 12px; font-weight: 600; text-decoration: none; }
        .tech a:hover { text-decoration: underline; }
        .tech .hint { margin: 10px 0 0; font-size: 12px; color: var(--sub); }

        .loading { display: flex; gap: 12px; align-items: center; }
        .spinner {
            width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--border);
            border-top-color: var(--accent); animation: spin .8s linear infinite; flex: none;
        }
        .bar { height: 3px; margin-top: 16px; border-radius: 2px; background: var(--border); overflow: hidden; }
        .bar i { display: block; height: 100%; width: 35%; background: var(--accent); animation: slide 1.2s ease-in-out infinite; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slide { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rise { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
    </style>
    <div class="vt">
        <button class="badge" id="badge" type="button" aria-label="Check whether this image is authentic with VeriTrace"></button>
        <div class="pickbox" id="pickbox"></div>
        <div class="pickbar" id="pickbar" role="status">
            <span><b>Click any image or video</b> to check it</span>
            <button type="button" id="pick-cancel">Cancel</button>
        </div>
        <div class="card" id="card" role="dialog" aria-live="polite" aria-label="VeriTrace result" tabindex="-1"></div>
    </div>`;

    const badge = root.getElementById('badge');
    const pickbar = root.getElementById('pickbar');
    const pickbox = root.getElementById('pickbox');
    const card = root.getElementById('card');

    const ICONS = {
        shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
        check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
        warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m10.3 3.9-8.2 14A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-3l-8.2-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
        search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
        image: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
        close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        chevron: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
    };

    badge.innerHTML = `${ICONS.shield}<span>Check authenticity</span>`;

    function mount() {
        if (!host.isConnected) (document.documentElement || document.body).appendChild(host);
    }

    function contextValid() {
        return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
    }

    if (contextValid() && chrome.storage) {
        chrome.storage.sync.get(['enabled'], (r) => { extensionEnabled = r.enabled !== false; });
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes.enabled !== undefined) {
                extensionEnabled = changes.enabled.newValue !== false;
                if (!extensionEnabled) hideBadge(true);
            }
        });
    }

    function send(message) {
        return new Promise((resolve) => {
            if (!contextValid()) { resolve({ error: 'reload', code: 'reload' }); return; }
            try {
                chrome.runtime.sendMessage(message, (res) => {
                    if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message, code: 'reload' });
                    else resolve(res || { error: 'empty', code: 'server' });
                });
            } catch (e) {
                resolve({ error: 'reload', code: 'reload' });
            }
        });
    }

    if (contextValid() && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'startPick') {
                enterPick();
                sendResponse({ ok: true });
            }
        });
    }

    function isCheckable(el) {
        if (!el || (el.tagName !== 'IMG' && el.tagName !== 'VIDEO')) return false;
        const r = el.getBoundingClientRect();
        return r.width >= MIN_SIZE && r.height >= MIN_SIZE;
    }

    // elementsFromPoint sees through overlays that sites stack on top of media.
    function mediaAt(x, y) {
        const stack = document.elementsFromPoint(x, y);
        for (const el of stack) {
            if (el === host) continue;
            if (isCheckable(el)) return el;
        }
        return null;
    }

    function mediaSrc(el) {
        if (el.tagName === 'IMG') return el.currentSrc || el.src || '';
        return el.currentSrc || el.src || (el.querySelector('source') && el.querySelector('source').src) || '';
    }

    function placeBadge() {
        if (!hoverTarget) return;
        const r = hoverTarget.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) { hideBadge(true); return; }
        badge.style.display = 'flex';
        const bw = badge.offsetWidth || 150;
        const left = Math.max(8, Math.min(r.right, vw) - bw - 8);
        const top = Math.max(r.top, 0) + 8;
        badge.style.left = `${left}px`;
        badge.style.top = `${top}px`;
    }

    function showBadge(el) {
        mount();
        clearTimeout(hideTimer);
        hoverTarget = el;
        placeBadge();
    }

    function hideBadge(now = false) {
        clearTimeout(hideTimer);
        const doHide = () => { badge.style.display = 'none'; hoverTarget = null; };
        if (now) doHide(); else hideTimer = setTimeout(doHide, 250);
    }

    let moveQueued = false;
    document.addEventListener('mousemove', (e) => {
        if (!extensionEnabled || pickMode || moveQueued) return;
        moveQueued = true;
        const { clientX, clientY } = e;
        requestAnimationFrame(() => {
            moveQueued = false;
            const el = mediaAt(clientX, clientY);
            if (el) { if (el !== hoverTarget) showBadge(el); else clearTimeout(hideTimer); }
            else if (hoverTarget) hideBadge();
        });
    }, { passive: true });

    badge.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    badge.addEventListener('mouseleave', () => hideBadge());
    badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hoverTarget) startCheck(hoverTarget);
    });

    const reposition = () => { if (hoverTarget) placeBadge(); if (pickMode) drawPickBox(); placeCard(); };
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });

    function drawPickBox() {
        if (!pickTarget) { pickbox.style.display = 'none'; return; }
        const r = pickTarget.getBoundingClientRect();
        Object.assign(pickbox.style, {
            display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`
        });
    }

    const onPickMove = (e) => {
        const el = mediaAt(e.clientX, e.clientY);
        if (el !== pickTarget) { pickTarget = el; drawPickBox(); }
    };

    const swallow = (e) => {
        if (mediaAt(e.clientX, e.clientY)) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); }
    };

    const onPickClick = (e) => {
        const el = mediaAt(e.clientX, e.clientY);
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        exitPick();
        startCheck(el);
    };

    function enterPick() {
        mount();
        closeCard();
        hideBadge(true);
        pickMode = true;
        pickTarget = null;
        pickbar.style.display = 'flex';
        document.documentElement.classList.add('vt-picking');
        window.addEventListener('mousemove', onPickMove, true);
        window.addEventListener('click', onPickClick, true);
        ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(t => window.addEventListener(t, swallow, true));
    }

    function exitPick() {
        pickMode = false;
        pickTarget = null;
        pickbar.style.display = 'none';
        pickbox.style.display = 'none';
        document.documentElement.classList.remove('vt-picking');
        window.removeEventListener('mousemove', onPickMove, true);
        window.removeEventListener('click', onPickClick, true);
        ['mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(t => window.removeEventListener(t, swallow, true));
    }

    root.getElementById('pick-cancel').addEventListener('click', exitPick);

    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (pickMode) exitPick();
        else if (card.style.display === 'block') closeCard();
    }, true);

    function makeThumb(el) {
        try {
            const w = el.videoWidth || el.naturalWidth;
            const h = el.videoHeight || el.naturalHeight;
            if (!w || !h) return '';
            const s = 96 / Math.max(w, h);
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * s));
            c.height = Math.max(1, Math.round(h * s));
            c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
            return c.toDataURL('image/jpeg', 0.7);
        } catch (e) {
            return '';
        }
    }

    function nextFrames(n = 2) {
        return new Promise((res) => {
            const step = () => (--n <= 0 ? res() : requestAnimationFrame(step));
            requestAnimationFrame(step);
        });
    }

    async function captureFrame(el) {
            try {
            const w = el.videoWidth || el.naturalWidth || el.clientWidth;
            const h = el.videoHeight || el.naturalHeight || el.clientHeight;
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(el, 0, 0, w, h);
            return c.toDataURL('image/jpeg', 0.92);
        } catch (e) { /* cross-origin media taints the canvas; use a screenshot crop instead */ }

        const prev = host.style.visibility;
        host.style.visibility = 'hidden';
        await nextFrames(2);
        const cap = await send({ action: 'captureTab' });
        host.style.visibility = prev;
        if (cap.error || !cap.dataUrl) throw new Error('capture');

        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = cap.dataUrl; });
        const r = el.getBoundingClientRect();
        const left = Math.max(0, r.left), top = Math.max(0, r.top);
        const right = Math.min(document.documentElement.clientWidth, r.right);
        const bottom = Math.min(window.innerHeight, r.bottom);
        if (right - left < 20 || bottom - top < 20) throw new Error('capture');
        const dpr = window.devicePixelRatio || 1;
        const c = document.createElement('canvas');
        c.width = Math.round((right - left) * dpr);
        c.height = Math.round((bottom - top) * dpr);
        c.getContext('2d').drawImage(img, left * dpr, top * dpr, c.width, c.height, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.92);
    }

    const OUTCOMES = {
        exact: {
            tone: 'good', icon: 'check', tag: 'Verified',
            title: 'Verified original',
            summary: 'This is the original file. It matches an image registered on VeriTrace exactly, so it has not been changed since it was registered.'
        },
        similar: {
            tone: 'info', icon: 'info', tag: 'Copy of a registered image',
            title: 'Copy of a registered image',
            summary: 'This looks like a resized or re-saved copy of an image registered on VeriTrace. It closely matches the original.'
        },
        altered: {
            tone: 'warn', icon: 'warn', tag: 'Be careful',
            title: 'Edited version of a registered image',
            summary: 'It closely matches an image registered on VeriTrace, but it has been changed, for example cropped, edited or manipulated. Look at the original before you trust or share this one.'
        },
        notfound: {
            tone: 'neutral', icon: 'search', tag: 'Not registered',
            title: 'Not found on VeriTrace',
            summary: "We couldn't find this in the VeriTrace registry. That doesn't mean it's fake. Most pictures online simply haven't been registered, and only their creator can do that."
        }
    };

    const ERRORS = {
        network: ["Couldn't reach VeriTrace", 'Check your internet connection and try again.'],
        timeout: ['This is taking too long', 'The check timed out. Please try again in a moment.'],
        download: ["Couldn't read this image", "This website doesn't let us read the picture. Try opening the image on its own in a new tab and checking it there."],
        toolarge: ['This file is too large', 'Try a smaller image or video.'],
        server: ['VeriTrace is having trouble', 'Something went wrong on our side. Please try again in a moment.'],
        reload: ['Please refresh this page', 'VeriTrace was just updated. Refresh the page, then try again.'],
        capture: ["Couldn't capture this image", 'Scroll so the whole image is visible on screen, then try again.']
    };

    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const shortAddr = (a) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '');
    const fmtDate = (ts) => new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    function placeCard() {
        if (card.style.display !== 'block') return;
        const vw = document.documentElement.clientWidth;
        const vh = window.innerHeight;
        const cw = card.offsetWidth;
        const ch = card.offsetHeight;
        const gap = 12;
        const pad = 12;
        let left = vw - cw - pad;
        let top = pad;
        if (cardAnchor && cardAnchor.isConnected) {
            const r = cardAnchor.getBoundingClientRect();
            if (r.right + gap + cw <= vw - pad) left = r.right + gap;
            else if (r.left - gap - cw >= pad) left = r.left - gap - cw;
            top = r.top;
        }
        card.style.left = `${Math.max(pad, Math.min(left, vw - cw - pad))}px`;
        card.style.top = `${Math.max(pad, Math.min(top, vh - ch - pad))}px`;
    }

    function closeCard() {
        cardAnchor = null;
        checkToken++;
        stepTimers.forEach(clearTimeout);
        stepTimers = [];
        card.style.display = 'none';
        card.innerHTML = '';
    }

    function shell(inner) {
        card.innerHTML = `
            <div class="head">
                <div class="brand">${ICONS.shield}<span>VeriTrace</span></div>
                <button class="x" type="button" aria-label="Close" id="vt-close">${ICONS.close}</button>
            </div>
            <div class="body">${inner}</div>`;
        card.style.display = 'block';
        placeCard();
        root.getElementById('vt-close').addEventListener('click', closeCard);
    }

    function thumbHtml(thumb) {
        return thumb
            ? `<div class="thumb" style="background-image:url('${esc(thumb)}')"></div>`
            : `<div class="thumb">${ICONS.image}</div>`;
    }

    function renderLoading(kind, thumb) {
        shell(`
            <div class="loading">
                ${thumbHtml(thumb)}
                <div style="flex:1">
                    <div class="title" style="font-size:15px">Checking this ${kind}…</div>
                    <div class="note" id="vt-step" style="margin:0">Reading the ${kind}</div>
                </div>
                <div class="spinner"></div>
            </div>
            <div class="bar"><i></i></div>`);
        const step = root.getElementById('vt-step');
        stepTimers.push(setTimeout(() => { if (step) step.textContent = 'Searching the VeriTrace registry'; }, 1200));
        stepTimers.push(setTimeout(() => { if (step) step.textContent = 'Looking for edited copies'; }, 3200));
        stepTimers.push(setTimeout(() => { if (step) step.textContent = 'Almost done'; }, 9000));
    }

    function renderError(code, retry) {
        const [title, text] = ERRORS[code] || ERRORS.server;
        shell(`
            <div class="tone-warn">
                <div class="tag">${ICONS.warn}Couldn't check</div>
                <h3 class="title">${esc(title)}</h3>
            </div>
            <p class="summary">${esc(text)}</p>
            <div class="actions">
                ${retry ? '<button class="btn primary grow" type="button" id="vt-retry">Try again</button>' : ''}
                <button class="btn ${retry ? '' : 'primary'} grow" type="button" id="vt-another">Check another</button>
            </div>`);
        if (retry) root.getElementById('vt-retry').addEventListener('click', retry);
        root.getElementById('vt-another').addEventListener('click', enterPick);
    }

    function renderResult(result, thumb) {
        const o = OUTCOMES[result.status] || OUTCOMES.notfound;
        const rec = result.record;
        const video = result.mediaKind === 'video';

        let facts = '';
        if (rec) {
            const declared = rec.aiTool ? `AI-generated (${esc(rec.aiTool)})` : 'Original, not AI-generated';
            facts = `
                <div class="facts">
                    <div class="fact"><span>Registered by</span><span title="${esc(rec.creator)}">${esc(shortAddr(rec.creator))}</span></div>
                    ${rec.timestamp ? `<div class="fact"><span>Registered on</span><span>${esc(fmtDate(rec.timestamp))}</span></div>` : ''}
                    <div class="fact"><span>Declared by creator</span><span>${declared}</span></div>
                </div>`;
        }

        const links = [];
        if (rec && rec.fileUrl) links.push(`<a href="${esc(rec.fileUrl)}" target="_blank" rel="noopener">Registered original</a>`);
        if (rec && rec.proofUrl) links.push(`<a href="${esc(rec.proofUrl)}" target="_blank" rel="noopener">Proof record</a>`);

        const tech = `
            <div class="tech" id="vt-tech">
                <div class="k">File fingerprint (SHA-256)</div><code>${esc(result.sha256 || '')}</code>
                ${result.phash ? `<div class="k">Visual fingerprint</div><code>${esc(result.phash)}</code>` : ''}
                ${links.length ? `<div class="links">${links.join('')}</div>` : ''}
                <p class="hint">A fingerprint is a short code computed from the file. Two identical files always give the same one.</p>
            </div>`;

        shell(`
            <div class="verdict tone-${o.tone}">
                ${thumbHtml(thumb)}
                <div>
                    <div class="tag">${ICONS[o.icon]}${esc(o.tag)}</div>
                    <h3 class="title">${esc(o.title)}</h3>
                </div>
            </div>
            <p class="summary">${esc(o.summary)}</p>
            ${video ? '<p class="note">We checked one frame from this video.</p>' : ''}
            ${facts}
            <div class="actions">
                <button class="btn grow" type="button" id="vt-another">Check another</button>
                <a class="btn grow" href="${WEB_APP}" target="_blank" rel="noopener">Open VeriTrace</a>
            </div>
            <button class="toggle" type="button" id="vt-toggle" aria-expanded="false" aria-controls="vt-tech">${ICONS.chevron}<span>Technical details</span></button>
            ${tech}`);

        root.getElementById('vt-another').addEventListener('click', enterPick);
        const toggle = root.getElementById('vt-toggle');
        const techEl = root.getElementById('vt-tech');
        toggle.addEventListener('click', () => {
            const open = techEl.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
            placeCard();
        });
        card.focus({ preventScroll: true });
    }

    async function startCheck(el) {
        mount();
        hideBadge(true);
        const token = ++checkToken;
        stepTimers.forEach(clearTimeout);
        stepTimers = [];

        cardAnchor = el;
        const kind = el.tagName === 'VIDEO' ? 'video' : 'image';
        const thumb = makeThumb(el) || (kind === 'image' ? mediaSrc(el) : '');
        renderLoading(kind, thumb);
        card.focus({ preventScroll: true });

        const retry = () => startCheck(el);
        const stale = () => token !== checkToken;

        try {
            let resp;
            const src = mediaSrc(el);

            if (kind === 'image' && src && !src.startsWith('blob:')) {
                resp = await send({ action: 'check', url: src, mediaKind: kind });
                if (stale()) return;
                // some sites block downloading the file, so fall back to what is on screen
                if (resp.error && resp.code === 'download') resp = null;
            }

            if (!resp) {
                let frame;
                try { frame = await captureFrame(el); } catch (e) { if (!stale()) renderError('capture', retry); return; }
                if (stale()) return;
                resp = await send({ action: 'check', url: frame, mediaKind: kind, fuzzyOnly: true });
                if (stale()) return;
            }

            if (resp.error) { renderError(resp.code || 'server', retry); return; }

            const result = resp.result;
            renderResult(result, thumb);
            saveHistory(result, makeThumb(el));
        } catch (e) {
            if (!stale()) renderError('server', retry);
        }
    }

    function saveHistory(result, thumb) {
        if (!contextValid()) return;
        try {
            const o = OUTCOMES[result.status] || OUTCOMES.notfound;
            const entry = { status: result.status, title: o.title, tone: o.tone, at: Date.now(), host: location.hostname, thumb: thumb || '' };
            chrome.storage.local.get(['vt_history_v2'], (res) => {
                if (chrome.runtime.lastError) return;
                const list = [entry, ...((res && res.vt_history_v2) || [])].slice(0, 15);
                chrome.storage.local.set({ vt_history_v2: list });
            });
        } catch (e) {}
    }
})();
