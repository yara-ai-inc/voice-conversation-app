export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export type BatonState = 
  | 'USER_HOLDING' 
  | 'PREPARING' 
  | 'READY_TO_PASS' 
  | 'AI_HOLDING' 
  | 'TRANSITIONING';

export interface AudioConfig {
  sampleRate: number;
  bitDepth: number;
  channels: number;
  chunkSize: number;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
}

export interface SessionConfig {
  userId: string;
  token: string;
  sessionId?: string;
  audioConfig?: AudioConfig;
}

export interface TranscriptMessage {
  type: 'transcript';
  data: {
    text: string;
    is_final: boolean;
    timestamp?: number;
  };
}

export interface AIResponseMessage {
  type: 'ai_response';
  data: {
    text: string;
    audio_available: boolean;
    session_id?: string;
  };
}

export interface AudioDataMessage {
  type: 'audio_data';
  data: {
    audio: string; // base64 encoded
    format: 'mp3' | 'opus' | 'aac' | 'linear16';
    sample_rate?: number;
    is_final?: boolean;
  };
}

export interface ErrorMessage {
  type: 'error';
  data: {
    error: string;
    code?: string;
    details?: any;
  };
}

export interface SessionStartMessage {
  type: 'session_start';
  data: {
    session_id: string;
    audio_format?: string;
    sample_rate?: number;
  };
}

export type VoiceMessage = 
  | TranscriptMessage 
  | AIResponseMessage 
  | AudioDataMessage 
  | ErrorMessage 
  | SessionStartMessage;