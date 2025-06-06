import React, { useState, useEffect } from 'react';
import { useVoiceConversation } from '../hooks/useVoiceConversation';
import { TherapeuticOrb } from './TherapeuticOrb';
import { authService } from '../services/auth.service';
import { User } from 'firebase/auth';
import './VoiceInterface.css';

export function VoiceInterface() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  
  const {
    voiceState,
    batonState,
    isConnected,
    transcript,
    aiResponse,
    audioLevel,
    error,
    connect,
    disconnect,
    handleTap,
    retry
  } = useVoiceConversation({
    autoConnect: false,
    onTranscript: (text, isFinal) => {
      console.log('Transcript:', text, isFinal);
    },
    onAIResponse: (text) => {
      console.log('AI Response:', text);
    },
    onError: (err) => {
      console.error('Voice error:', err);
    }
  });

  // Subscribe to auth state
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((user) => {
      setUser(user);
      if (user && !isConnected) {
        connect();
      }
    });

    return unsubscribe;
  }, [connect, isConnected]);

  // Handle authentication
  const handleAuth = async () => {
    try {
      if (authService.isDevelopmentMode()) {
        // Use test token in development
        await authService.signInWithTestToken('test-user-123');
      } else {
        // Use Google sign-in in production
        await authService.signInWithGoogle();
      }
      setShowAuth(false);
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    disconnect();
  };

  // Get status text
  const getStatusText = () => {
    if (error) return 'Error - Tap to retry';
    if (!isConnected) return 'Connecting...';
    
    switch (voiceState) {
      case 'idle':
        return 'Tap anywhere to start';
      case 'listening':
        return 'Listening... Tap to respond';
      case 'thinking':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking... Tap to interrupt';
      default:
        return '';
    }
  };

  // Handle full screen tap
  const handleFullScreenTap = (e: React.MouseEvent) => {
    // Prevent tap if clicking on buttons or auth modal
    if ((e.target as HTMLElement).closest('.control-button, .auth-modal')) {
      return;
    }
    
    if (error) {
      retry();
    } else if (user && isConnected) {
      handleTap();
    } else if (!user) {
      setShowAuth(true);
    }
  };

  return (
    <div className="voice-interface" onClick={handleFullScreenTap}>
      {/* Header */}
      <header className="voice-header">
        <h1 className="voice-title">Yara Voice</h1>
        {user && (
          <button 
            className="control-button sign-out-button"
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="voice-main">
        {/* Orb visualization */}
        <div className="orb-container">
          <TherapeuticOrb 
            voiceState={voiceState} 
            audioLevel={audioLevel}
            className="therapeutic-orb"
          />
        </div>

        {/* Status text */}
        <div className="status-container">
          <p className="status-text">{getStatusText()}</p>
          {batonState !== 'USER_HOLDING' && (
            <p className="baton-status">Baton: {batonState}</p>
          )}
        </div>

        {/* Transcript display (optional) */}
        {showTranscript && (
          <div className="transcript-container">
            {transcript && (
              <div className="transcript user-transcript">
                <span className="transcript-label">You:</span> {transcript}
              </div>
            )}
            {aiResponse && (
              <div className="transcript ai-transcript">
                <span className="transcript-label">Yara:</span> {aiResponse}
              </div>
            )}
          </div>
        )}

        {/* Submit button (for explicit baton pass) */}
        {voiceState === 'listening' && (
          <button 
            className="control-button submit-button"
            onClick={(e) => {
              e.stopPropagation();
              handleTap();
            }}
            aria-label="Submit response"
          >
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
            </svg>
          </button>
        )}
      </main>

      {/* Footer controls */}
      <footer className="voice-footer">
        <button
          className="control-button toggle-transcript"
          onClick={(e) => {
            e.stopPropagation();
            setShowTranscript(!showTranscript);
          }}
        >
          {showTranscript ? 'Hide' : 'Show'} Transcript
        </button>
        
        {isConnected && (
          <div className="connection-status connected">
            Connected
          </div>
        )}
      </footer>

      {/* Authentication modal */}
      {showAuth && !user && (
        <div className="auth-modal-overlay" onClick={() => setShowAuth(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sign in to Yara Voice</h2>
            <p>Connect with your therapist through voice conversations</p>
            
            <button 
              className="auth-button google-auth"
              onClick={handleAuth}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
            
            {authService.isDevelopmentMode() && (
              <button 
                className="auth-button test-auth"
                onClick={handleAuth}
              >
                Use Test Account (Dev Mode)
              </button>
            )}
            
            <button 
              className="auth-button cancel-auth"
              onClick={() => setShowAuth(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}