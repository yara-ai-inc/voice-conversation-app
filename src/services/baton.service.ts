import { BatonState } from '../types';

export interface BatonConfig {
  predictivePreparation: boolean;
  stalenessTimeout: number;
  triggerPhrases: string[];
  sentenceEndPatterns: RegExp[];
}

export class BatonService {
  private state: BatonState = 'USER_HOLDING';
  private preparedResponse: string | null = null;
  private preparedTimestamp: number = 0;
  private lastUserSpeechTime: number = 0;
  private stateListeners: ((state: BatonState) => void)[] = [];
  private config: BatonConfig;

  constructor(config?: Partial<BatonConfig>) {
    this.config = {
      predictivePreparation: true,
      stalenessTimeout: 3000, // 3 seconds
      triggerPhrases: [
        'over to you',
        'what do you think',
        'your thoughts',
        'any ideas',
        'can you help',
        'please explain',
        'tell me',
        'go ahead'
      ],
      sentenceEndPatterns: [
        /[.!?]+\s*$/,
        /\?\s*$/,
        /\.\s*$/,
        /!\s*$/
      ],
      ...config
    };
  }

  // Get current baton state
  getState(): BatonState {
    return this.state;
  }

  // Subscribe to state changes
  onStateChange(callback: (state: BatonState) => void): () => void {
    this.stateListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.stateListeners = this.stateListeners.filter(
        listener => listener !== callback
      );
    };
  }

  // Handle user speech transcript
  handleUserTranscript(transcript: string, isFinal: boolean): boolean {
    this.lastUserSpeechTime = Date.now();

    // Check if user is trying to pass baton
    const shouldPass = this.detectBatonPass(transcript, isFinal);
    
    if (shouldPass && this.state === 'USER_HOLDING') {
      this.setState('PREPARING');
      return true;
    }

    // If user continues speaking after we prepared, mark response as stale
    if (this.state === 'READY_TO_PASS' && !shouldPass) {
      this.checkResponseStaleness();
    }

    return false;
  }

  // Handle AI response preparation
  handleAIPrepared(response: string): void {
    if (this.state === 'PREPARING') {
      this.preparedResponse = response;
      this.preparedTimestamp = Date.now();
      this.setState('READY_TO_PASS');
    }
  }

  // Execute baton handoff
  executeBatonPass(): string | null {
    if (this.state === 'READY_TO_PASS' && this.preparedResponse) {
      // Check if response is still fresh
      const isStale = this.isResponseStale();
      
      if (!isStale) {
        const response = this.preparedResponse;
        this.preparedResponse = null;
        this.setState('TRANSITIONING');
        
        // Transition to AI holding after a brief moment
        setTimeout(() => {
          this.setState('AI_HOLDING');
        }, 100);
        
        return response;
      }
    }
    
    return null;
  }

  // Handle user interruption during AI speech
  handleInterruption(): void {
    if (this.state === 'AI_HOLDING' || this.state === 'TRANSITIONING') {
      this.preparedResponse = null;
      this.setState('USER_HOLDING');
    }
  }

  // Handle AI speech completion
  handleAISpeechComplete(): void {
    if (this.state === 'AI_HOLDING') {
      this.setState('USER_HOLDING');
    }
  }

  // Handle explicit baton pass (e.g., button tap)
  handleExplicitPass(): void {
    if (this.state === 'USER_HOLDING') {
      this.setState('PREPARING');
    }
  }

  // Detect if user is passing baton based on speech
  private detectBatonPass(transcript: string, isFinal: boolean): boolean {
    const lowerTranscript = transcript.toLowerCase().trim();
    
    // Check for explicit trigger phrases
    const hasExplicitTrigger = this.config.triggerPhrases.some(
      phrase => lowerTranscript.includes(phrase)
    );
    
    if (hasExplicitTrigger) {
      return true;
    }
    
    // Check for sentence completion with pause
    if (isFinal) {
      const endsWithSentence = this.config.sentenceEndPatterns.some(
        pattern => pattern.test(transcript)
      );
      
      if (endsWithSentence) {
        // Check if it's a question
        const isQuestion = transcript.trim().endsWith('?');
        return isQuestion;
      }
    }
    
    return false;
  }

  // Check if prepared response is stale
  private checkResponseStaleness(): void {
    if (this.isResponseStale()) {
      this.preparedResponse = null;
      this.setState('USER_HOLDING');
    }
  }

  // Check if response is stale based on timing
  private isResponseStale(): boolean {
    const timeSincePrepared = Date.now() - this.preparedTimestamp;
    const timeSinceUserSpoke = Date.now() - this.lastUserSpeechTime;
    
    return timeSincePrepared > this.config.stalenessTimeout ||
           timeSinceUserSpoke < 500; // User spoke recently
  }

  // Set state and notify listeners
  private setState(newState: BatonState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stateListeners.forEach(listener => listener(newState));
    }
  }

  // Reset baton to initial state
  reset(): void {
    this.state = 'USER_HOLDING';
    this.preparedResponse = null;
    this.preparedTimestamp = 0;
    this.lastUserSpeechTime = 0;
    this.stateListeners.forEach(listener => listener(this.state));
  }

  // Get diagnostic info
  getDiagnostics(): {
    state: BatonState;
    hasPreparedResponse: boolean;
    responseAge: number;
    timeSinceUserSpoke: number;
  } {
    return {
      state: this.state,
      hasPreparedResponse: this.preparedResponse !== null,
      responseAge: this.preparedTimestamp ? Date.now() - this.preparedTimestamp : 0,
      timeSinceUserSpoke: this.lastUserSpeechTime ? Date.now() - this.lastUserSpeechTime : 0
    };
  }
}

// Export singleton instance
export const batonService = new BatonService();