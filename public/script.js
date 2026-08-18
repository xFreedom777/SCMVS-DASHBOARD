// DOM Elements
const dateFilter = document.getElementById('dateFilter');
const imageGrid = document.getElementById('imageGrid');

// Stats Elements
const valTotal = document.getElementById('valTotal');
const valOK = document.getElementById('valOK');
const valNG = document.getElementById('valNG');
const valYield = document.getElementById('valYield');
const cardNG = document.getElementById('cardNG');
const connStatus = document.getElementById('connStatus');

// Tier List
const tierListContainer = document.getElementById('tierListContainer');

// Live NG Snapshot Elements
const liveNgPlaceholder = document.getElementById('liveNgPlaceholder');
const liveNgImage = document.getElementById('liveNgImage');
const ngBorderAlert = document.getElementById('ngBorderAlert');
const liveNgTimestamp = document.getElementById('liveNgTimestamp');

// Modal & Buttons
const modal = document.getElementById('imageModal');
const modalImg = document.getElementById('modalImg');
const modalCaption = document.getElementById('modalCaption');
const modalClose = document.getElementById('modalClose');

const btnExportCSV = document.getElementById('btnExportCSV');
const btnToggleSim = document.getElementById('btnToggleSim');
const btnExportPDF = document.getElementById('btnExportPDF');
const btnReset = document.getElementById('btnReset');

// Chart & State
let resultChart = null;
let allImagesData = [];
let currentStatusFilter = 'all';
let isSimulating = false;

// Setup Socket.io
const socket = io();

socket.on('connect', () => {
    connStatus.innerHTML = `<div class="live-dot"></div> Live`;
    connStatus.style.color = '#10b981';
    connStatus.style.background = 'rgba(16, 185, 129, 0.15)';
    connStatus.style.borderColor = 'rgba(16, 185, 129, 0.3)';
});

socket.on('disconnect', () => {
    connStatus.innerHTML = `Disconnected`;
    connStatus.style.color = '#ef4444';
    connStatus.style.background = 'rgba(239, 68, 68, 0.15)';
    connStatus.style.borderColor = 'rgba(239, 68, 68, 0.3)';
});

socket.on('sim_status', (data) => {
    isSimulating = data.active;
    if (data.finished) {
        // Auto-stopped: all files injected
        isSimulating = false;
        btnToggleSim.innerHTML = '▶ Start Simulator';
        btnToggleSim.classList.remove('active');
        showToast('✅ Simulator หยุดแล้ว — อ่านข้อมูลครบทุกไฟล์', 'success');
    } else if (isSimulating) {
        const progress = (data.total && data.index !== undefined)
            ? ` (${data.index}/${data.total})`
            : '';
        btnToggleSim.innerHTML = `⏹ STOP SIMULATOR${progress}`;
        btnToggleSim.classList.add('active');
    } else {
        btnToggleSim.innerHTML = '▶ Start Simulator';
        btnToggleSim.classList.remove('active');
    }
});

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 9999;
        background: ${type === 'success' ? '#22c55e' : '#3b82f6'};
        color: #fff; padding: 14px 22px; border-radius: 12px;
        font-weight: 600; font-size: 14px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        animation: fadeInUp 0.4s ease;
        max-width: 360px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 4000);
}

socket.on('data_reset', () => {
    allImagesData = [];
    imageGrid.innerHTML = '';
    dateFilter.innerHTML = '<option value="all">📅 All Dates</option>';
    valTotal.textContent = '0';
    valOK.textContent = '0';
    valNG.textContent = '0';
    valYield.textContent = '0.00%';
    tierListContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 20px;">No NG Data</div>';
    liveNgImage.style.display = 'none';
    liveNgPlaceholder.style.display = 'flex';
    liveNgTimestamp.style.display = 'none';
    updateTrendChart({});
    console.log('[RESET] Dashboard cleared.');
});

socket.on('new_image', (imgData) => {
    allImagesData.unshift(imgData);
    updateDateFilterOptions();
    updateDashboard();
    
    if (imgData.status === 'NG') {
        triggerNGAlert(imgData);
    }
    
    const selectedDate = dateFilter.value;
    if ((selectedDate === 'all' || imgData.date === selectedDate) && 
        (currentStatusFilter === 'all' || imgData.status === currentStatusFilter)) {
        
        const card = createImageCard(imgData);
        if(imageGrid.children.length >= 100) {
            imageGrid.removeChild(imageGrid.lastChild);
        }
        imageGrid.prepend(card);
    }
});

// Initial Fetch
fetch('/api/images')
    .then(res => res.json())
    .then(data => {
        allImagesData = data.reverse();
        updateDateFilterOptions();
        updateDashboard();
        renderGallery(currentStatusFilter);
        
        const latestNG = allImagesData.find(img => img.status === 'NG');
        if(latestNG) triggerNGAlert(latestNG, false);
    });

// UI Logic
function updateDateFilterOptions() {
    const uniqueDates = [...new Set(allImagesData.map(img => img.date))].sort().reverse();
    const currentVal = dateFilter.value;
    
    dateFilter.innerHTML = '<option value="all">📅 All Dates</option>';
    uniqueDates.forEach(date => {
        const opt = document.createElement('option');
        opt.value = date;
        opt.textContent = `📅 ${date}`;
        dateFilter.appendChild(opt);
    });
    
    if (uniqueDates.includes(currentVal)) {
        dateFilter.value = currentVal;
    }
}

function updateDashboard() {
    const selectedDate = dateFilter.value;
    let okCount = 0;
    let ngCount = 0;
    let total = 0;
    
    let hourlyData = {};
    let recipeNgCounts = {}; // For Tier List

    allImagesData.forEach(item => {
        if (selectedDate !== 'all' && item.date !== selectedDate) return;
        total++;
        if (item.status === 'OK') okCount++;
        if (item.status === 'NG') {
            ngCount++;
            // Count NG per recipe
            const rec = item.recipe || 'UNKNOWN_RECIPE';
            recipeNgCounts[rec] = (recipeNgCounts[rec] || 0) + 1;
        }
        
        // Parse hour
        const timeMatch = item.name.match(/!(\d{4}_\d{2}_\d{2})_(\d{2})/);
        if (timeMatch) {
            const hour = timeMatch[2] + ':00';
            if(!hourlyData[hour]) hourlyData[hour] = { ok: 0, ng: 0 };
            if (item.status === 'OK') hourlyData[hour].ok++;
            if (item.status === 'NG') hourlyData[hour].ng++;
        }
    });

    const yieldRate = total > 0 ? ((okCount / total) * 100).toFixed(2) : '0.00';

    valTotal.textContent = total;
    valOK.textContent = okCount;
    valNG.textContent = ngCount;
    valYield.textContent = yieldRate + '%';

    updateTrendChart(hourlyData);
    updateTierList(recipeNgCounts);
}

function updateTierList(recipeNgCounts) {
    tierListContainer.innerHTML = '';
    
    // Convert object to array and sort by count descending
    const sortedRecipes = Object.keys(recipeNgCounts)
        .map(key => ({ name: key, count: recipeNgCounts[key] }))
        .sort((a, b) => b.count - a.count);

    if (sortedRecipes.length === 0) {
        tierListContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 20px;">No NG Data</div>';
        return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    
    sortedRecipes.slice(0, 5).forEach((item, index) => {
        const rankSymbol = index < 3 ? medals[index] : `#${index + 1}`;
        const div = document.createElement('div');
        div.className = 'tier-item';
        div.innerHTML = `
            <span class="tier-rank">${rankSymbol}</span>
            <span class="tier-name">${item.name}</span>
            <span class="tier-count">${item.count} NG</span>
        `;
        tierListContainer.appendChild(div);
    });
}

function triggerNGAlert(imgData, playAnim = true) {
    if(playAnim) {
        cardNG.classList.remove('pulse-alert');
        void cardNG.offsetWidth; 
        cardNG.classList.add('pulse-alert');
        
        ngBorderAlert.style.display = 'block';
        setTimeout(() => { ngBorderAlert.style.display = 'none'; }, 1000);
    }
    
    liveNgPlaceholder.style.display = 'none';
    liveNgImage.style.display = 'block';
    liveNgImage.src = imgData.url;
    
    liveNgTimestamp.style.display = 'block';
    const timeMatch = imgData.name.match(/!(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
    if(timeMatch) {
        liveNgTimestamp.textContent = `NG Detected at ${timeMatch[4]}:${timeMatch[5]}:${timeMatch[6]} | ${imgData.recipe || ''}`;
    } else {
        liveNgTimestamp.textContent = `NG Detected | ${imgData.name}`;
    }
}

dateFilter.addEventListener('change', () => {
    updateDashboard();
    renderGallery(currentStatusFilter);
});

// Filter button logic
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentStatusFilter = e.target.getAttribute('data-filter');
        renderGallery(currentStatusFilter);
    });
});

function updateTrendChart(hourlyData) {
    const ctx = document.getElementById('resultChart').getContext('2d');
    const hours = Object.keys(hourlyData).sort();
    const okData = hours.map(h => hourlyData[h].ok);
    const ngData = hours.map(h => hourlyData[h].ng);
    
    if (resultChart) resultChart.destroy();

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';
    Chart.defaults.borderColor = 'rgba(51, 65, 85, 0.5)';

    resultChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hours.length > 0 ? hours : ['No Data'],
            datasets: [
                { label: 'OK (Pass)', data: hours.length > 0 ? okData : [0], backgroundColor: '#10b981', borderRadius: 4 },
                { label: 'NG (Defect)', data: hours.length > 0 ? ngData : [0], backgroundColor: '#ef4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'top', labels: { font: { size: 12, weight: '600' } } },
                tooltip: {
                    callbacks: {
                        title: function(context) { return 'Hour: ' + context[0].label; }
                    }
                }
            },
            scales: { 
                y: { beginAtZero: true, stacked: true, title: { display: true, text: 'Total Pieces' } }, 
                x: { stacked: true, title: { display: true, text: 'Time (Hour)' } } 
            },
            animation: { duration: 500 }
        }
    });
}

function createImageCard(item) {
    const card = document.createElement('div');
    card.className = 'img-card';
    let statusClass = item.status.toLowerCase();
    
    card.innerHTML = `
        <img src="${item.url}" alt="${item.name}" loading="lazy">
        <span class="img-status ${statusClass}">${item.status}</span>
        <div class="img-name" title="${item.name}">${item.name}</div>
    `;

    card.addEventListener('click', () => {
        modal.style.display = "block";
        modalImg.src = item.url;
        modalCaption.textContent = item.name + " (" + item.status + ")";
    });
    return card;
}

function renderGallery(filterStatus) {
    imageGrid.innerHTML = '';
    const selectedDate = dateFilter.value;
    
    const filtered = allImagesData.filter(item => {
        const matchDate = (selectedDate === 'all' || item.date === selectedDate);
        const matchStatus = (filterStatus === 'all' || item.status === filterStatus);
        return matchDate && matchStatus;
    });

    filtered.slice(0, 100).forEach(item => {
        imageGrid.appendChild(createImageCard(item));
    });
}

// Sim Toggle Logic
btnToggleSim.addEventListener('click', () => {
    if (isSimulating) fetch('/api/simulation/stop').catch(console.error);
    else fetch('/api/simulation/start').then(res => res.json()).then(data => { if (data.error) alert(data.error); }).catch(console.error);
});

// Reset Logic
btnReset.addEventListener('click', () => {
    if (!confirm('⚠️ Reset ข้อมูลทั้งหมด?\n\nระบบจะ:\n• หยุด Simulation\n• ลบรูปภาพทั้งหมดใน SCMVS folder\n• ล้างหน้าจอทั้งหมด\n\nต้องการดำเนินการต่อหรือไม่?')) return;
    fetch('/api/reset')
        .then(res => res.json())
        .then(data => { console.log('[RESET] Done:', data.status); })
        .catch(console.error);
});

// Export CSV Logic
btnExportCSV.addEventListener('click', () => {
    const selectedDate = dateFilter.value;
    const filtered = allImagesData.filter(item => {
        return (selectedDate === 'all' || item.date === selectedDate) && 
               (currentStatusFilter === 'all' || item.status === currentStatusFilter);
    });
    
    if (filtered.length === 0) return alert("No data available to export.");

    let csvContent = "data:text/csv;charset=utf-8,Date,Time,Status,Recipe,Filename\n";
    filtered.forEach(item => {
        let timeStr = "-";
        const timeMatch = item.name.match(/!(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
        if (timeMatch) timeStr = `${timeMatch[4]}:${timeMatch[5]}:${timeMatch[6]}`;
        csvContent += `${item.date},${timeStr},${item.status},${item.recipe},${item.name}\n`; 
    });

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Ajinomoto_SCMVS_Export_${selectedDate === 'all' ? 'All_Dates' : selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// =====================================================
// PREMIUM PDF REPORT EXPORT LOGIC
// =====================================================
btnExportPDF.addEventListener('click', async () => {

    const now = new Date();
    const isAllDates = dateFilter.value === 'all';
    const dateLabel  = isAllDates ? 'All Dates' : dateFilter.value;
    const genStr     = now.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });

    // ── 1. Stats ────────────────────────────────────────
    const filtered = isAllDates ? allImagesData : allImagesData.filter(i => i.date === dateFilter.value);
    const total  = filtered.length;
    const okCnt  = filtered.filter(i => i.status === 'OK').length;
    const ngCnt  = filtered.filter(i => i.status === 'NG').length;
    const yld    = total > 0 ? ((okCnt / total) * 100).toFixed(2) + '%' : '0.00%';

    // ── 2. Chart data ───────────────────────────────────
    const hourBuckets = {};
    for (let h = 0; h < 24; h++) hourBuckets[String(h).padStart(2,'0')+':00'] = {ok:0, ng:0};
    filtered.forEach(img => {
        const ts = img.name.match(/(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
        const h  = ts ? String(parseInt(ts[4])).padStart(2,'0')+':00' : '00:00';
        if (hourBuckets[h]) img.status === 'OK' ? hourBuckets[h].ok++ : hourBuckets[h].ng++;
    });
    const chartLabels = Object.keys(hourBuckets);
    const chartOK = chartLabels.map(l => hourBuckets[l].ok);
    const chartNG = chartLabels.map(l => hourBuckets[l].ng);

    // ── 3. Tier data ────────────────────────────────────
    const recipeCounts = {};
    filtered.filter(i => i.status === 'NG').forEach(i => {
        const r = i.recipe || 'Unknown';
        recipeCounts[r] = (recipeCounts[r] || 0) + 1;
    });
    const tierEntries = Object.entries(recipeCounts).sort((a,b) => b[1]-a[1]);
    const medals = ['🥇','🥈','🥉'];

    // ── 3.5. Hourly Table HTML ──────────────────────────
    let hourlyTableHTML = `<div class="panel" style="margin-top:24px;">
        <div class="panel-title">📋 Hourly Production Summary</div>
        <div style="display:flex; border:1px solid #334155; border-radius:4px; overflow:hidden;">
            <div style="display:flex; flex-direction:column; background:#0f172a; width:45px; border-right:1px solid #334155;">
                <div style="font-size:0.55rem; font-weight:800; color:#cbd5e1; text-align:center; padding:5px 0; border-bottom:1px solid #334155; height:22px;">HR</div>
                <div style="font-size:0.55rem; font-weight:800; color:#10b981; text-align:center; padding:5px 0; border-bottom:1px solid #334155; height:22px;">OK</div>
                <div style="font-size:0.55rem; font-weight:800; color:#ef4444; text-align:center; padding:5px 0; height:22px;">NG</div>
            </div>`;
    
    chartLabels.forEach((label, idx) => {
        let ok = chartOK[idx];
        let ng = chartNG[idx];
        let timeLabel = label.split(':')[0]; // e.g. '00', '01'
        let bgClass = (idx % 2 === 0) ? 'background:#1e293b;' : 'background:#0f172a;';
        let bRight = idx === 23 ? '' : 'border-right:1px solid #334155;';
        hourlyTableHTML += `
            <div style="display:flex; flex-direction:column; flex:1; ${bRight} ${bgClass}">
                <div style="font-size:0.55rem; font-weight:700; color:#94a3b8; text-align:center; padding:5px 0; border-bottom:1px solid #334155; height:22px;">${timeLabel}</div>
                <div style="font-size:0.55rem; font-weight:700; color:${ok > 0 ? '#34d399' : '#475569'}; text-align:center; padding:5px 0; border-bottom:1px solid #334155; height:22px;">${ok}</div>
                <div style="font-size:0.55rem; font-weight:700; color:${ng > 0 ? '#f87171' : '#475569'}; text-align:center; padding:5px 0; height:22px;">${ng}</div>
            </div>`;
    });
    hourlyTableHTML += `</div></div>`;

    // ── 4. NG Images (all or filtered by date) ──────────
    const ngImages = filtered.filter(i => i.status === 'NG');
    // Convert to absolute URLs
    const baseUrl = window.location.origin;

    // ── 5. Build tier rows HTML ─────────────────────────
    const tierHTML = tierEntries.length === 0
        ? `<div style="text-align:center;color:#64748b;padding:16px;font-size:0.7rem;">No NG data</div>`
        : tierEntries.map(([name,cnt],i) => `
            <div style="display:flex;align-items:center;gap:5px;
                background:#0f172a;border:1px solid #334155;border-left:3px solid #ef4444;
                border-radius:5px;padding:5px 8px;margin-bottom:4px;">
                <span style="font-size:0.8rem;width:22px;">${medals[i]||'▸'}</span>
                <span style="font-size:0.6rem;font-weight:800;color:#94a3b8;width:20px;">#${i+1}</span>
                <span style="font-size:0.62rem;font-weight:600;color:#f8fafc;flex:1;">${name}</span>
                <span style="font-size:0.72rem;font-weight:900;color:#ef4444;">${cnt} NG</span>
            </div>`).join('');

    // ── 6. Paginate NG Images ───────────────────────────
    const chunkSize = 15; // 3 rows of 5 cards per page to prevent page-break cuts
    const ngChunks = [];
    for (let i = 0; i < ngImages.length; i += chunkSize) {
        ngChunks.push(ngImages.slice(i, i + chunkSize));
    }

    let evidencePagesHTML = '';
    if (ngImages.length === 0) {
        evidencePagesHTML = `
<div class="page-break"></div>
<div class="page">
  <div class="rpt-header" style="height:44px; box-sizing:border-box; padding:4px 53px; margin: 0;">
    <div style="display:flex;align-items:center;gap:8px;color:#f8fafc;">
      <span style="font-size:1.2rem;">📷</span>
      <span style="font-size:1rem;font-weight:900;color:#38bdf8;letter-spacing:2px;">SCMVS</span>
    </div>
    <div style="flex:1;text-align:center;font-size:0.9rem;font-weight:700;color:#f8fafc;">
      NG Image Evidence — <span style="color:#7dd3fc;">${dateLabel}</span>
    </div>
    <div style="font-size:0.65rem;color:#ffffff;font-weight:600;">${genStr}</div>
  </div>
  <div class="rpt-accent" style="height:4px; box-sizing:border-box; margin: 0;"></div>
  
  <div style="height:710px; box-sizing:border-box; padding:200px 38px 0; text-align:center;">
    <div style="font-size:1rem;color:#10b981;font-weight:600;">✅ No NG defects recorded for this period.</div>
  </div>

  <div class="rpt-footer" style="height:36px; box-sizing:border-box; display:flex; align-items:center; padding:0 52px; margin: 0; background-color:#1e293b !important;">
    <span>AJINOMOTO SCMVS v2.0 — Confidential</span><span>${genStr}</span><span>Page 2</span>
  </div>
</div>`;
    } else {
        evidencePagesHTML = ngChunks.map((chunk, pageIdx) => `
<div class="page-break"></div>
<div class="page">
  <div class="rpt-header" style="height:44px; box-sizing:border-box; padding:4px 53px; margin: 0;">
    <div style="display:flex;align-items:center;gap:8px;color:#f8fafc;">
      <span style="font-size:1.2rem;">📷</span>
      <span style="font-size:1rem;font-weight:900;color:#38bdf8;letter-spacing:2px;">SCMVS</span>
    </div>
    <div style="flex:1;text-align:center;font-size:0.9rem;font-weight:700;color:#f8fafc;">
      NG Image Evidence — <span style="color:#7dd3fc;">${dateLabel}</span>
      <span style="font-size:0.6rem;color:#e2e8f0;margin-left:10px;">(Images ${pageIdx * chunkSize + 1}-${pageIdx * chunkSize + chunk.length} of ${ngImages.length})</span>
    </div>
    <div style="font-size:0.65rem;color:#ffffff;font-weight:600;">${genStr}</div>
  </div>
  <div class="rpt-accent" style="height:4px; box-sizing:border-box; margin: 0;"></div>
  
  <div style="height:710px; box-sizing:border-box; padding:8px 38px 20px;">
    <div style="display:flex;flex-wrap:wrap;gap:7px;">
      ${chunk.map(img => `
        <div style="width:calc(20% - 6px);border:1px solid #334155;border-radius:6px;overflow:hidden;background:#1e293b;">
          <div style="width:100%;height:80px;background:#000;position:relative;overflow:hidden;">
            <img src="${baseUrl}${img.url}" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;display:block;">
            <span style="position:absolute;top:3px;left:3px;background:#ef4444;color:#fff;font-size:0.45rem;font-weight:800;padding:1px 4px;border-radius:2px;letter-spacing:1px;">NG</span>
          </div>
          <div style="padding:3px 5px;">
            <div style="font-size:0.52rem;font-weight:700;color:#f87171;text-transform:uppercase;">${img.recipe||'Unknown'}</div>
            <div style="font-size:0.4rem;color:#cbd5e1;word-break:break-all;line-height:1.3;">${img.name}</div>
          </div>
        </div>`).join('')}
    </div>
  </div>

  <div class="rpt-footer" style="height:36px; box-sizing:border-box; display:flex; align-items:center; padding:0 52px; margin: 0; background-color:#1e293b !important;">
    <span>AJINOMOTO SCMVS v2.0 — Confidential</span><span>${genStr}</span><span>Page ${pageIdx + 2}</span>
  </div>
</div>`).join('');
    }

    // ── 7. Build complete report HTML (Dark Theme) ──────
    const reportHTML = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
::-webkit-scrollbar { display: none; }
html, body { scrollbar-width: none; -ms-overflow-style: none; overflow-x: hidden; width: 1123px; min-height: 5000px; }
body { background:#0f172a; font-family:'Inter','Segoe UI',sans-serif; color:#f8fafc; }
.page { display:block; width:1123px !important; height:794px !important; background:#0f172a !important; box-sizing:border-box; overflow:hidden; position:relative; }
.page-break { page-break-before: always; width:1123px; height:1px; background:transparent; border:none; margin:0; padding:0; }
/* header */
.rpt-header { display:flex; align-items:center; justify-content:space-between;
    background:linear-gradient(135deg,#1e293b 0%,#0f172a 60%,#0ea5e9 100%); }
.rpt-accent { background:linear-gradient(90deg,#0ea5e9,#10b981,#f59e0b,#ef4444); }
/* kpi */
.kpi { border-radius:7px; padding:9px 10px; text-align:center; border:1px solid #334155; position:relative; overflow:hidden; background:#1e293b; }
.kpi::before { content:''; position:absolute; top:0;left:0;right:0; height:3px; }
.kpi.blue::before   { background:#3b82f6; }
.kpi.green::before  { background:#10b981; }
.kpi.red::before    { background:#ef4444; }
.kpi.purple::before { background:#8b5cf6; }
.kpi-icon { font-size:1.1rem; margin-bottom:2px; }
.kpi-lbl  { font-size:0.5rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; }
.kpi-val  { font-size:1.7rem; font-weight:900; line-height:1.1; margin:1px 0; }
.kpi-sub  { font-size:0.5rem; color:#64748b; }
.kpi.blue .kpi-val { color:#60a5fa; }  .kpi.green .kpi-val { color:#34d399; }
.kpi.red  .kpi-val { color:#f87171; }  .kpi.purple .kpi-val { color:#a78bfa; }
/* panels */
.panel { border:1px solid #334155; border-radius:7px; padding:8px 12px; background:#1e293b; }
.panel-title { font-size:0.62rem; font-weight:800; text-transform:uppercase; letter-spacing:1.5px;
    color:#f8fafc; margin-bottom:6px; padding-bottom:5px; border-bottom:2px solid #334155; }
/* footer */
.rpt-footer { display:flex; justify-content:space-between;
    background:#1e293b; border-top:1px solid #334155; border-radius:4px 4px 0 0;
    font-size:0.5rem; color:#64748b; font-weight:500; }
</style>
</head><body>

<!-- PAGE 1: SUMMARY -->
<div class="page">
  <div class="rpt-header" style="height:44px; box-sizing:border-box; padding:4px 53px; margin: 0;">
    <div style="display:flex;align-items:center;gap:10px;color:#f8fafc;white-space:nowrap;">
      <span style="font-size:1.6rem;">📷</span>
      <div>
        <div style="font-size:1.2rem;font-weight:900;color:#38bdf8;letter-spacing:2px;">SCMVS</div>
        <div style="font-size:0.55rem;color:#cbd5e1;letter-spacing:1px;text-transform:uppercase;">Smart Camera Machine Vision System</div>
      </div>
    </div>
    <div style="text-align:center;flex:1;color:#f8fafc;padding:0 12px;">
      <div style="font-size:1.1rem;font-weight:800;letter-spacing:1px;">Executive Inspection Report</div>
      <div style="font-size:0.6rem;color:#7dd3fc;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">AJINOMOTO CO., (THAILAND) LTD.</div>
    </div>
    <div style="text-align:right;color:#ffffff;font-size:0.6rem;white-space:nowrap;font-weight:500;">
      <div style="margin-bottom:2px;"><span style="color:#e2e8f0;">📅 Date&nbsp;</span>${dateLabel}</div>
      <div style="margin-bottom:2px;"><span style="color:#e2e8f0;">🕐 Generated&nbsp;</span>${genStr}</div>
      <div><span style="color:#e2e8f0;">📋 Report&nbsp;</span>SCMVS-EIR</div>
    </div>
  </div>
  <div class="rpt-accent" style="height:4px; box-sizing:border-box; margin: 0;"></div>

  <div style="height:710px; box-sizing:border-box; padding: 0 38px;">

  <!-- KPI ROW -->
  <div style="display:flex;gap:8px;padding:8px 0 6px;">
    <div class="kpi blue"  style="flex:1;"><div class="kpi-icon">🔍</div><div class="kpi-lbl">Total Inspected</div><div class="kpi-val">${total.toLocaleString()}</div><div class="kpi-sub">pieces</div></div>
    <div class="kpi green" style="flex:1;"><div class="kpi-icon">✅</div><div class="kpi-lbl">Total OK</div><div class="kpi-val">${okCnt.toLocaleString()}</div><div class="kpi-sub">passed</div></div>
    <div class="kpi red"   style="flex:1;"><div class="kpi-icon">⚠️</div><div class="kpi-lbl">Total NG</div><div class="kpi-val">${ngCnt.toLocaleString()}</div><div class="kpi-sub">defects</div></div>
    <div class="kpi purple"style="flex:1;"><div class="kpi-icon">📊</div><div class="kpi-lbl">Yield Rate</div><div class="kpi-val">${yld}</div><div class="kpi-sub">quality</div></div>
  </div>

  <!-- BODY ROW -->
  <div style="display:flex;gap:8px;padding:0 0 6px;">
    <div class="panel" style="flex:2.5;">
      <div class="panel-title">📈 Production Trend (Hourly)</div>
      <div style="height:260px;position:relative;"><canvas id="rptChart"></canvas></div>
    </div>
    <div class="panel" style="flex:1;overflow:hidden;display:flex;flex-direction:column;">
      <div class="panel-title">🏆 NG Defect Tier</div>
      <div style="overflow:hidden;flex:1;">${tierHTML}</div>
    </div>
  </div>

  ${hourlyTableHTML}
  </div>

  <div class="rpt-footer" style="height:36px; box-sizing:border-box; display:flex; align-items:center; padding:0 52px; margin: 0; background-color:#1e293b !important;">
    <span>AJINOMOTO SCMVS v2.0 — Confidential</span>
    <span>${genStr}</span>
    <span>Page 1</span>
  </div>
</div>

${evidencePagesHTML}

<script>
window.onload = function() {
    const ctx = document.getElementById('rptChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ${JSON.stringify(chartLabels)},
            datasets: [
                { label:'OK (Pass)',   data:${JSON.stringify(chartOK)}, backgroundColor:'#10b981', borderRadius:3, barPercentage:0.75, stack:'s' },
                { label:'NG (Defect)', data:${JSON.stringify(chartNG)}, backgroundColor:'#ef4444', borderRadius:3, barPercentage:0.75, stack:'s' }
            ]
        },
        options: {
            responsive:true, maintainAspectRatio:false, animation:false,
            plugins:{ legend:{ labels:{ font:{size:9,family:'Inter'}, color:'#f8fafc', boxWidth:10 } } },
            scales:{
                x:{ stacked:true, ticks:{font:{size:7},color:'#94a3b8',maxRotation:45}, grid:{color:'#334155'} },
                y:{ stacked:true, ticks:{font:{size:7},color:'#94a3b8'}, grid:{color:'#334155'} }
            }
        }
    });
};
<\/script>
</body></html>`;

    // ── 8. Render in clean iframe & export ──────────────
    const totalPages = ngChunks.length === 0 ? 2 : ngChunks.length + 1;
    const iframeHeight = (totalPages * 800) + 'px'; // Expand iframe to cover all pages

    const iframe = document.createElement('iframe');
    // Ensure iframe is exactly the target width (1123px) so html2canvas captures 100% width without gaps
    iframe.style.cssText = `position:fixed;top:0;left:0;width:1123px;height:5000px;border:none;z-index:99999;background:#0f172a;`;
    document.body.appendChild(iframe);

    const iDoc = iframe.contentDocument;
    iDoc.open();
    iDoc.write(reportHTML);
    iDoc.close();

    // Wait for Chart.js to load + render
    await new Promise(r => setTimeout(r, 2000));

    const fname = `SCMVS_Report_${dateLabel.replace(/\s/g,'_')}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;

    try {
        const opt = {
            margin:      0,
            filename:    fname,
            image:       { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                backgroundColor: '#0f172a', 
                logging: false
            },
            jsPDF:       { unit: 'pt', format: 'a4', orientation: 'landscape' },
            pagebreak:   { mode: ['css', 'legacy'], before: '.page-break' }
        };
        await html2pdf().set(opt).from(iDoc.body).save();
    } catch (err) {
        console.error('PDF Export failed:', err);
        alert('PDF export failed: ' + err.message);
    } finally {
        iframe.remove();
    }
});



// Modal Logic
modalClose.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }
