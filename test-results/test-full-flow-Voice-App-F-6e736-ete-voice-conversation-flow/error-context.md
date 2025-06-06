# Test info

- Name: Voice App Full Flow Test >> complete voice conversation flow
- Location: /Users/joebraidwood/dev/yara-batonvoice/voice-conversation-app/test-full-flow.spec.js:4:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 5
    at /Users/joebraidwood/dev/yara-batonvoice/voice-conversation-app/test-full-flow.spec.js:168:35
```

# Page snapshot

```yaml
- banner:
  - heading "Yara Voice" [level=1]
  - button "Sign Out"
- main:
  - paragraph: Listening... Tap to respond
  - paragraph: "Baton: PREPARING"
  - button "Submit response":
    - img
- contentinfo:
  - button "Show Transcript"
  - text: Connected
```

# Test source

```ts
   68 |     // Navigate to app
   69 |     console.log('\n=== STARTING TEST ===');
   70 |     await page.goto('http://localhost:3000');
   71 |     await page.waitForSelector('.voice-interface', { timeout: 10000 });
   72 |
   73 |     // Test 1: Initial State
   74 |     console.log('\n1. Testing initial state...');
   75 |     const initialStatus = await page.locator('.status-text').textContent();
   76 |     console.log(`   Status: "${initialStatus}"`);
   77 |     
   78 |     // Test 2: Trigger Auth
   79 |     console.log('\n2. Testing authentication...');
   80 |     await page.click('.voice-interface');
   81 |     await page.waitForTimeout(500);
   82 |     
   83 |     const authModal = page.locator('.auth-modal');
   84 |     if (await authModal.isVisible()) {
   85 |       console.log('   Auth modal visible');
   86 |       
   87 |       // Click test auth
   88 |       const testAuth = page.locator('.test-auth');
   89 |       if (await testAuth.isVisible()) {
   90 |         console.log('   Clicking test auth...');
   91 |         await testAuth.click();
   92 |         await page.waitForTimeout(2000);
   93 |       }
   94 |     }
   95 |
   96 |     // Test 3: Check Connection
   97 |     console.log('\n3. Checking WebSocket connection...');
   98 |     await page.waitForTimeout(2000);
   99 |     
  100 |     const connectionStatus = page.locator('.connection-status.connected');
  101 |     const isConnected = await connectionStatus.isVisible();
  102 |     console.log(`   Connected: ${isConnected}`);
  103 |     
  104 |     if (isConnected) {
  105 |       // Test 4: Start Voice Session
  106 |       console.log('\n4. Testing voice interaction...');
  107 |       
  108 |       // Grant microphone permissions
  109 |       await page.context().grantPermissions(['microphone']);
  110 |       
  111 |       // Click to start listening
  112 |       await page.click('.voice-interface');
  113 |       await page.waitForTimeout(1000);
  114 |       
  115 |       const listeningStatus = await page.locator('.status-text').textContent();
  116 |       console.log(`   Status: "${listeningStatus}"`);
  117 |       
  118 |       // Test 5: Simulate Baton Pass
  119 |       console.log('\n5. Testing baton pass...');
  120 |       const submitButton = page.locator('.submit-button');
  121 |       if (await submitButton.isVisible()) {
  122 |         console.log('   Submit button visible, clicking...');
  123 |         await submitButton.click();
  124 |         await page.waitForTimeout(2000);
  125 |         
  126 |         const thinkingStatus = await page.locator('.status-text').textContent();
  127 |         console.log(`   Status: "${thinkingStatus}"`);
  128 |       }
  129 |       
  130 |       // Test 6: Test Interruption
  131 |       console.log('\n6. Testing interruption...');
  132 |       await page.waitForTimeout(1000);
  133 |       await page.click('.voice-interface');
  134 |       
  135 |       const interruptStatus = await page.locator('.status-text').textContent();
  136 |       console.log(`   Status after interrupt: "${interruptStatus}"`);
  137 |     }
  138 |
  139 |     // Print Summary
  140 |     console.log('\n=== TEST SUMMARY ===');
  141 |     console.log(`Errors: ${logs.errors.length}`);
  142 |     console.log(`Warnings: ${logs.warnings.length}`);
  143 |     console.log(`WebSocket messages: ${logs.websocket.length}`);
  144 |     
  145 |     // Print errors (excluding known issues)
  146 |     const criticalErrors = logs.errors.filter(err => 
  147 |       !err.text?.includes('Failed to parse source map') &&
  148 |       !err.text?.includes('DEP_WEBPACK')
  149 |     );
  150 |     
  151 |     if (criticalErrors.length > 0) {
  152 |       console.log('\n=== CRITICAL ERRORS ===');
  153 |       criticalErrors.forEach((err, i) => {
  154 |         console.log(`\n[${i + 1}] ${err.text}`);
  155 |         if (err.url) console.log(`   at ${err.url}:${err.line}`);
  156 |       });
  157 |     }
  158 |
  159 |     // Print WebSocket activity
  160 |     if (logs.websocket.length > 0) {
  161 |       console.log('\n=== WEBSOCKET ACTIVITY ===');
  162 |       logs.websocket.slice(-10).forEach(ws => {
  163 |         console.log(`[${ws.type}] ${ws.data?.substring?.(0, 100) || ws.text || ws.data}`);
  164 |       });
  165 |     }
  166 |
  167 |     // Assert no critical errors
> 168 |     expect(criticalErrors.length).toBe(0);
      |                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  169 |   });
  170 | });
```