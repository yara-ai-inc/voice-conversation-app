const { test, expect } = require('@playwright/test');

test.describe('Voice App Auth and Error Testing', () => {
  test('should capture all console errors and test auth flow', async ({ page }) => {
    const logs = {
      errors: [],
      warnings: [],
      info: [],
      logs: []
    };

    // Capture all console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      const entry = {
        type,
        text,
        url: location?.url,
        line: location?.lineNumber,
        column: location?.columnNumber,
        timestamp: new Date().toISOString()
      };

      switch(type) {
        case 'error':
          logs.errors.push(entry);
          break;
        case 'warning':
          logs.warnings.push(entry);
          break;
        case 'info':
          logs.info.push(entry);
          break;
        default:
          logs.logs.push(entry);
      }
    });

    // Capture uncaught exceptions
    page.on('pageerror', error => {
      logs.errors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Capture failed requests
    page.on('requestfailed', request => {
      logs.errors.push({
        type: 'requestfailed',
        url: request.url(),
        method: request.method(),
        error: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      });
    });

    // Navigate to the app
    console.log('Navigating to app...');
    await page.goto('http://localhost:3000');
    
    // Wait for app to load
    await page.waitForSelector('.voice-interface', { timeout: 10000 });
    console.log('App loaded successfully');

    // Print initial state
    const statusText = await page.locator('.status-text').textContent();
    console.log(`\nInitial status: "${statusText}"`);

    // Click to trigger auth
    console.log('\nClicking interface to trigger auth...');
    await page.click('.voice-interface');
    await page.waitForTimeout(1000);

    // Check for auth modal
    const authModal = page.locator('.auth-modal');
    if (await authModal.isVisible()) {
      console.log('Auth modal opened');
      
      // Try test auth
      const testAuthButton = page.locator('.test-auth');
      if (await testAuthButton.isVisible()) {
        console.log('Clicking test auth button...');
        await testAuthButton.click();
        await page.waitForTimeout(2000);
        
        // Check new status
        const newStatus = await page.locator('.status-text').textContent();
        console.log(`Status after auth: "${newStatus}"`);
      }
    }

    // Check for WebSocket connection
    const connectionStatus = page.locator('.connection-status');
    if (await connectionStatus.isVisible()) {
      const status = await connectionStatus.textContent();
      console.log(`\nConnection status: "${status}"`);
    }

    // Wait a bit for any async errors
    await page.waitForTimeout(3000);

    // Print all captured logs
    console.log('\n========== CAPTURED LOGS ==========');
    
    if (logs.errors.length > 0) {
      console.log('\n🔴 ERRORS:');
      logs.errors.forEach((err, i) => {
        console.log(`\n[${i + 1}] ${err.text}`);
        if (err.url) console.log(`   URL: ${err.url}`);
        if (err.line) console.log(`   Location: line ${err.line}, column ${err.column}`);
        if (err.stack) console.log(`   Stack: ${err.stack}`);
      });
    }

    if (logs.warnings.length > 0) {
      console.log('\n🟡 WARNINGS:');
      logs.warnings.forEach((warn, i) => {
        console.log(`[${i + 1}] ${warn.text}`);
      });
    }

    if (logs.info.length > 0) {
      console.log('\n🔵 INFO:');
      logs.info.forEach((info, i) => {
        console.log(`[${i + 1}] ${info.text}`);
      });
    }

    // Try to interact with voice features
    console.log('\n\nTesting voice interaction...');
    const connectedStatus = await page.locator('.connection-status.connected').isVisible();
    
    if (connectedStatus) {
      console.log('✅ WebSocket connected!');
      
      // Try clicking to start listening
      await page.click('.voice-interface');
      await page.waitForTimeout(1000);
      
      const finalStatus = await page.locator('.status-text').textContent();
      console.log(`Final status: "${finalStatus}"`);
    } else {
      console.log('❌ WebSocket not connected');
    }

    // Filter out known non-critical errors
    const criticalErrors = logs.errors.filter(err => 
      !err.text?.includes('Failed to parse source map') &&
      !err.text?.includes('DEP_WEBPACK')
    );

    console.log(`\n\nTotal errors: ${logs.errors.length}`);
    console.log(`Critical errors: ${criticalErrors.length}`);
    
    // Print critical errors summary
    if (criticalErrors.length > 0) {
      console.log('\n⚠️  CRITICAL ERRORS FOUND:');
      criticalErrors.forEach(err => {
        console.log(`- ${err.text}`);
      });
    }
  });
});