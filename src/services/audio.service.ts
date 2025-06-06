export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private recordingChunks: Blob[] = [];
  private onDataAvailable: ((data: ArrayBuffer) => void) | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      // Create AudioContext with optimal settings
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 24000 // Match backend's Chirp3 HD output
      });

      // Load audio worklet for processing if available
      if (this.audioContext.audioWorklet) {
        try {
          await this.audioContext.audioWorklet.addModule('/audio-processor.js');
        } catch (error) {
          console.warn('AudioWorklet not available, falling back to ScriptProcessor');
        }
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw error;
    }
  }

  // Request microphone permissions and start recording
  async startRecording(onDataAvailable: (data: ArrayBuffer) => void): Promise<void> {
    this.onDataAvailable = onDataAvailable;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      if (!this.audioContext) {
        await this.initializeAudioContext();
      }

      // Resume audio context if suspended
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }

      // Create media stream source
      const source = this.audioContext!.createMediaStreamSource(this.mediaStream);

      // Try to use AudioWorklet first, fall back to ScriptProcessor
      if (this.audioContext!.audioWorklet && !this.audioWorkletNode) {
        try {
          this.audioWorkletNode = new AudioWorkletNode(this.audioContext!, 'audio-processor', {
            processorOptions: {
              bufferSize: 4096,
              sampleRate: 16000
            }
          });

          source.connect(this.audioWorkletNode);
          this.audioWorkletNode.port.onmessage = (event) => {
            if (event.data.type === 'audio' && this.onDataAvailable) {
              this.onDataAvailable(event.data.buffer);
            }
          };
        } catch (error) {
          console.warn('AudioWorklet failed, using ScriptProcessor');
          this.setupScriptProcessor(source);
        }
      } else {
        this.setupScriptProcessor(source);
      }

      // Also set up MediaRecorder for browsers that need it
      this.setupMediaRecorder();

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  private setupScriptProcessor(source: MediaStreamAudioSourceNode): void {
    const bufferSize = 4096;
    this.audioProcessor = this.audioContext!.createScriptProcessor(bufferSize, 1, 1);

    this.audioProcessor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Convert float32 to int16
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      if (this.onDataAvailable) {
        this.onDataAvailable(pcmData.buffer);
      }
    };

    source.connect(this.audioProcessor);
    this.audioProcessor.connect(this.audioContext!.destination);
  }

  private setupMediaRecorder(): void {
    if (!this.mediaStream || !MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return;
    }

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
        bitsPerSecond: 128000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordingChunks.push(event.data);
        }
      };

      // Start recording with timeslice for streaming
      this.mediaRecorder.start(100); // 100ms chunks
    } catch (error) {
      console.warn('MediaRecorder setup failed:', error);
    }
  }

  // Stop recording
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.recordingChunks = [];
  }

  // Play audio from base64 or ArrayBuffer
  async playAudio(audioData: string | ArrayBuffer, format: string = 'mp3'): Promise<void> {
    if (!this.audioContext) {
      await this.initializeAudioContext();
    }

    try {
      // Resume context if needed
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }

      let arrayBuffer: ArrayBuffer;
      
      if (typeof audioData === 'string') {
        // Decode base64 to ArrayBuffer
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        arrayBuffer = audioData;
      }

      // Decode audio data
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      // Add to queue
      this.audioQueue.push(audioBuffer);
      
      // Start playback if not already playing
      if (!this.isPlaying) {
        this.playNextInQueue();
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      throw error;
    }
  }

  private playNextInQueue(): void {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;

    // Create buffer source
    this.currentSource = this.audioContext!.createBufferSource();
    this.currentSource.buffer = audioBuffer;
    this.currentSource.connect(this.audioContext!.destination);

    // Handle playback end
    this.currentSource.onended = () => {
      this.currentSource = null;
      this.playNextInQueue();
    };

    // Start playback
    this.currentSource.start(0);
  }

  // Stop all audio playback
  stopPlayback(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (error) {
        // Ignore errors when stopping
      }
      this.currentSource = null;
    }

    this.audioQueue = [];
    this.isPlaying = false;
  }

  // Get audio levels for visualization
  async getAudioLevel(): Promise<number> {
    if (!this.mediaStream || !this.audioContext) {
      return 0;
    }

    try {
      const analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      
      source.disconnect();
      
      return average / 255; // Normalize to 0-1
    } catch (error) {
      return 0;
    }
  }

  // Check if currently recording
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording' || 
           this.audioProcessor !== null ||
           this.audioWorkletNode !== null;
  }

  // Check if currently playing
  isPlayingAudio(): boolean {
    return this.isPlaying;
  }

  // Cleanup resources
  dispose(): void {
    this.stopRecording();
    this.stopPlayback();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Get supported audio formats
  getSupportedFormats(): string[] {
    const formats = ['mp3', 'wav', 'ogg'];
    
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      formats.push('opus');
    }
    
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      formats.push('aac');
    }
    
    return formats;
  }
}

// Export singleton instance
export const audioService = new AudioService();