# SCMVS Realtime Dashboard V.2 (Executive Edition)

![Dashboard Preview](https://img.shields.io/badge/Status-Production%20Ready-success)
![Platform](https://img.shields.io/badge/Platform-Siemens%20IOT2050%20%7C%20Windows-blue)

A professional, real-time Machine Vision monitoring dashboard built for executive reporting. Designed specifically to interface with industrial Smart Cameras (e.g., SC-3000, Keyence, Omron) via **FTP file transfers**.

---

## 🏗️ Architecture & FTP Interface

This dashboard operates on a lightweight event-driven architecture, avoiding the need for complex database setups. It acts as an edge-computing monitoring layer.

### How the Camera -> FTP -> Dashboard Pipeline Works:

1. **Smart Camera (Edge Device):** The industrial camera is configured to inspect parts and output judgment results (OK/NG).
2. **FTP Upload:** The camera uses its built-in FTP client to push the captured image to the local PC/IOT2050 device.
3. **Naming Convention (Crucial):** The camera MUST name the uploaded file using the following format:
   `!YYYY_MM_DD_HH_MM_SS_µs_PROJECTNAME!_SIM_ID.jpg`
   *(Example: `!2026_03_09_11_01_59_145996_xPASTE_LOGGING!_SIM_1786121395768.jpg`)*
4. **File Watcher (`server.js`):** The Node.js server continuously monitors the designated FTP root folder using `chokidar`.
5. **Real-time Processing:** 
   - When a new image arrives, the server parses the filename.
   - It extracts the **Recipe Name** (e.g., `xPASTE_LOGGING`).
   - It checks if the image was dropped into the `OK` or `NG` subfolder.
6. **WebSocket Broadcast:** The server instantly emits the parsed data to the Web UI via `Socket.io`, updating charts, tier lists, and image galleries in less than 100ms.

---

## 🚀 Features

- **Real-time Synchronization:** Instant UI updates without page reloads.
- **Recipe-based Tier List:** Automatically ranks the recipes (products) that produce the highest number of defects (NG), complete with Gold/Silver/Bronze indicators.
- **Live Production Trend:** Hourly defect vs. pass rates plotted on an interactive chart.
- **Executive PDF Reporting:** 1-click A4 PDF export. The system seamlessly converts the dark-mode dashboard into a clean, symmetric, white-background executive report.
- **Built-in Simulator:** Includes a camera simulator script to test the dashboard without needing physical hardware.

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- An FTP Server software running on the host machine (e.g., FileZilla Server) pointing to the log directory.

### 1. Clone the Repository
```bash
git clone https://github.com/xFreedom777/SCMVS-DASHBOARD.git
cd SCMVS-DASHBOARD
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure the Target Folder
By default, the server monitors: `C:\Users\xSixtanic\Desktop\AJI_LOG`
If your FTP server saves images to a different path, open `server.js` and edit the `sourceDir` variable:
```javascript
const sourceDir = 'C:\\Path\\To\\Your\\FTP\\Folder';
```

### 4. Run the Dashboard
You can start the server manually:
```bash
node server.js
```
*Or use the provided batch file (Windows only):*
Double-click `Start_Realtime_Dashboard.bat`

### 5. Access the Web UI
Open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

---

## 🧪 Testing with the Simulator

Don't have a camera connected yet? Use the built-in simulator to generate fake OK/NG images and test the dashboard.

1. Ensure the dashboard server is running (`node server.js`).
2. Open a new terminal and run:
   ```bash
   node simulate_camera.js
   ```
3. Watch the dashboard update in real-time as the simulator "FTPs" files into the folder.

---

## 👨‍💻 Developer Notes
- **Styling:** The dashboard uses Vanilla CSS with CSS Variables for a glassmorphism dark-theme layout.
- **PDF Export:** Managed via `html2pdf.js`. CSS classes (`.exporting-pdf`) are injected temporarily during export to ensure symmetric A4 rendering and prevent page breaks inside elements.
