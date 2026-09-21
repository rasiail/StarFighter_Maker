import { HUD_LAYOUT } from './hud_layout.js';

let editorActive = false;
let editorPanel = null;
let dragTarget = null;
let dragOffset = { x: 0, y: 0 };
let originalPointerEvents = '';

export function initLayoutEditor() {
    window.addEventListener('keydown', (e) => {
        if (e.shiftKey && e.key.toLowerCase() === 'u') {
            toggleEditor();
        }
    });
}

export function startEditor() {
    if (!editorActive) {
        toggleEditor();
    }
}

function toggleEditor() {
    editorActive = !editorActive;
    if (editorActive) {
        showPanel();
        enableDrag();
    } else {
        hidePanel();
        disableDrag();
    }
}

function showPanel() {
    if (!editorPanel) {
        editorPanel = document.createElement('div');
        editorPanel.style.position = 'fixed';
        editorPanel.style.top = '10px';
        editorPanel.style.right = '10px';
        editorPanel.style.width = '300px';
        editorPanel.style.background = 'rgba(0, 0, 0, 0.85)';
        editorPanel.style.border = '1px solid #4df58a';
        editorPanel.style.color = '#fff';
        editorPanel.style.padding = '15px';
        editorPanel.style.zIndex = '10000';
        editorPanel.style.fontFamily = 'monospace';
        editorPanel.style.overflowY = 'auto';
        editorPanel.style.maxHeight = '90vh';
        
        // Disable keyboard events from reaching the game when typing in inputs
        editorPanel.addEventListener('keydown', (e) => e.stopPropagation());
        
        document.body.appendChild(editorPanel);
    }
    editorPanel.style.display = 'block';
    renderPanel();
}

function hidePanel() {
    if (editorPanel) {
        editorPanel.style.display = 'none';
    }
}

function renderPanel() {
    editorPanel.innerHTML = '<h3 style="margin-top:0; color:#4df58a; font-size:16px;">HUD Layout Editor</h3><p style="font-size:11px; margin-top:-10px; color:#aaa">Drag elements or change values</p>';
    
    for (const [key, layoutObj] of Object.entries(HUD_LAYOUT)) {
        const group = document.createElement('div');
        group.style.borderBottom = '1px solid #333';
        group.style.paddingBottom = '10px';
        group.style.marginBottom = '10px';
        
        const title = document.createElement('div');
        title.textContent = key;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '5px';
        group.appendChild(title);
        
        for (const [prop, val] of Object.entries(layoutObj)) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.marginBottom = '4px';
            row.style.fontSize = '13px';
            
            const label = document.createElement('label');
            label.textContent = prop;
            
            const input = document.createElement('input');
            input.type = 'number';
            input.value = val;
            input.style.width = '70px';
            input.style.background = '#222';
            input.style.color = '#fff';
            input.style.border = '1px solid #555';
            
            input.addEventListener('input', (e) => {
                HUD_LAYOUT[key][prop] = Number(e.target.value);
            });
            
            row.appendChild(label);
            row.appendChild(input);
            group.appendChild(row);
        }
        editorPanel.appendChild(group);
    }
    
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Copy JSON to Clipboard';
    exportBtn.style.width = '100%';
    exportBtn.style.padding = '8px';
    exportBtn.style.marginTop = '10px';
    exportBtn.style.background = '#1a442e';
    exportBtn.style.color = '#4df58a';
    exportBtn.style.border = '1px solid #4df58a';
    exportBtn.style.cursor = 'pointer';
    exportBtn.style.fontFamily = 'monospace';
    exportBtn.addEventListener('click', () => {
        const json = JSON.stringify(HUD_LAYOUT, null, 4);
        navigator.clipboard.writeText(`export const HUD_LAYOUT = ${json};`).then(() => {
            exportBtn.textContent = 'Copied!';
            setTimeout(() => exportBtn.textContent = 'Copy JSON to Clipboard', 2000);
        });
    });
    editorPanel.appendChild(exportBtn);
}

function enableDrag() {
    const canvas = document.getElementById('hud-canvas');
    if (canvas) {
        originalPointerEvents = canvas.style.pointerEvents;
        canvas.style.pointerEvents = 'auto';
        canvas.addEventListener('mousedown', onMouseDown);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function disableDrag() {
    const canvas = document.getElementById('hud-canvas');
    if (canvas) {
        canvas.style.pointerEvents = originalPointerEvents;
        canvas.removeEventListener('mousedown', onMouseDown);
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
}

function onMouseDown(e) {
    const canvas = document.getElementById('hud-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const h = canvas.height;

    const keys = Object.keys(HUD_LAYOUT).reverse();
    for (const key of keys) {
        const layout = HUD_LAYOUT[key];
        let x, y, w, ht;
        if (layout.cxOffset !== undefined) {
            x = cx + layout.cxOffset;
            y = cy + layout.cyOffset;
            w = layout.w;
            ht = layout.h;
        } else if (layout.r !== undefined) {
            x = layout.x - layout.r;
            y = h - layout.yOffsetFromBottom - layout.r;
            w = layout.r * 2;
            ht = layout.r * 2;
        }

        const pad = 15; // Give generous padding for grabbing elements
        if (mouseX >= x - pad && mouseX <= x + w + pad && mouseY >= y - pad && mouseY <= y + ht + pad) {
            dragTarget = key;
            dragOffset.x = mouseX - x;
            dragOffset.y = mouseY - y;
            break;
        }
    }
}

function onMouseMove(e) {
    if (!dragTarget) return;
    const canvas = document.getElementById('hud-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const h = canvas.height;

    const layout = HUD_LAYOUT[dragTarget];
    
    let newX = mouseX - dragOffset.x;
    let newY = mouseY - dragOffset.y;

    if (layout.cxOffset !== undefined) {
        layout.cxOffset = Math.round(newX - cx);
        layout.cyOffset = Math.round(newY - cy);
    } else if (layout.r !== undefined) {
        layout.x = Math.round(newX + layout.r);
        layout.yOffsetFromBottom = Math.round(h - (newY + layout.r));
    }
    
    // Only re-render if mouse is not clicking inside an input (prevent input blur)
    if (document.activeElement && document.activeElement.tagName !== 'INPUT') {
        renderPanel();
    }
}

function onMouseUp() {
    if (dragTarget) {
        renderPanel(); // Final sync
    }
    dragTarget = null;
}
