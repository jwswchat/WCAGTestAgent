
const urlInput = document.getElementById('urlInput');
const scanBtn = document.getElementById('scanBtn');
const statusSection = document.getElementById('statusSection');
const resultSection = document.getElementById('resultSection');
const statusText = document.getElementById('statusText');
const detailsText = document.getElementById('detailsText');
const progressFill = document.getElementById('progressFill');
const reportLink = document.getElementById('reportLink');

const limitInput = document.getElementById('limitInput');

let pollInterval;

scanBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const limit = parseInt(limitInput.value) || 10;

    if (!url) return;

    // Reset UI
    scanBtn.disabled = true;
    statusSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    progressFill.style.width = '10%';
    statusText.textContent = 'Starting...';
    detailsText.textContent = `Target: ${limit} pages max`;

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, limit })
        });

        if (!response.ok) throw new Error('Failed to start scan');

        const { reportId } = await response.json();
        pollStatus(reportId);

    } catch (err) {
        alert(err.message);
        scanBtn.disabled = false;
        statusSection.classList.add('hidden');
    }
});

function pollStatus(reportId) {
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${reportId}`);
            const data = await response.json();

            if (data.status === 'crawling') {
                statusText.textContent = 'Crawling...';
                progressFill.style.width = '30%';
                detailsText.textContent = 'Discovering pages';
            } else if (data.status === 'testing') {
                statusText.textContent = 'Testing...';
                progressFill.style.width = '60%';
                detailsText.textContent = `Scanning ${data.pageCount || '?'} pages for WCAG compliance`;
            } else if (data.status === 'completed') {
                clearInterval(pollInterval);
                statusText.textContent = 'Completed';
                progressFill.style.width = '100%';
                scanBtn.disabled = false;

                resultSection.classList.remove('hidden');
                reportLink.href = data.reportUrl;
            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                statusText.textContent = 'Failed';
                detailsText.textContent = data.error;
                scanBtn.disabled = false;
                progressFill.style.backgroundColor = '#ef4444';
            }

        } catch (err) {
            console.error('Polling error:', err);
        }
    }, 2000);
}
