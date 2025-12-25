
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const PORT = 3001;
const TEST_URL = 'https://example.com';
const SERVER_SCRIPT = path.join(__dirname, 'server', 'server.js');

function log(msg) {
    console.log(`[VERIFY] ${msg}`);
}

async function startServer() {
    log('Starting server...');
    const serverProcess = spawn('node', [SERVER_SCRIPT], {
        cwd: __dirname,
        stdio: 'pipe',
        env: process.env // Inherit env
    });

    serverProcess.stdout.on('data', (data) => {
        // console.log(`[SERVER] ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[SERVER ERROR] ${data}`);
    });

    // Wait for server to be ready
    return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
            const req = http.get(`http://localhost:${PORT}`, (res) => {
                if (res.statusCode === 200) {
                    clearInterval(checkInterval);
                    log('Server is ready.');
                    resolve(serverProcess);
                }
            });
            req.on('error', () => { }); // Ignore connection refused
            req.end();
        }, 500);

        // Timeout after 10s
        setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Server failed to start in time'));
        }, 10000);
    });
}

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runVerification() {
    let serverProcess;
    try {
        serverProcess = await startServer();

        // 1. Submit Scan
        log(`Submitting scan for ${TEST_URL}...`);
        const startRes = await makeRequest('POST', '/api/scan', { url: TEST_URL });

        if (startRes.statusCode !== 200 || !startRes.data.reportId) {
            throw new Error(`Failed to start scan: ${JSON.stringify(startRes.data)}`);
        }

        const reportId = startRes.data.reportId;
        log(`Scan started. Report ID: ${reportId}`);

        // 2. Poll Status
        log('Polling status...');
        let status = 'starting';
        let retries = 0;
        const param = { reportId }; // Wait for max 2 mins (approx)

        while (['starting', 'crawling', 'testing'].includes(status) && retries < 60) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await makeRequest('GET', `/api/status/${reportId}`);
            status = statusRes.data.status;
            log(`Current status: ${status}`);

            if (status === 'failed') {
                throw new Error(`Scan failed: ${statusRes.data.error}`);
            }
            retries++;
        }

        if (status !== 'completed') {
            throw new Error('Scan timed out or did not complete successfully.');
        }

        // 3. Verify Report URL
        const reportUrl = `/reports/${reportId}/index.html`;
        log(`Checking report availability at ${reportUrl}...`);

        // Simple HEAD request or GET to ensure 200
        await new Promise((resolve, reject) => {
            const req = http.get(`http://localhost:${PORT}${reportUrl}`, (res) => {
                if (res.statusCode === 200) {
                    log('Report verified accessible.');
                    resolve();
                } else {
                    reject(new Error(`Report URL returned status ${res.statusCode}`));
                }
            });
            req.on('error', reject);
            req.end();
        });

        log('VERIFICATION SUCCESSFUL!');

    } catch (err) {
        console.error(`[VERIFY FAILED] ${err.message}`);
        process.exit(1);
    } finally {
        if (serverProcess) {
            log('Stopping server...');
            serverProcess.kill();
        }
    }
}

runVerification();
