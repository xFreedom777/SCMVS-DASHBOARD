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
    if (isSimulating) {
        btnToggleSim.innerHTML = '⏹ Stop Simulator';
        btnToggleSim.classList.add('active');
    } else {
        btnToggleSim.innerHTML = '▶ Start Simulator';
        btnToggleSim.classList.remove('active');
    }
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

// PDF Export Logic
btnExportPDF.addEventListener('click', async () => {
    const pdfHeader = document.getElementById('pdfHeader');
    const pdfGallery = document.getElementById('pdfGallery');
    const pdfImageGrid = document.getElementById('pdfImageGrid');
    const appContainer = document.getElementById('printableArea');
    
    // Set Date label
    document.getElementById('pdfDateLabel').textContent = "Report Date: " + (dateFilter.value === 'all' ? 'All Dates' : dateFilter.value) + " | Generated on: " + new Date().toLocaleString();
    
    // Pre-fill PDF Gallery with top 8 recent NG images
    pdfImageGrid.innerHTML = '';
    const recentNG = allImagesData.filter(img => img.status === 'NG').slice(0, 8);
    
    recentNG.forEach(img => {
        const div = document.createElement('div');
        div.className = 'pdf-img-card'; // Added class for page-break-inside avoid
        div.style.border = "1px solid #cbd5e1";
        div.style.borderRadius = "4px";
        div.style.padding = "4px";
        div.style.background = "#fff";
        div.innerHTML = `
            <div style="width: 100%; height: 120px; text-align: center; background: #000; border-radius: 2px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                <img src="${img.url}" style="max-width: 100%; max-height: 100%;">
            </div>
            <div style="font-size: 8px; color: #ef4444; font-weight: bold; margin-top: 4px;">[NG] ${img.recipe || ''}</div>
            <div style="font-size: 6px; color: #64748b; word-break: break-all;">${img.name}</div>
        `;
        pdfImageGrid.appendChild(div);
    });

    // Toggle PDF class for styling
    document.body.classList.add('exporting-pdf');
    pdfHeader.style.display = 'block';
    if(recentNG.length > 0) pdfGallery.style.display = 'block';

    const opt = {
        margin:       10,
        filename:     `Ajinomoto_SCMVS_Report_${dateFilter.value === 'all' ? 'All_Dates' : dateFilter.value}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, x: 0, y: 0, width: 1200, windowWidth: 1200 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    try {
        await html2pdf().set(opt).from(appContainer).save();
    } catch (err) {
        console.error("PDF Export failed:", err);
    } finally {
        // Always revert UI back to Dark Mode
        document.body.classList.remove('exporting-pdf');
        pdfHeader.style.display = 'none';
        pdfGallery.style.display = 'none';
    }
});

// Modal Logic
modalClose.onclick = () => modal.style.display = "none";
window.onclick = (e) => { if (e.target == modal) modal.style.display = "none"; }
