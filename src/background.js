// background.js - Service Worker for VeriTrace Lens

const CORE_API = 'https://api.veritrace.dpkvtrading.online';
const HASH_API = 'https://api.hash.veritrace.dpkvtrading.online';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureTab') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl: dataUrl });
            }
        });
        return true;
    }

    if (request.action === 'verify') {
        handleVerification(request.url, request.type, request.mediaKind)
            .then(data => sendResponse({ data }))
            .catch(error => sendResponse({ error: error.message }));
        
        return true; // Keep message channel open for async response
    }
});

async function handleVerification(mediaUrl, type, mediaKind = 'image') {
    try {
        let blob;
        let arrayBuffer;

        if (mediaUrl.startsWith('data:')) {
            // Convert data URL directly into Blob/ArrayBuffer in memory
            const arr = mediaUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
            arrayBuffer = u8arr.buffer;
        } else {
            // Fetch remote http/https media URL
            const res = await fetch(mediaUrl);
            if (!res.ok) throw new Error(`Failed to download ${mediaKind}. CORS or network error.`);
            blob = await res.blob();
            arrayBuffer = await blob.arrayBuffer();
        }

        if (type === 'exact') {
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Query Core Backend for exact match
            const verifyRes = await fetch(`${CORE_API}/api/v1/verify/exact?hash=0x${hashHex}`);
            if (!verifyRes.ok) throw new Error('Backend error during verification.');
            
            const data = await verifyRes.json();
            if (!data.match_found || !data.record) {
                return { found: false, hash: `0x${hashHex}` };
            }
            return { found: true, record: data.record };
            
        } else if (type === 'fuzzy') {
            const fd = new FormData();
            
            // Determine file extension from mime type or media kind
            let ext = (blob.type.split('/')[1] || '').split(';')[0];
            if (!ext || ext === 'octet-stream') {
                ext = mediaKind === 'video' ? 'webm' : 'jpg';
            }
            fd.append('file', blob, `recorded_media.${ext}`);
            
            // Step 1: Get hashes from Hash Engine
            const analyzeRes = await fetch(`${HASH_API}/api/v1/hash`, {
                method: 'POST',
                body: fd
            }).catch(e => {
                throw new Error('Hash Engine network unreachable.');
            });
            
            if (!analyzeRes.ok) throw new Error(`AI analysis failed (HTTP ${analyzeRes.status}).`);
            const hashData = await analyzeRes.json();
            
            // Step 2: Query Core Backend for similar segments
            const segmentsPayload = [{
                offset: 0,
                phash: Number(hashData.phash || 0),
                semantic_hash: hashData.semantic_hash || [],
                face_hash: hashData.face_hash || []
            }];
            
            const verifyRes = await fetch(`${CORE_API}/api/v1/verify/segments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sha256: '0x' + (hashData.sha256 || ''),
                    media_type: hashData.media_type || 'image',
                    audio_hashes: [],
                    segments: segmentsPayload
                })
            }).catch(e => {
                throw new Error('Core Backend network unreachable.');
            });
            
            if (!verifyRes.ok) throw new Error(`Backend verification failed (HTTP ${verifyRes.status}).`);
            const segmentData = await verifyRes.json();
            
            return {
                is_deepfake: segmentData.is_deepfake,
                similarity: segmentData.similarity,
                record: segmentData.record
            };
        }
        
        throw new Error('Unknown verification type');
    } catch (e) {
        console.error(e);
        throw new Error(e.message || 'Verification failed');
    }
}
