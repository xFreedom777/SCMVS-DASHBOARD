const fs = require('fs');
const path = require('path');

const LOG_SOURCE_DIR = 'C:\\Users\\xSixtanic\\Desktop\\AJI_LOG';
const FTP_TARGET_DIR = 'C:\\Users\\xSixtanic\\SCMVS';
const SIMULATION_INTERVAL_MS = 2000; // Copy a file every 2 seconds

// Ensure target directory exists
if (!fs.existsSync(FTP_TARGET_DIR)) {
    fs.mkdirSync(FTP_TARGET_DIR, { recursive: true });
}

// Read all files from OK and NG folders
let okFiles = [];
let ngFiles = [];

try {
    const okPath = path.join(LOG_SOURCE_DIR, 'OK');
    if (fs.existsSync(okPath)) {
        okFiles = fs.readdirSync(okPath).map(f => path.join(okPath, f));
    }
    
    const ngPath = path.join(LOG_SOURCE_DIR, 'NG');
    if (fs.existsSync(ngPath)) {
        ngFiles = fs.readdirSync(ngPath).map(f => path.join(ngPath, f));
    }
} catch (err) {
    console.error("Error reading AJI_LOG directory:", err);
    process.exit(1);
}

const totalFiles = okFiles.length + ngFiles.length;
if (totalFiles === 0) {
    console.error(`No files found in ${LOG_SOURCE_DIR}\\OK or NG.`);
    process.exit(1);
}

console.log(`===========================================`);
console.log(`📷 SCMVS Camera Simulator Started`);
console.log(`Source: ${LOG_SOURCE_DIR}`);
console.log(`Target: ${FTP_TARGET_DIR}`);
console.log(`Found ${okFiles.length} OK files and ${ngFiles.length} NG files.`);
console.log(`Injecting 1 image every ${SIMULATION_INTERVAL_MS/1000} seconds...`);
console.log(`Press Ctrl+C to stop simulation.`);
console.log(`===========================================\n`);

// Simulation Loop
setInterval(() => {
    // 80% chance for OK, 20% chance for NG (if files exist in both)
    let isOk = Math.random() < 0.8;
    
    if (okFiles.length === 0) isOk = false;
    if (ngFiles.length === 0) isOk = true;

    const sourceList = isOk ? okFiles : ngFiles;
    
    // Pick a random file from the selected list
    const randomFile = sourceList[Math.floor(Math.random() * sourceList.length)];
    
    // Create a unique filename so the dashboard detects it as "new"
    const originalName = path.basename(randomFile);
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    
    // Format: baseName_TIMESTAMP.ext to guarantee uniqueness for Chokidar
    const uniqueFilename = `${baseName}_SIM_${Date.now()}${ext}`;
    const targetFile = path.join(FTP_TARGET_DIR, uniqueFilename);

    try {
        // Copy the file to the FTP directory
        fs.copyFileSync(randomFile, targetFile);
        console.log(`[SIMULATOR] Injected: ${isOk ? '🟢 OK' : '🔴 NG'} -> ${uniqueFilename}`);
    } catch (err) {
        console.error(`[SIMULATOR] Error copying file:`, err);
    }

}, SIMULATION_INTERVAL_MS);
