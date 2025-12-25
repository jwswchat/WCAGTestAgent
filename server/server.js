
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { crawl } = require('./crawler');
const { runTests } = require('./testRunner');

const app = express();
const PORT = 3001;

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Serving reports
app.use('/reports', express.static(path.join(__dirname, '../reports')));

// In-memory status store
const jobs = {};

app.post('/api/scan', async (req, res) => {
    const { url, limit } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const maxPages = parseInt(limit) || 10; // Default to 10 if not provided
    console.log(`Received scan request for ${url} (Limit: ${maxPages})`);

    const reportId = uuidv4();
    jobs[reportId] = { status: 'starting', url };

    res.json({ reportId });

    // Start background process
    (async () => {
        try {
            jobs[reportId].status = 'crawling';
            console.log(`[${reportId}] Crawling ${url}...`);
            const urls = await crawl(url, maxPages);

            if (urls.length === 0) {
                throw new Error('No pages found');
            }

            jobs[reportId].status = 'testing';
            jobs[reportId].pageCount = urls.length;
            console.log(`[${reportId}] Testing ${urls.length} pages...`);

            await runTests(urls, reportId);

            jobs[reportId].status = 'completed';
            jobs[reportId].reportUrl = `/reports/${reportId}/index.html`;
            console.log(`[${reportId}] Completed.`);
        } catch (err) {
            console.error(`[${reportId}] Failed:`, err);
            jobs[reportId].status = 'failed';
            jobs[reportId].error = err.message;
        }
    })();
});

app.get('/api/status/:reportId', (req, res) => {
    const { reportId } = req.params;
    const job = jobs[reportId];
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
