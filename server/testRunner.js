
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

/**
 * Generates a Playwright spec file and runs it.
 * 
 * @param {string[]} urls - List of URLs to test.
 * @param {string} reportId - Unique ID for this report.
 * @returns {Promise<string>} - Path to the generated report directory.
 */
async function runTests(urls, reportId) {
    console.log('[TestRunner] v2: loaded');
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const jobTempDir = path.join(tempDir, reportId);
    if (!fs.existsSync(jobTempDir)) {
        fs.mkdirSync(jobTempDir, { recursive: true });
    }

    // 1. Create Playwright Config
    const configContent = `
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  outputDir: 'test-results',
  timeout: 60000,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
`;
    fs.writeFileSync(path.join(jobTempDir, 'playwright.config.js'), configContent);

    // 2. Create Spec File
    const specFileName = `wcag.spec.js`;
    const specContent = `
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG Compliance Tests', () => {
    ${urls.map((url, index) => `
    test('Check ${url}', async ({ page }) => {
        try {
            await page.goto('${url}', { waitUntil: 'domcontentloaded' });
            const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
            
            if (accessibilityScanResults.violations.length > 0) {
                 console.log('Violations found for ${url}: ' + accessibilityScanResults.violations.length);
                 await test.info().attach('accessibility-scan-results', {
                    body: JSON.stringify(accessibilityScanResults.violations, null, 2),
                    contentType: 'application/json'
                 });
            }

            // Use soft assertion so test fails but execution continues cleanly
            expect.soft(accessibilityScanResults.violations.length).toBe(0);

        } catch (e) {
            console.error('Error testing ${url}:', e.message);
            // Re-throw critical errors (like nav failure) to mark test broken
            throw e;
        }
    });
    `).join('\n')}
});
`;

    const specPath = path.join(jobTempDir, specFileName);
    fs.writeFileSync(specPath, specContent);

    // Output directory for the report
    const reportDir = path.join(__dirname, '..', 'reports', reportId);
    if (fs.existsSync(reportDir)) {
        fs.rmSync(reportDir, { recursive: true, force: true });
    }

    // Command to run playwright
    // It will pick up playwright.config.js from CWD
    const cmd = `npx playwright test`;

    console.log(`Running tests for ${reportId} in ${jobTempDir}...`);

    return new Promise((resolve, reject) => {
        // Increase maxBuffer to 10MB to be safe
        const maxBuffer = 1024 * 1024 * 10;

        // Remove CI env since we handle "open: never" in config
        const env = { ...process.env };
        delete env.CI;

        exec(cmd, { cwd: jobTempDir, env, maxBuffer }, async (error, stdout, stderr) => {
            console.log(stdout);

            if (error) {
                console.log('Playwright exited with error (likely violations found). Proceeding to check report.');
            }

            // Default report location defined in config
            const generatedReportDir = path.join(jobTempDir, 'playwright-report');

            // Allow some time for file release
            await new Promise(r => setTimeout(r, 2000));

            if (fs.existsSync(generatedReportDir)) {
                try {
                    // Move to final location
                    fs.renameSync(generatedReportDir, reportDir);
                    console.log('Test run completed, report generated and moved.');
                    resolve(reportDir);
                } catch (moveErr) {
                    console.error('Failed to move report:', moveErr);
                    reject(moveErr);
                }
            } else {
                console.error('Report execution failed, no report generated.');
                const msg = stderr || stdout || 'Unknown error during Playwright execution';
                reject(new Error('Playwright failed to generate report. Details: ' + msg));
            }
        });
    });
}

module.exports = { runTests };
