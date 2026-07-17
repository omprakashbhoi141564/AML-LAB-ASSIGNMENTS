/* ═══════════════════════════════════════════════════
   Linear Regression Predictor – script.js
   Sends data to Python Flask + sklearn backend
   ═══════════════════════════════════════════════════ */

// ─── DOM References ───────────────────────────────
const tabCsv       = document.getElementById('tab-csv');
const tabManual    = document.getElementById('tab-manual');
const panelCsv     = document.getElementById('panel-csv');
const panelManual  = document.getElementById('panel-manual');
const dropzone     = document.getElementById('dropzone');
const csvFileInput = document.getElementById('csvFileInput');
const fileNameEl   = document.getElementById('fileName');
const tableBody    = document.getElementById('tableBody');
const addRowBtn    = document.getElementById('addRowBtn');
const runBtn       = document.getElementById('runBtn');
const resultsEl    = document.getElementById('results-section');
const predictInput = document.getElementById('predictInput');
const predictBtn   = document.getElementById('predictBtn');
const predResultEl = document.getElementById('predictionResult');

// ─── State ────────────────────────────────────────
let csvFile         = null;   // raw File object for CSV upload
let manualCsvData   = null;   // parsed CSV data {x, y} for manual-from-csv
let chartInstance   = null;
let regressionResult = null;
let activeTab       = 'csv';

// ═══════════════════════════════════════════════════
// Tab Switching
// ═══════════════════════════════════════════════════
[tabCsv, tabManual].forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        activeTab = target;

        document.querySelectorAll('.tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === target);
            t.setAttribute('aria-selected', t.dataset.tab === target);
        });

        panelCsv.classList.toggle('active', target === 'csv');
        panelManual.classList.toggle('active', target === 'manual');
    });
});

// ═══════════════════════════════════════════════════
// CSV Upload (click + drag-and-drop)
// ═══════════════════════════════════════════════════
dropzone.addEventListener('click', () => csvFileInput.click());

dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
});

csvFileInput.addEventListener('change', () => {
    if (csvFileInput.files[0]) handleCSVFile(csvFileInput.files[0]);
});

function handleCSVFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('Please upload a .csv file', 'error');
        return;
    }
    csvFile = file;
    fileNameEl.textContent = '📄 ' + file.name;
    showToast('File ready — click "Run Regression"', 'success');
}

// ═══════════════════════════════════════════════════
// Manual Data Table
// ═══════════════════════════════════════════════════
let rowCount = 0;

function addTableRow(xVal = '', yVal = '') {
    rowCount++;
    const tr = document.createElement('tr');
    tr.dataset.row = rowCount;
    tr.innerHTML = `
        <td>${rowCount}</td>
        <td><input type="number" class="x-input" value="${xVal}" step="any" placeholder="e.g. 5"></td>
        <td><input type="number" class="y-input" value="${yVal}" step="any" placeholder="e.g. 12"></td>
        <td>
            <button class="delete-row-btn" title="Remove row" aria-label="Remove row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </td>
    `;
    tableBody.appendChild(tr);
    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
        tr.remove();
        renumberRows();
    });
}

function renumberRows() {
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach((tr, i) => {
        tr.querySelector('td:first-child').textContent = i + 1;
    });
    rowCount = rows.length;
}

function getManualData() {
    const rows = tableBody.querySelectorAll('tr');
    const xVals = [], yVals = [];
    rows.forEach(tr => {
        const x = parseFloat(tr.querySelector('.x-input').value);
        const y = parseFloat(tr.querySelector('.y-input').value);
        if (!isNaN(x) && !isNaN(y)) {
            xVals.push(x);
            yVals.push(y);
        }
    });
    return xVals.length >= 2 ? { x: xVals, y: yVals } : null;
}

// Init with 5 empty rows
for (let i = 0; i < 5; i++) addTableRow();
addRowBtn.addEventListener('click', () => addTableRow());

// ═══════════════════════════════════════════════════
// Run Regression (calls Python backend)
// ═══════════════════════════════════════════════════
runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running model...';

    try {
        let result;

        if (activeTab === 'csv') {
            // ── CSV file upload route ──
            if (!csvFile) {
                showToast('Please upload a CSV file first', 'error');
                return;
            }

            const formData = new FormData();
            formData.append('file', csvFile);

            const res = await fetch('/upload-csv', {
                method: 'POST',
                body: formData
            });
            result = await res.json();

            if (result.error) {
                showToast(result.error, 'error');
                return;
            }

            // result contains x, y arrays from server
            displayResults(result.x, result.y, result);

        } else {
            // ── Manual entry route ──
            const data = getManualData();
            if (!data) {
                showToast('Enter at least 2 valid (X, Y) pairs', 'error');
                return;
            }

            const res = await fetch('/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: data.x, y: data.y })
            });
            result = await res.json();

            if (result.error) {
                showToast(result.error, 'error');
                return;
            }

            displayResults(data.x, data.y, result);
        }

    } catch (err) {
        showToast('Could not connect to Python server. Is it running?', 'error');
        console.error(err);
    } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Run Regression`;
    }
});

// ═══════════════════════════════════════════════════
// Display Results
// ═══════════════════════════════════════════════════
function displayResults(xArr, yArr, result) {
    regressionResult = result;

    // Update stat cards
    document.getElementById('valSlope').textContent     = result.slope;
    document.getElementById('valIntercept').textContent  = result.intercept;
    document.getElementById('valR2').textContent         = result.r2;
    document.getElementById('valN').textContent          = result.n;

    // Equation
    const sign = result.intercept >= 0 ? '+' : '−';
    const absB = Math.abs(result.intercept).toFixed(4);
    document.getElementById('equation').innerHTML =
        `<span>Y</span> = ${result.slope} · <span>X</span> ${sign} ${absB}`;

    // Show results
    resultsEl.classList.remove('hidden');
    resultsEl.classList.add('show');

    // Draw chart
    drawChart(xArr, yArr, result);

    // Scroll to results
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Reset prediction
    predResultEl.classList.add('hidden');
    predictInput.value = '';

    showToast('Model trained successfully using sklearn!', 'success');
}

// ═══════════════════════════════════════════════════
// Chart.js Visualization
// ═══════════════════════════════════════════════════
function drawChart(xArr, yArr, result) {
    if (chartInstance) chartInstance.destroy();

    const scatterData = xArr.map((x, i) => ({ x, y: yArr[i] }));

    const xMin = Math.min(...xArr);
    const xMax = Math.max(...xArr);
    const pad  = (xMax - xMin) * 0.1 || 1;
    const lineX1 = xMin - pad;
    const lineX2 = xMax + pad;
    const lineData = [
        { x: lineX1, y: result.slope * lineX1 + result.intercept },
        { x: lineX2, y: result.slope * lineX2 + result.intercept }
    ];

    const ctx = document.getElementById('regressionChart').getContext('2d');

    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Data Points',
                    data: scatterData,
                    backgroundColor: 'rgba(0, 242, 254, 0.25)',
                    borderColor: '#00f2fe',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: '#00f2fe',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2,
                    order: 2
                },
                {
                    label: 'Regression Line (sklearn)',
                    data: lineData,
                    type: 'line',
                    borderColor: '#ef4444',
                    borderWidth: 3,
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#f3f4f6',
                        font: { family: 'Inter', size: 12 },
                        usePointStyle: true
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'X (Independent Variable)',
                        color: '#9ca3af',
                        font: { family: 'Space Grotesk', size: 13, weight: '500' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#6b7280', font: { family: 'Inter' } }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Y (Dependent Variable)',
                        color: '#9ca3af',
                        font: { family: 'Space Grotesk', size: 13, weight: '500' }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#6b7280', font: { family: 'Inter' } }
                }
            }
        }
    });
}

// ═══════════════════════════════════════════════════
// Prediction (calls Python backend)
// ═══════════════════════════════════════════════════
predictBtn.addEventListener('click', predict);
predictInput.addEventListener('keydown', e => { if (e.key === 'Enter') predict(); });

async function predict() {
    if (!regressionResult) {
        showToast('Run regression first', 'error');
        return;
    }
    const xVal = parseFloat(predictInput.value);
    if (isNaN(xVal)) {
        showToast('Enter a valid number for X', 'error');
        return;
    }

    try {
        const res = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                slope: regressionResult.slope,
                intercept: regressionResult.intercept,
                x_new: xVal
            })
        });
        const data = await res.json();

        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        predResultEl.innerHTML = `For <strong>X = ${xVal}</strong>, predicted <strong>Y = ${data.y_predicted}</strong>`;
        predResultEl.classList.remove('hidden');
    } catch (err) {
        showToast('Server error during prediction', 'error');
    }
}

// ═══════════════════════════════════════════════════
// Toast Notifications
// ═══════════════════════════════════════════════════
function showToast(message, type = 'error') {
    document.querySelectorAll('.toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3200);
}

// ═══════════════════════════════════════════════════
// Background Particle Animation Emitter
// ═══════════════════════════════════════════════════
(function() {
    const bgContainer = document.getElementById('bgParticles');
    if (!bgContainer) return;
    
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    bgContainer.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    let width = canvas.width = bgContainer.offsetWidth || window.innerWidth;
    let height = canvas.height = bgContainer.offsetHeight || window.innerHeight;
    
    const particles = [];
    const maxParticles = 60;
    
    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = Math.random() * 0.4 - 0.2;
            this.speedY = Math.random() * 0.4 - 0.2;
            this.opacity = Math.random() * 0.5 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > width || this.y < 0 || this.y > height) {
                this.reset();
            }
        }
        draw() {
            ctx.fillStyle = `rgba(0, 242, 254, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
    }
    
    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', () => {
        width = canvas.width = bgContainer.offsetWidth || window.innerWidth;
        height = canvas.height = bgContainer.offsetHeight || window.innerHeight;
    });
    
    animate();
})();
