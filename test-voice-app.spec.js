const { test, expect } = require('@playwright/test');

test.describe('Voice Conversation App', () => {
  let consoleMessages = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];

    // Capture all console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        consoleErrors.push({
          type,
          text,
          location: msg.location()
        });
      }
      
      consoleMessages.push({
        type,
        text,
        args: msg.args()
      });
    });

    // Capture page errors
    page.on('pageerror', error => {
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack
      });
    });
  });

  test('should load without console errors', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    
    // Wait for the app to fully load
    await page.waitForSelector('.voice-interface', { timeout: 10000 });
    
    // Check for the main components
    await expect(page.locator('.voice-title')).toBeVisible();
    await expect(page.locator('.orb-container')).toBeVisible();
    await expect(page.locator('.status-text')).toBeVisible();
    
    // Log all console messages for debugging
    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type}] ${msg.text}`);
    });
    
    // Log all errors
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach(error => {
        console.log(`[${error.type}] ${error.text}`);
        if (error.location) {
          console.log(`  at ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
        }
        if (error.stack) {
          console.log('Stack:', error.stack);
        }
      });
    }
    
    // Check authentication state
    const statusText = await page.locator('.status-text').textContent();
    console.log('\nStatus text:', statusText);
    
    // Test clicking to trigger auth
    if (statusText?.includes('Tap anywhere to start')) {
      await page.click('.voice-interface');
      await page.waitForTimeout(1000);
      
      // Check if auth modal appears
      const authModal = page.locator('.auth-modal');
      if (await authModal.isVisible()) {
        console.log('\nAuth modal is visible');
        
        // Click test auth if available
        const testAuthButton = page.locator('.test-auth');
        if (await testAuthButton.isVisible()) {
          console.log('Using test authentication...');
          await testAuthButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Final error check
    expect(consoleErrors.filter(e => 
      !e.text.includes('Failed to parse source map') && // Ignore source map warnings
      !e.text.includes('DEP_WEBPACK') // Ignore webpack deprecation warnings
    )).toHaveLength(0);
  });

  test('should handle WebSocket connection', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Wait for initial load
    await page.waitForSelector('.voice-interface');
    
    // Monitor WebSocket connections
    const wsConnections = [];
    page.on('websocket', ws => {
      console.log('WebSocket opened:', ws.url());
      wsConnections.push(ws);
      
      ws.on('framesent', frame => {
        console.log('WS sent:', frame.payload);
      });
      
      ws.on('framereceived', frame => {
        console.log('WS received:', frame.payload);
      });
      
      ws.on('close', () => {
        console.log('WebSocket closed');
      });
    });
    
    // Try to connect by clicking test auth
    await page.click('.voice-interface');
    await page.waitForTimeout(1000);
    
    const testAuth = page.locator('.test-auth');
    if (await testAuth.isVisible()) {
      await testAuth.click();
      await page.waitForTimeout(3000);
    }
    
    // Check connection status
    const connectionStatus = page.locator('.connection-status');
    if (await connectionStatus.isVisible()) {
      const status = await connectionStatus.textContent();
      console.log('Connection status:', status);
    }
  });
});