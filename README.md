# हिंदी AI दोस्त - Hindi Voice Chat Bot

A real-time voice chat application that allows users to have natural conversations with an AI assistant in Hindi. The application supports speech-to-text, AI response generation, and text-to-speech with multiple voice options.

# Live Demo: [Hindi-Bot](https://hindi-convo-bot-frontend.onrender.com/)

# Output:

<img width="1122" height="780" alt="image" src="https://github.com/user-attachments/assets/5e663ee0-dd63-41ec-846c-0824030a2402" />

<img width="1000" height="821" alt="image" src="https://github.com/user-attachments/assets/77555c66-6387-42e7-a2fa-5fe1e5622af7" />


## 🌟 Features

- **Voice Recording**: Click to start/stop recording your voice messages
- **Speech Recognition**: Converts Hindi speech to text using Deepgram API
- **AI Conversations**: Intelligent responses in Hindi using Google Gemini AI
- **Text-to-Speech**: Natural voice responses using ElevenLabs API
- **Multiple Voices**: Choose from different Hindi voice options
- **Auto-play**: AI responses play automatically after processing
- **Session Management**: Maintains conversation context across messages
- **Real-time UI**: Modern, responsive interface with loading indicators

## 🛠️ Technology Stack

### Frontend
- **React** - User interface framework
- **Tailwind CSS** - Styling and responsive design
- **React Icons** - Icon library for UI elements
- **Web APIs** - MediaRecorder API for audio recording

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **Multer** - File upload handling
- **CORS** - Cross-origin resource sharing

### AI Services
- **Deepgram API** - Speech-to-text transcription
- **Google Gemini AI** - Conversational AI responses
- **ElevenLabs API** - Text-to-speech synthesis (option 1)
- **Google Gemini AI** - Text-to-speech synthesis (option2)

## 📋 Prerequisites

Before running this application, make sure you have:

- Node.js (v16 or higher)
- npm or yarn package manager
- API keys for:
  - Deepgram API
  - Google Gemini AI
  - ElevenLabs API

## 🔑 API Keys Setup

You'll need to obtain API keys from the following services:

1. **Deepgram API**: Visit [Deepgram Console](https://console.deepgram.com/)
2. **Google Gemini AI**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
3. **ElevenLabs API**: Visit [ElevenLabs](https://elevenlabs.io/app/speech-synthesis)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/hindi-voice-chat-bot.git
cd hindi-voice-chat-bot
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment variables file
cp .env.example .env
```

### 3. Configure Environment Variables

Edit the `.env` file with your API keys:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# API Keys
GOOGLE_GEMINI_API_KEY=your_gemini_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

### 4. Frontend Setup

```bash
# Navigate to frontend directory (open new terminal)
cd frontend

# Install dependencies
npm install
```

### 5. Start the Application

**Backend (Terminal 1):**
```bash
cd backend
npm start
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

## 🎯 How It Works

### 1. Voice Recording
- User clicks the microphone button to start recording
- Browser's MediaRecorder API captures audio
- Click the button again to stop recording

### 2. Speech Processing Pipeline
```
Audio Recording → Deepgram (STT) → Gemini AI → ElevenLabs (TTS) → Auto-play Response
```

### 3. Detailed Flow
1. **Audio Capture**: User's voice is recorded as WebM audio blob
2. **Transcription**: Deepgram converts Hindi speech to text
3. **AI Processing**: Gemini AI generates contextual Hindi response
4. **Voice Synthesis**: ElevenLabs converts response text to natural speech
5. **Auto-play**: Response audio plays automatically
6. **Session Management**: Conversation context is maintained

### 4. Voice Options
- **एडम (बहुभाषी)**: Multilingual voice (default)
- **एडम (हिंदी पुरुष)**: Hindi male voice
- **बेला (हिंदी महिला)**: Hindi female voice

## 📁 Project Structure

```
hindi-voice-chat-bot/
├── backend/
│   ├── server.js              # Main server file
│   ├── package.json           # Backend dependencies
│   └── .env                   # Environment variables
├── frontend/
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   └── index.js          # React entry point
│   ├── package.json          # Frontend dependencies
│   └── public/
└── README.md
```

## 🔧 Configuration

### Voice Configuration
The backend supports multiple voice configurations in `server.js`:

```javascript
const VOICE_CONFIGS = {
  hindi_male: "pNInz6obpgDQGcFmaJgB",     // Adam
  hindi_female: "EXAVITQu4vr4xnSDxMaL",   // Bella
  multilingual: "pNInz6obpgDQGcFmaJgB"    // Adam (multilingual)
};
```

### Rate Limiting
- 100 requests per 15 minutes per IP address
- 25MB maximum file size for audio uploads
- 30-minute session timeout

## 🛡️ Security Features

- Input validation for audio files
- Rate limiting to prevent abuse
- Session management with automatic cleanup
- CORS configuration for secure cross-origin requests
- Error handling with appropriate status codes

## 🎨 UI Features

- **Modern Design**: Dark theme with gradient backgrounds
- **Responsive Layout**: Works on desktop and mobile devices
- **Visual Feedback**: Loading indicators and status messages
- **Audio Controls**: Play/pause buttons with visual states
- **Settings Panel**: Voice selection and conversation management

## 🔍 API Endpoints

### POST `/api/chat`
Main endpoint for voice chat processing

**Request:**
- `audio`: Audio file (multipart/form-data)
- `voicePreference`: Voice selection
- `x-session-id`: Session ID (header)

**Response:**
- Audio stream (MP3)
- Headers with transcription and response text
- Session ID for conversation continuity

### GET `/health`
Health check endpoint for monitoring

### GET `/api/session/:sessionId`
Get session information

## 🐛 Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Ensure browser has microphone permissions
   - Use HTTPS in production for microphone access

2. **API Key Errors**
   - Verify all API keys are correctly set in `.env`
   - Check API key permissions and quotas

3. **Audio Playback Issues**
   - Some browsers may block auto-play
   - Check browser audio settings

4. **Connection Issues**
   - Ensure backend is running on port 3001
   - Check CORS configuration if accessing from different domain

### Debug Mode
Set `NODE_ENV=development` in `.env` for detailed error messages.

## 📈 Performance Optimization

- Audio streaming for faster response times
- Session cleanup to prevent memory leaks
- Request validation to reduce processing overhead
- Error handling to maintain application stability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Deepgram** for speech recognition services
- **Google Gemini AI** for conversational AI capabilities
- **ElevenLabs** for natural voice synthesis
- **React** and **Express.js** communities for excellent frameworks

## 📞 Support

For support or questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review API documentation for the services used

---

**Note**: This application requires active API keys from third-party services. Please ensure you have appropriate quotas and billing set up for production use.
