// content.js - Injected into web pages

let activeHoverTarget = null;
let hoverContainer = null;
let currentTooltip = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHoverLogic);
} else {
    initHoverLogic();
}

function initHoverLogic() {
    // Listen for mouseover on the document
    document.addEventListener('mouseover', (e) => {
        const target = e.target;
        if (target.tagName === 'IMG' && target.src && !target.src.startsWith('data:')) {
            // Ignore tiny icons or emojis
            if (target.width < 100 || target.height < 100) return;
            
            showHoverButton(target);
        }
    });

    // Hide when mouse leaves the image AND the button container
    document.addEventListener('mouseout', (e) => {
        if (!hoverContainer) return;
        
        // If we're moving to the hover container or its children, don't hide
        if (e.relatedTarget && (hoverContainer.contains(e.relatedTarget) || e.relatedTarget === hoverContainer)) {
            return;
        }
        
        // If we're moving from the image to something else
        if (e.target === activeHoverTarget) {
            hideHoverButton();
        }
    });
}

function showHoverButton(imgElement) {
    if (activeHoverTarget === imgElement && hoverContainer) return;
    activeHoverTarget = imgElement;
    
    // Remove old container if it exists
    if (hoverContainer) hoverContainer.remove();
    if (currentTooltip) currentTooltip.remove();

    // Create the container
    hoverContainer = document.createElement('div');
    hoverContainer.className = 'veritrace-hover-container';
    
    // Calculate position (top right corner of image)
    const rect = imgElement.getBoundingClientRect();
    hoverContainer.style.top = `${rect.top + window.scrollY + 10}px`;
    hoverContainer.style.left = `${rect.right + window.scrollX - 110}px`; // Approx width of button

    // Create the button
    const btn = document.createElement('div');
    btn.className = 'veritrace-btn';
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
        VeriTrace
    `;

    // Handle mouse leaving the container
    hoverContainer.addEventListener('mouseleave', (e) => {
        // If we move back to the image, it's fine
        if (e.relatedTarget !== activeHoverTarget) {
            hideHoverButton();
        }
    });

    // Click handler for the main button
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu(imgElement.src);
    });

    hoverContainer.appendChild(btn);
    document.body.appendChild(hoverContainer);
}

function hideHoverButton() {
    // Don't hide if tooltip is open
    if (currentTooltip) return;
    
    if (hoverContainer) {
        hoverContainer.remove();
        hoverContainer = null;
    }
    activeHoverTarget = null;
}

function toggleMenu(imgSrc) {
    if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
        return;
    }

    currentTooltip = document.createElement('div');
    currentTooltip.className = 'veritrace-tooltip';
    
    currentTooltip.innerHTML = `
        <h4>Verify Authenticity</h4>
        <p>Choose a method to verify this image on the VeriTrace protocol.</p>
        <div class="vt-btn-group">
            <button class="vt-action-btn" id="vt-quick-check">⚡ Quick Check (On-Chain)</button>
            <button class="vt-action-btn primary" id="vt-deep-search">🔍 Deep Search (AI)</button>
        </div>
    `;

    hoverContainer.appendChild(currentTooltip);

    // Add event listeners
    document.getElementById('vt-quick-check').addEventListener('click', () => runVerification(imgSrc, 'exact'));
    document.getElementById('vt-deep-search').addEventListener('click', () => runVerification(imgSrc, 'fuzzy'));
}

async function runVerification(imgSrc, type) {
    if (!currentTooltip) return;
    
    // Show loading state
    currentTooltip.innerHTML = `
        <h4><div class="vt-loader"></div> Analyzing Image...</h4>
        <p>Verifying ${type === 'exact' ? 'on-chain cryptographic hashes' : 'AI semantic models'}...</p>
    `;

    try {
        // Send message to background script to bypass CORS
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'verify', type: type, url: imgSrc }, resolve);
        });

        if (response.error) {
            throw new Error(response.error);
        }

        renderResult(response.data, type);
    } catch (err) {
        currentTooltip.innerHTML = `
            <h4>❌ Verification Failed</h4>
            <p>${err.message || 'Could not reach VeriTrace API.'}</p>
            <button class="vt-action-btn" onclick="this.parentElement.remove(); currentTooltip=null;">Close</button>
        `;
    }
}

function renderResult(data, type) {
    // Helper to generate links HTML
    const getLinksHtml = (record) => {
        if (!record) return '';
        const sha256 = record.Sha256Hash || '';
        const mediaS3 = `https://s3.veritrace.dpkvtrading.online/veritrace/${sha256}`;
        
        const ipfsMeta = record.IpfsCid ? `https://gateway.pinata.cloud/ipfs/${record.IpfsCid}` : '';
        const mediaIpfsRaw = record.MediaIpfsUrl || '';
        const mediaIpfs = mediaIpfsRaw.startsWith('ipfs://') 
            ? `https://gateway.pinata.cloud/ipfs/${mediaIpfsRaw.replace('ipfs://', '')}`
            : mediaIpfsRaw;
        
        return `<div style="display:flex; flex-wrap:wrap; gap:8px 12px; margin:8px 0 4px 0; padding-top:8px; border-top:1px solid #333;">
            ${sha256 ? `<a href="${mediaS3}" target="_blank" style="color:#00D395; font-size:11px; text-decoration:none; display:flex; align-items:center; gap:4px; font-weight:600;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> S3 File</a>` : ''}
            ${ipfsMeta ? `<a href="${ipfsMeta}" target="_blank" style="color:#12AAFF; font-size:11px; text-decoration:none; display:flex; align-items:center; gap:4px; font-weight:600;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> IPFS JSON</a>` : ''}
            ${mediaIpfs ? `<a href="${mediaIpfs}" target="_blank" style="color:#12AAFF; font-size:11px; text-decoration:none; display:flex; align-items:center; gap:4px; font-weight:600;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> IPFS Content</a>` : ''}
        </div>`;
    };

    if (type === 'exact') {
        if (!data.found) {
            currentTooltip.innerHTML = `
                <h4><span class="vt-badge warning">NOT FOUND</span></h4>
                <p>This exact image is not registered on the VeriTrace blockchain ledger.</p>
                <div style="background:#000; padding:6px; border-radius:4px; font-family:monospace; font-size:10px; margin:4px 0; word-break:break-all; color:#888;">
                    Computed Hash: ${data.hash}
                </div>
                <div class="vt-btn-group">
                    <button class="vt-action-btn" id="vt-try-deep">Try Deep Search Instead</button>
                    <button class="vt-action-btn" onclick="this.parentElement.parentElement.remove(); currentTooltip=null;">Close</button>
                </div>
            `;
            document.getElementById('vt-try-deep').addEventListener('click', () => runVerification(activeHoverTarget.src, 'fuzzy'));
            return;
        }

        currentTooltip.innerHTML = `
            <h4><span class="vt-badge success">✅ AUTHENTIC</span></h4>
            <p><strong>Creator:</strong> ${(data.record.CreatorAddress || '').slice(0,6)}...${(data.record.CreatorAddress || '').slice(-4)}</p>
            <p><strong>Registered:</strong> ${new Date(data.record.Timestamp * 1000).toLocaleDateString()}</p>
            ${data.record.AiTool ? `<p><strong>AI Tool:</strong> ${data.record.AiTool}</p>` : ''}
            ${getLinksHtml(data.record)}
            <button class="vt-action-btn" onclick="this.parentElement.remove(); currentTooltip=null;" style="margin-top:8px">Close</button>
        `;
    } else if (type === 'fuzzy') {
        const isDeepfake = data.is_deepfake;
        
        if (data.record) {
            const matchType = isDeepfake ? 'danger' : 'success';
            const matchLabel = isDeepfake ? '❌ DEEPFAKE DETECTED' : '✅ SIMILAR MATCH';
            const creator = data.record.CreatorAddress || '';
            
            currentTooltip.innerHTML = `
                <h4><span class="vt-badge ${matchType}">${matchLabel}</span></h4>
                <p><strong>Similarity:</strong> ${data.similarity ? data.similarity.toFixed(1) + '%' : '100%'}</p>
                <p><strong>Creator:</strong> ${creator.slice(0,6)}...${creator.slice(-4)}</p>
                ${getLinksHtml(data.record)}
                <button class="vt-action-btn" onclick="this.parentElement.remove(); currentTooltip=null;" style="margin-top:8px">Close</button>
            `;
        } else {
            currentTooltip.innerHTML = `
                <h4><span class="vt-badge warning">NO MATCHES</span></h4>
                <p>No similar images or deepfakes were found in the registry.</p>
                <button class="vt-action-btn" onclick="this.parentElement.remove(); currentTooltip=null;" style="margin-top:8px">Close</button>
            `;
        }
    }
}
