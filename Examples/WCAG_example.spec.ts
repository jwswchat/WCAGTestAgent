// # Example of testing WCAG conformance using Playwright tool

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.setTimeout(300000);

test('Run WCAG conformance test on an example web page', async ({ page }) => {

    // Login
    await page.goto('https://www.orbispartners.com/');

    // Once logged in to the home page, run axe-core accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    // Log the results (optional) using console log
    console.log('Accessibility Violations:', accessibilityScanResults.violations);

    // Assert that there are no violations
    expect(accessibilityScanResults.violations).toEqual([]);

    // Logout
    await page.getByRole('link', { name: 'Sign Out' }).click();
    
});
