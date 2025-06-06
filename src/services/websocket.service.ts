import { VoiceMessage, SessionConfig } from '../types';

export interface WebSocketServiceOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private heartbeatInterval: number;
  private reconnectAttempts: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private isClosing: boolean = false;
  private sessionConfig: SessionConfig | null = null;

  constructor(options: WebSocketServiceOptions) {
    this.url = options.url;
    this.reconnectInterval = options.reconnectInterval || 1000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.heartbeatInterval = options.heartbeatInterval || 15000;
  }

  // Connect to WebSocket with authentication
  async connect(sessionConfig: SessionConfig): Promise<void> {
    this.sessionConfig = sessionConfig;
    this.isClosing = false;
    
    return new Promise((resolve, reject) => {
      try {
        // Build URL with auth token
        const wsUrl = new URL(this.url);
        
        // In test mode, use the test token from localStorage
        const testToken = localStorage.getItem('test_token');
        const token = testToken || sessionConfig.token;
        
        wsUrl.searchParams.set('token', token);
        
        this.ws = new WebSocket(wsUrl.toString());
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          // Send session configuration
          this.sendMessage({
            type: 'session_config',
            data: {
              userId: sessionConfig.userId,
              sessionId: sessionConfig.sessionId,
              audioConfig: sessionConfig.audioConfig || {
                sampleRate: 16000,
                bitDepth: 16,
                channels: 1,
                chunkSize: 8192
              }
            }
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', { error: 'WebSocket connection error' });
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.stopHeartbeat();
          
          if (!this.isClosing && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
          
          this.emit('close', { code: event.code, reason: event.reason });
        };

        // Set connection timeout
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  // Send JSON message
  sendMessage(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
    }
  }

  // Send binary audio data
  sendAudioData(audioData: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    } else {
      console.error('WebSocket not connected');
    }
  }

  // Subscribe to message types
  on(messageType: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    
    const handlers = this.messageHandlers.get(messageType)!;
    handlers.push(handler);
    
    // Return unsubscribe function
    return () => {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  // Emit message to handlers
  private emit(messageType: string, data: any): void {
    const handlers = this.messageHandlers.get(messageType) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in message handler for ${messageType}:`, error);
      }
    });
  }

  // Handle incoming messages
  private handleMessage(event: MessageEvent): void {
    try {
      if (event.data instanceof ArrayBuffer) {
        // Handle binary audio data
        this.handleBinaryMessage(event.data);
      } else {
        // Handle JSON messages
        const message: VoiceMessage = JSON.parse(event.data);
        this.emit(message.type, message.data);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  // Handle binary audio messages
  private handleBinaryMessage(data: ArrayBuffer): void {
    // Check if message has header (6 bytes)
    if (data.byteLength > 6) {
      const view = new DataView(data);
      const messageType = view.getUint8(0);
      
      if (messageType === 0x01) { // Audio data
        const chunkIndex = view.getUint32(1, false); // big-endian
        const audioFormat = view.getUint8(5);
        
        // Extract audio data (after header)
        const audioData = data.slice(6);
        
        this.emit('audio_chunk', {
          index: chunkIndex,
          format: this.getAudioFormatName(audioFormat),
          data: audioData
        });
      }
    } else {
      // Raw audio data without header
      this.emit('audio_chunk', {
        index: 0,
        format: 'unknown',
        data: data
      });
    }
  }

  // Get audio format name from byte
  private getAudioFormatName(formatByte: number): string {
    switch (formatByte) {
      case 0x01: return 'opus';
      case 0x02: return 'aac';
      case 0x03: return 'mp3';
      case 0x04: return 'linear16';
      default: return 'unknown';
    }
  }

  // Heartbeat mechanism
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Reconnection logic
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    const backoffDelay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    console.log(`Scheduling reconnect in ${backoffDelay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.sessionConfig) {
        this.connect(this.sessionConfig).catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, backoffDelay);
  }

  // Disconnect WebSocket
  disconnect(): void {
    this.isClosing = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'session_end' });
      }
      this.ws.close();
      this.ws = null;
    }
  }

  // Get connection state
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Get WebSocket ready state
  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Export singleton instance with production URL
export const voiceWebSocketService = new WebSocketService({
  url: process.env.REACT_APP_WS_URL || 'wss://localhost:8000/voice/v2/stream',
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 15000
});