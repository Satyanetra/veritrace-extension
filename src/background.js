const CORE_API = 'https://api.veritrace.dpkvtrading.online';
const HASH_API = 'https://api.hash.veritrace.dpkvtrading.online';

const MAX_BYTES = 40 * 1024 * 1024;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureTab') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl });
            }
        });
        return true;
    }

    if (request.action === 'check') {
        handleCheck(request)
            .then(result => sendResponse({ result }))
            .catch(err => sendResponse({ error: err.message, code: err.code || 'unknown' }));
        return true;
    }
});

class CheckError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

async function fetchWithTimeout(url, options = {}, ms = 15000, code = 'network') {
    try {
        return await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
    } catch (e) {
        if (e && e.name === 'TimeoutError') throw new CheckError('timeout', 'The check took too long.');
        throw new CheckError(code, 'Could not reach VeriTrace.');
    }
}

async function loadBlob(mediaUrl) {
    let res;
    try {
        res = await fetch(mediaUrl, { signal: AbortSignal.timeout(20000) });
    } catch (e) {
        throw new CheckError('download', 'The image could not be downloaded.');
    }
    if (!res.ok) throw new CheckError('download', 'The image could not be downloaded.');
    const blob = await res.blob();
    if (blob.size > MAX_BYTES) throw new CheckError('toolarge', 'This file is too large to check.');
    if (blob.size === 0) throw new CheckError('download', 'The image could not be downloaded.');
    return blob;
}

async function sha256Hex(arrayBuffer) {
    const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Backend records use PascalCase in some responses and snake_case in others.
function pick(rec, ...keys) {
    for (const k of keys) {
        if (rec[k] !== undefined && rec[k] !== null && rec[k] !== '') return rec[k];
    }
    return '';
}

function normaliseRecord(rec) {
    if (!rec || Object.keys(rec).length === 0) return null;
    const ipfsCid = pick(rec, 'IpfsCid', 'ipfs_cid', 'ipfsCid');
    const mediaIpfs = String(pick(rec, 'MediaIpfsUrl', 'media_ipfs_url'));
    const toGateway = (u) => (u && u.startsWith('ipfs://') ? `https://gateway.pinata.cloud/ipfs/${u.slice(7)}` : u);
    return {
        sha256: pick(rec, 'Sha256Hash', 'sha256_hash', 'sha256'),
        creator: pick(rec, 'CreatorAddress', 'creator_address', 'creator'),
        timestamp: Number(pick(rec, 'Timestamp', 'timestamp')) || 0,
        aiTool: pick(rec, 'AiTool', 'ai_tool', 'aitool'),
        mediaType: pick(rec, 'MediaType', 'media_type'),
        fileUrl: toGateway(String(pick(rec, 'MediaS3Url', 'media_s3_url'))) || toGateway(mediaIpfs),
        ipfsUrl: toGateway(mediaIpfs),
        proofUrl: ipfsCid ? `https://gateway.pinata.cloud/ipfs/${ipfsCid}` : ''
    };
}

async function handleCheck({ url, mediaKind = 'image', fuzzyOnly = false }) {
    if (!url) throw new CheckError('download', 'No image to check.');

    const blob = await loadBlob(url);
    const arrayBuffer = await blob.arrayBuffer();
    const sha = '0x' + await sha256Hex(arrayBuffer);

    if (!fuzzyOnly) {
        const res = await fetchWithTimeout(`${CORE_API}/api/v1/verify/exact?hash=${sha}`, {}, 12000);
        if (!res.ok) throw new CheckError('server', 'VeriTrace had a problem.');
        const data = await res.json();
        const record = normaliseRecord(data.record);
        if (data.match_found && record) {
            return { status: 'exact', sha256: sha, record, mediaKind };
        }
    }

    let ext = (blob.type.split('/')[1] || '').split(';')[0];
    if (!ext || ext === 'octet-stream') ext = mediaKind === 'video' ? 'webm' : 'jpg';
    const form = new FormData();
    form.append('file', blob, `checked_media.${ext}`);

    const hashRes = await fetchWithTimeout(`${HASH_API}/api/v1/hash`, { method: 'POST', body: form }, 60000);
    if (!hashRes.ok) throw new CheckError('server', 'VeriTrace had a problem.');
    const hashData = await hashRes.json();

    const segRes = await fetchWithTimeout(`${CORE_API}/api/v1/verify/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sha256: hashData.sha256 || sha,
            media_type: hashData.media_type || 'image',
            audio_hashes: hashData.audio_hashes || [],
            segments: [{
                offset: 0,
                phash: Number(hashData.phash || 0),
                semantic_hash: hashData.semantic_hash || [],
                face_hash: hashData.face_hash || []
            }]
        })
    }, 30000);
    if (!segRes.ok) throw new CheckError('server', 'VeriTrace had a problem.');
    const seg = await segRes.json();

    const record = normaliseRecord(seg.record);
    const phash = hashData.phash !== undefined ? '0x' + BigInt(hashData.phash).toString(16) : '';

    if (!seg.match_found || !record) {
        return { status: 'notfound', sha256: sha, phash, record: null, mediaKind };
    }
    if (seg.exact_match) {
        return { status: 'exact', sha256: sha, phash, record, mediaKind };
    }
    // The backend flags `is_deepfake` when a file matches a registered original
    // but key details differ. That means "edited", not proof of a deepfake.
    return { status: seg.is_deepfake ? 'altered' : 'similar', sha256: sha, phash, record, mediaKind };
}
