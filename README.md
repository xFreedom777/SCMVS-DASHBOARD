# SC-3000_INSTACTED-DASHBOARD

A real-time, dark-themed, interactive web dashboard designed for the **Smart Camera Machine Vision System (SCMVS)** at Ajinomoto Co., (Thailand) Ltd. This dashboard tracks real-time OK/NG metrics, visualizes production trends, categorizes defects, and generates professional executive reports.

## Features

- **Real-Time Data Polling**: Continuously fetches production data (`data.json`) without requiring a page refresh.
- **Dynamic Data Visualization**: Uses Chart.js to render a stacked bar chart displaying hourly production trends (OK vs NG).
- **KPI Metrics**: Calculates and displays Total Inspected, Total OK, Total NG, and Yield Rate in real-time.
- **Defect Categorization**: Automatically groups and ranks NG defects by recipe/type into a 'Defect Tier' list.
- **Image Evidence Gallery**: Displays images of NG (defective) products with status badges, timestamps, and recipe labels.
- **CSV Data Export**: One-click export of raw production data into a standard CSV format for deeper analysis.
- **Premium PDF Executive Report**: 
  - Generates a highly polished, multi-page PDF report.
  - Automatically calculates layout sizes for A4 Landscape printing.
  - Includes Executive Summaries, KPI metrics, Hourly Production Tables, and an organized Image Evidence gallery.
  - Uses `html2pdf.js` with pixel-perfect rigid block scaling.

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/xFreedom777/SC-3000_INSTACTED-DASHBOARD.git
   cd SC-3000_INSTACTED-DASHBOARD
   ```

2. **File Structure**:
   - `public/index.html` - The main dashboard interface.
   - `public/style.css` - Custom CSS styling for the dark theme.
   - `public/script.js` - Core logic for data fetching, chart rendering, and PDF generation.
   - `data.json` - The real-time data source (needs to be continuously updated by the SCMVS backend).

3. **Running the Application**:
   Since the dashboard uses modern JavaScript (like `fetch` API for `data.json`), it must be served over an HTTP server. You cannot just open the `index.html` file via `file://` protocol due to CORS restrictions.
   
   **Using Node.js / Express (Recommended):**
   ```bash
   node server.js
   ```
   *Then open `http://localhost:3000` in your browser.*

   **Using Python (Quick Test):**
   ```bash
   cd public
   python -m http.server 3000
   ```
   *Then open `http://localhost:3000` in your browser.*

## Usage Guide

1. **Live Monitoring**: Leave the dashboard open. It will automatically fetch `data.json` every few seconds and update the KPIs, Chart, and Image Gallery.
2. **Filtering by Date**: Use the Date Picker dropdown in the top navigation bar to filter data and images for a specific date or select "All Dates" to see everything.
3. **Exporting CSV**: Click the **"Export CSV"** button to download the currently filtered dataset as a spreadsheet.
4. **Generating PDF Reports**: Click the **"Export PDF"** button. The system will briefly render the report in the background and prompt you to download the finalized `SCMVS_Executive_Report_YYYY-MM-DD.pdf` file.

## Technical Stack
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Charting**: [Chart.js](https://www.chartjs.org/)
- **PDF Generation**: [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/)

## License
Confidential property of Ajinomoto Co., (Thailand) Ltd.
