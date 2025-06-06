# Yara Voice Conversation App

A React/TypeScript single-page application implementing a low-latency, two-way voice conversation interface with the yara-backend therapeutic service.

## Features

- **Real-time Voice Conversations**: Bidirectional audio streaming with < 100ms perceived latency
- **Intelligent Baton Handoff**: Predictive AI response preparation with natural conversation flow
- **Cross-Browser Support**: Works on Safari, Chrome, Edge, Firefox, and Brave
- **3D Orb Visualization**: Animated therapeutic orb using Three.js
- **Google/Firebase Authentication**: Secure user authentication
- **Responsive Design**: Optimized for desktop and mobile devices

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your Firebase credentials and backend URL.

3. **Start development server**:
   ```bash
   npm start
   ```

## Architecture

### Core Services

- **AuthService**: Handles Firebase authentication and token management
- **WebSocketService**: Manages WebSocket connections with automatic reconnection
- **AudioService**: WebAudio API implementation for recording and playback
- **BatonService**: Implements conversation flow control and turn-taking

### Key Components

- **VoiceInterface**: Main UI component orchestrating the voice experience
- **TherapeuticOrb**: Three.js-based 3D visualization responding to voice states
- **useVoiceConversation**: Custom hook managing the entire voice conversation flow

### Voice States

1. **idle**: Ready to start conversation
2. **listening**: Recording user speech
3. **thinking**: AI processing response
4. **speaking**: Playing AI response
5. **error**: Error state with retry capability

### Baton States

- **USER_HOLDING**: User has conversation control
- **PREPARING**: AI preparing response
- **READY_TO_PASS**: Response ready for instant delivery
- **AI_HOLDING**: AI speaking
- **TRANSITIONING**: Switching control

## Performance Optimizations

- Audio worklet processing for low-latency recording
- Pre-buffering and streaming for smooth playback
- Predictive response preparation during user speech
- Automatic provider failover for reliability
- Connection pooling and keep-alive for WebSocket

## Browser Compatibility

- Chrome 90+
- Safari 14.1+
- Firefox 88+
- Edge 90+
- Brave (latest)

## Development

### Running with local backend:
```bash
# Start yara-backend first
cd ../yara-backend
python static_files/https_server.py

# Then start the React app
cd ../voice-conversation-app
npm start
```

### Using test authentication:
Set `REACT_APP_USE_TEST_AUTH=true` in `.env` for development mode.

## Production Build

```bash
npm run build
```

The build folder will contain optimized production assets ready for deployment.