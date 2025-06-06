const { test, expect } = require('@playwright/test');

test.describe('Voice App Full Flow Test', () => {
  test('complete voice conversation flow', async ({ page }) => {
    // Track all errors and logs
    const logs = {
      errors: [],
      warnings: [],
      info: [],
      logs: [],
      websocket: []
    };

    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      const entry = {
        type,
        text,
        url: location?.url,
        line: location?.lineNumber,
        timestamp: new Date().toISOString()
      };

      if (text.includes('WebSocket')) {
        logs.websocket.push(entry);
      }

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

    // Monitor WebSocket
    page.on('websocket', ws => {
      console.log('WebSocket connection opened:', ws.url());
      
      ws.on('framesent', frame => {
        logs.websocket.push({
          type: 'sent',
          data: frame.payload?.toString?.() || '[Binary Data]',
          timestamp: new Date().toISOString()
        });
      });
      
      ws.on('framereceived', frame => {
        logs.websocket.push({
          type: 'received',
          data: frame.payload?.toString?.() || '[Binary Data]',
          timestamp: new Date().toISOString()
        });
      });
    });

    // Navigate to app
    console.log('\n=== STARTING TEST ===');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('.voice-interface', { timeout: 10000 });

    // Test 1: Initial State
    console.log('\n1. Testing initial state...');
    const initialStatus = await page.locator('.status-text').textContent();
    console.log(`   Status: "${initialStatus}"`);
    
    // Test 2: Trigger Auth
    console.log('\n2. Testing authentication...');
    await page.click('.voice-interface');
    await page.waitForTimeout(500);
    
    const authModal = page.locator('.auth-modal');
    if (await authModal.isVisible()) {
      console.log('   Auth modal visible');
      
      // Click test auth
      const testAuth = page.locator('.test-auth');
      if (await testAuth.isVisible()) {
        console.log('   Clicking test auth...');
        await testAuth.click();
        await page.waitForTimeout(2000);
      }
    }

    // Test 3: Check Connection
    console.log('\n3. Checking WebSocket connection...');
    await page.waitForTimeout(2000);
    
    const connectionStatus = page.locator('.connection-status.connected');
    const isConnected = await connectionStatus.isVisible();
    console.log(`   Connected: ${isConnected}`);
    
    if (isConnected) {
      // Test 4: Start Voice Session
      console.log('\n4. Testing voice interaction...');
      
      // Grant microphone permissions
      await page.context().grantPermissions(['microphone']);
      
      // Click to start listening
      await page.click('.voice-interface');
      await page.waitForTimeout(1000);
      
      const listeningStatus = await page.locator('.status-text').textContent();
      console.log(`   Status: "${listeningStatus}"`);
      
      // Test 5: Simulate Baton Pass
      console.log('\n5. Testing baton pass...');
      const submitButton = page.locator('.submit-button');
      if (await submitButton.isVisible()) {
        console.log('   Submit button visible, clicking...');
        await submitButton.click();
        await page.waitForTimeout(2000);
        
        const thinkingStatus = await page.locator('.status-text').textContent();
        console.log(`   Status: "${thinkingStatus}"`);
      }
      
      // Test 6: Test Interruption
      console.log('\n6. Testing interruption...');
      await page.waitForTimeout(1000);
      await page.click('.voice-interface');
      
      const interruptStatus = await page.locator('.status-text').textContent();
      console.log(`   Status after interrupt: "${interruptStatus}"`);
    }

    // Print Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Errors: ${logs.errors.length}`);
    console.log(`Warnings: ${logs.warnings.length}`);
    console.log(`WebSocket messages: ${logs.websocket.length}`);
    
    // Print errors (excluding known issues)
    const criticalErrors = logs.errors.filter(err => 
      !err.text?.includes('Failed to parse source map') &&
      !err.text?.includes('DEP_WEBPACK')
    );
    
    if (criticalErrors.length > 0) {
      console.log('\n=== CRITICAL ERRORS ===');
      criticalErrors.forEach((err, i) => {
        console.log(`\n[${i + 1}] ${err.text}`);
        if (err.url) console.log(`   at ${err.url}:${err.line}`);
      });
    }

    // Print WebSocket activity
    if (logs.websocket.length > 0) {
      console.log('\n=== WEBSOCKET ACTIVITY ===');
      logs.websocket.slice(-10).forEach(ws => {
        console.log(`[${ws.type}] ${ws.data?.substring?.(0, 100) || ws.text || ws.data}`);
      });
    }

    // Assert no critical errors
    expect(criticalErrors.length).toBe(0);
  });
});