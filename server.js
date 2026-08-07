const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// CONFIGURATION
const FTP_FOLDER_PATH = "C:\\Users\\xSixtanic\\SCMVS"; // The folder to watch
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(FTP_FOLDER_PATH));

let allImages = [];

// Helper to determine status and date from filename
function parseSCMVSFile(fullPath, filename) {
    let status = 'UNKNOWN';
    const upperPath = fullPath.toUpperCase();
    const upperName = filename.toUpperCase();

    if (upperPath.includes('\\OK\\') || upperPath.includes('/OK/')) {
        status = 'OK';
    } else if (upperPath.includes('\\NG\\') || upperPath.includes('/NG/')) {
        status = 'NG';
    } else {
        if (upperName.includes('OK') && !upperName.includes('LOGGING')) status = 'OK';
        else if (upperName.includes('NG') && !upperName.includes('LOGGING')) status = 'NG';
    }

    let dateStr = 'Unknown Date';
    let recipe = 'Unknown Recipe';
    
    const dateMatch = filename.match(/!(\d{4})_(\d{2})_(\d{2})/);
    if (dateMatch) {
        dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }
    
    // Extract recipe name (e.g., xPASTE_LOGGING from !2026_03..._xPASTE_LOGGING!)
    const recipeMatch = filename.match(/_([A-Za-z0-9-]+)!/);
    if (recipeMatch) {
        recipe = recipeMatch[1];
    }

    return { status, dateStr, recipe };
}

// Initial directory scan
console.log(`Starting SCMVS Real-time Dashboard...`);
console.log(`Scanning target folder: ${FTP_FOLDER_PATH}`);

if (!fs.existsSync(FTP_FOLDER_PATH)) {
    fs.mkdirSync(FTP_FOLDER_PATH, { recursive: true });
}

// Initialize Chokidar watcher
const watcher = chokidar.watch(FTP_FOLDER_PATH, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 5,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
});

watcher.on('add', (filePath) => {
    if (!filePath.match(/\.(jpg|jpeg|png|bmp)$/i)) return;
    
    const filename = path.basename(filePath);
    const relativePath = path.relative(FTP_FOLDER_PATH, filePath).replace(/\\/g, '/');
    const url = `/images/${relativePath}`;
    
    const { status, dateStr, recipe } = parseSCMVSFile(filePath, filename);
    
    const imgData = {
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        name: filename,
        status: status,
        date: dateStr,
        recipe: recipe,
        url: url
    };

    if (!allImages.find(img => img.url === url)) {
        allImages.push(imgData);
        io.emit('new_image', imgData);
        console.log(`[NEW IMAGE] ${status} - ${filename}`);
    }
});

watcher.on('ready', () => {
    console.log(`\n✅ Initial scan complete. Ready for new images.`);
    console.log(`Found ${allImages.length} existing images.`);
});

// --- REST APIs ---
app.get('/api/images', (req, res) => {
    res.json(allImages);
});

// --- SIMULATION LOGIC ---
let simInterval = null;
const LOG_SOURCE_DIR = 'C:\\Users\\xSixtanic\\Desktop\\AJI_LOG';

app.get('/api/simulation/start', (req, res) => {
    if (simInterval) return res.json({ status: 'already running' });
    
    let okFiles = [];
    let ngFiles = [];

    try {
        const okPath = path.join(LOG_SOURCE_DIR, 'OK');
        if (fs.existsSync(okPath)) okFiles = fs.readdirSync(okPath).map(f => path.join(okPath, f));
        
        const ngPath = path.join(LOG_SOURCE_DIR, 'NG');
        if (fs.existsSync(ngPath)) ngFiles = fs.readdirSync(ngPath).map(f => path.join(ngPath, f));
    } catch (err) {
        return res.status(500).json({ error: 'Log directory not found' });
    }

    if (okFiles.length === 0 && ngFiles.length === 0) {
        return res.status(400).json({ error: 'No images found in AJI_LOG folder' });
    }

    console.log(`[SIMULATOR] Starting data feed...`);
    io.emit('sim_status', { active: true });

    simInterval = setInterval(() => {
        let isOk = Math.random() < 0.8;
        if (okFiles.length === 0) isOk = false;
        if (ngFiles.length === 0) isOk = true;

        const sourceList = isOk ? okFiles : ngFiles;
        const randomFile = sourceList[Math.floor(Math.random() * sourceList.length)];
        
        const ext = path.extname(randomFile);
        const baseName = path.basename(randomFile, ext);
        const uniqueFilename = `${baseName}_SIM_${Date.now()}${ext}`;
        
        const statusFolder = isOk ? 'OK' : 'NG';
        const targetDir = path.join(FTP_FOLDER_PATH, statusFolder);
        
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        const targetFile = path.join(targetDir, uniqueFilename);

        try {
            fs.copyFileSync(randomFile, targetFile);
        } catch (err) {}
    }, 2000);

    res.json({ status: 'started' });
});

app.get('/api/simulation/stop', (req, res) => {
    if (simInterval) {
        clearInterval(simInterval);
        simInterval = null;
        console.log(`[SIMULATOR] Stopped.`);
    }
    io.emit('sim_status', { active: false });
    res.json({ status: 'stopped' });
});


io.on('connection', (socket) => {
    console.log('Dashboard Client connected.');
    socket.emit('sim_status', { active: simInterval !== null });
    socket.on('disconnect', () => console.log('Dashboard Client disconnected.'));
});

server.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`🚀 Real-time Dashboard running at: http://localhost:${PORT}`);
    console.log(`==============================================\n`);
});
