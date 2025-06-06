const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log('Mock WebSocket server starting...');

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.url);
  
  // Send session start message
  ws.send(JSON.stringify({
    type: 'session_start',
    data: {
      session_id: 'mock-session-' + Date.now(),
      audio_format: 'mp3',
      sample_rate: 24000
    }
  }));

  ws.on('message', (message) => {
    try {
      // Handle binary audio data
      if (message instanceof Buffer) {
        console.log('Received audio data:', message.length, 'bytes');
        
        // Simulate transcript after receiving some audio
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'transcript',
            data: {
              text: 'Hello, this is a test transcript',
              is_final: false
            }
          }));
        }, 500);
        
        // Simulate final transcript
        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'transcript',
            data: {
              text: 'Hello, how can I help you today?',
              is_final: true
            }
          }));
        }, 1000);
        
        return;
      }

      // Handle JSON messages
      const msg = JSON.parse(message);
      console.log('Received message:', msg.type);
      
      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        case 'session_config':
          console.log('Session config:', msg.data);
          break;
          
        case 'end_of_speech':
          // Simulate AI response
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'ai_response',
              data: {
                text: 'I understand. Let me help you with that.',
                audio_available: true
              }
            }));
            
            // Simulate audio data
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'audio_data',
                data: {
                  audio: 'SGVsbG8gV29ybGQ=', // Base64 encoded dummy audio
                  format: 'mp3',
                  is_final: false
                }
              }));
            }, 200);
            
            // End response
            setTimeout(() => {
              ws.send(JSON.stringify({
                type: 'response_end'
              }));
            }, 500);
          }, 500);
          break;
          
        case 'interrupt':
          console.log('Interrupt received');
          ws.send(JSON.stringify({
            type: 'interrupt_acknowledged'
          }));
          break;
          
        case 'session_end':
          console.log('Session ending');
          ws.close();
          break;
          
        default:
          console.log('Unknown message type:', msg.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          error: 'Invalid message format',
          details: error.message
        }
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server
server.listen(8000, () => {
  console.log('Mock WebSocket server running on ws://localhost:8000');
  console.log('Connect to ws://localhost:8000/voice/v2/stream');
});