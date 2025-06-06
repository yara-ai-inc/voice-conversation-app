import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceState, BatonState } from '../types';
import { authService } from '../services/auth.service';
import { voiceWebSocketService } from '../services/websocket.service';
import { audioService } from '../services/audio.service';
import { batonService } from '../services/baton.service';

export interface UseVoiceConversationOptions {
  autoConnect?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onAIResponse?: (text: string) => void;
  onError?: (error: any) => void;
}

export function useVoiceConversation(options: UseVoiceConversationOptions = {}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [batonState, setBatonState] = useState<BatonState>('USER_HOLDING');
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAIResponse] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionActive = useRef(false);

  // Initialize services and connections
  useEffect(() => {
    const initialize = async () => {
      if (options.autoConnect) {
        await connect();
      }
    };

    initialize();

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []);

  // Subscribe to baton state changes
  useEffect(() => {
    const unsubscribe = batonService.onStateChange((state) => {
      setBatonState(state);
    });

    return unsubscribe;
  }, []);

  // Connect to voice service
  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // Get auth token
      const token = await authService.getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('No user found');
      }

      // Connect WebSocket
      await voiceWebSocketService.connect({
        userId: user.uid,
        token,
        audioConfig: {
          sampleRate: 16000,
          bitDepth: 16,
          channels: 1,
          chunkSize: 8192
        }
      });

      setIsConnected(true);
      sessionActive.current = true;

      // Set up WebSocket event handlers
      setupWebSocketHandlers();

    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message);
      options.onError?.(err);
    }
  }, [options]);

  // Disconnect from voice service
  const disconnect = useCallback(() => {
    sessionActive.current = false;
    stopListening();
    audioService.stopPlayback();
    voiceWebSocketService.disconnect();
    batonService.reset();
    setIsConnected(false);
    setVoiceState('idle');
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (voiceState !== 'idle' && voiceState !== 'error') {
      return;
    }

    try {
      setVoiceState('listening');
      setError(null);

      // Start audio recording
      await audioService.startRecording((audioData) => {
        if (sessionActive.current) {
          voiceWebSocketService.sendAudioData(audioData);
        }
      });

      // Start monitoring audio levels
      startAudioLevelMonitoring();

    } catch (err: any) {
      console.error('Failed to start listening:', err);
      setError(err.message);
      setVoiceState('error');
      options.onError?.(err);
    }
  }, [voiceState, options]);

  // Stop listening
  const stopListening = useCallback(() => {
    audioService.stopRecording();
    stopAudioLevelMonitoring();
    
    if (voiceState === 'listening') {
      setVoiceState('idle');
    }
  }, [voiceState]);

  // Handle tap interaction
  const handleTap = useCallback(() => {
    switch (voiceState) {
      case 'idle':
        startListening();
        break;
        
      case 'listening':
        // Pass baton to AI
        batonService.handleExplicitPass();
        voiceWebSocketService.sendMessage({ type: 'end_of_speech' });
        stopListening();
        setVoiceState('thinking');
        break;
        
      case 'speaking':
        // Interrupt AI
        audioService.stopPlayback();
        batonService.handleInterruption();
        voiceWebSocketService.sendMessage({ type: 'interrupt' });
        setVoiceState('idle');
        break;
        
      default:
        break;
    }
  }, [voiceState, startListening, stopListening]);

  // Set up WebSocket event handlers
  const setupWebSocketHandlers = useCallback(() => {
    // Handle transcripts
    voiceWebSocketService.on('transcript', (data) => {
      const { text, is_final } = data;
      setTranscript(text);
      options.onTranscript?.(text, is_final);
      
      // Check for baton pass
      const shouldPass = batonService.handleUserTranscript(text, is_final);
      if (shouldPass && voiceState === 'listening') {
        stopListening();
        setVoiceState('thinking');
      }
    });

    // Handle AI responses
    voiceWebSocketService.on('ai_response', (data) => {
      const { text } = data;
      setAIResponse(text);
      options.onAIResponse?.(text);
      
      // Prepare response for baton handoff
      batonService.handleAIPrepared(text);
    });

    // Handle audio data
    voiceWebSocketService.on('audio_data', async (data) => {
      const { audio, format } = data;
      
      if (voiceState === 'thinking') {
        setVoiceState('speaking');
      }
      
      try {
        await audioService.playAudio(audio, format);
      } catch (err) {
        console.error('Audio playback error:', err);
      }
    });

    // Handle audio chunks (for streaming)
    voiceWebSocketService.on('audio_chunk', async (data) => {
      const { data: audioData, format } = data;
      
      if (voiceState === 'thinking') {
        setVoiceState('speaking');
      }
      
      try {
        await audioService.playAudio(audioData, format);
      } catch (err) {
        console.error('Audio chunk playback error:', err);
      }
    });

    // Handle response end
    voiceWebSocketService.on('response_end', () => {
      batonService.handleAISpeechComplete();
      setVoiceState('idle');
    });

    // Handle errors
    voiceWebSocketService.on('error', (data) => {
      console.error('WebSocket error:', data);
      const errorMessage = data?.error || data?.message || 'Connection error';
      setError(errorMessage);
      setVoiceState('error');
      options.onError?.(data);
    });

    // Handle connection close
    voiceWebSocketService.on('close', () => {
      setIsConnected(false);
      if (sessionActive.current) {
        // Attempt reconnection
        setTimeout(() => {
          if (sessionActive.current) {
            connect();
          }
        }, 2000);
      }
    });
  }, [voiceState, options, connect, stopListening]);

  // Monitor audio levels
  const startAudioLevelMonitoring = () => {
    audioLevelInterval.current = setInterval(async () => {
      const level = await audioService.getAudioLevel();
      setAudioLevel(level);
    }, 100);
  };

  const stopAudioLevelMonitoring = () => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
    setAudioLevel(0);
  };

  // Retry after error
  const retry = useCallback(() => {
    setError(null);
    setVoiceState('idle');
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  return {
    // State
    voiceState,
    batonState,
    isConnected,
    transcript,
    aiResponse,
    audioLevel,
    error,
    
    // Actions
    connect,
    disconnect,
    startListening,
    stopListening,
    handleTap,
    retry,
    
    // Diagnostics
    getDiagnostics: () => ({
      ...batonService.getDiagnostics(),
      isRecording: audioService.isRecording(),
      isPlaying: audioService.isPlayingAudio(),
      webSocketState: voiceWebSocketService.getReadyState()
    })
  };
}