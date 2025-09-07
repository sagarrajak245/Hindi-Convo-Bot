import { createClient } from '@deepgram/sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json());

// Updated CORS configuration
app.use(cors({
  origin: [
    'https://hindi-convo-bot-frontend.onrender.com',
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'x-session-id',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Authorization'
  ]
}));

// Handle preflight requests - fix the wildcard pattern
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,x-session-id,X-Requested-With,Accept,Origin,Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    return res.sendStatus(200);
  }
  next();
});

app.use(limiter);

// Setup for file uploads (audio) with validation
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimes = [
      'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4',
      'audio/ogg', 'audio/webm', 'audio/flac', 'audio/x-wav'
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Initialize API Clients with better error handling
let genAI, elevenlabs, deepgram;

// Add environment variable logging for debugging
console.log('🔍 Environment check:');
console.log('- GOOGLE_GEMINI_API_KEY:', process.env.GOOGLE_GEMINI_API_KEY ? 'Present' : 'Missing');
console.log('- ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'Present' : 'Missing');
console.log('- DEEPGRAM_API_KEY:', process.env.DEEPGRAM_API_KEY ? 'Present' : 'Missing');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || 'Not set');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'development');

try {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error('GOOGLE_GEMINI_API_KEY is required');
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is required');
  }
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY is required');
  }

  genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  console.log('✅ All API clients initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize API clients:', error.message);
  console.error('💡 Make sure all API keys are set in your environment variables');
  // Don't exit in production, just log the error
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
}

// Voice configurations for different languages/preferences
const VOICE_CONFIGS = {
  hindi_male: "pNInz6obpgDQGcFmaJgB", // Adam
  hindi_female: "EXAVITQu4vr4xnSDxMaL", // Bella
  multilingual: "pNInz6obpgDQGcFmaJgB" // Adam (good for Hindi)
};

function getVoiceId(preference) {
  if (VOICE_CONFIGS[preference]) {
    return VOICE_CONFIGS[preference];
  }
  return preference || VOICE_CONFIGS.multilingual;
}

// Chat session management
const chatSessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of chatSessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      chatSessions.delete(sessionId);
      console.log(`🗑️ Cleaned up session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Helper function to get or create chat session
function getOrCreateChatSession(sessionId) {
  if (!sessionId) {
    sessionId = uuidv4();
  }

  let session = chatSessions.get(sessionId);

  if (!session) {
    // Check if genAI is available
    if (!genAI) {
      throw new Error('Gemini AI client not initialized. Check API keys.');
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        maxOutputTokens: 1024,
      }
    });

    const chat = model.startChat({
      history: [{
        role: "user",
        parts: [{
          text: `You are a helpful and friendly AI assistant named 'Dost' (which means friend in Hindi). 
                 You must reply ONLY in conversational Hindi using Devanagari script. 
                 Keep your responses natural, warm, and conversational. 
                 If asked about technical topics, explain them simply in Hindi.
                 Always be polite and helpful.`
        }]
      }],
    });

    session = {
      chat,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0
    };

    chatSessions.set(sessionId, session);
    console.log(`🆕 Created new session: ${sessionId}`);
  }

  session.lastActivity = Date.now();
  return session;
}

// Health check endpoint with better diagnostics
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: chatSessions.size,
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    apis: {
      gemini: !!genAI,
      elevenlabs: !!elevenlabs,
      deepgram: !!deepgram
    }
  };

  // If any API client is missing, mark as unhealthy
  if (!genAI || !elevenlabs || !deepgram) {
    healthStatus.status = 'unhealthy';
    healthStatus.error = 'Some API clients are not initialized';
  }

  res.json(healthStatus);
});

// Get session info endpoint
app.get('/api/session/:sessionId', (req, res) => {
  const session = chatSessions.get(req.params.sessionId);
  if (session) {
    res.json({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      messageCount: session.messageCount,
      lastActivity: session.lastActivity
    });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// The main API endpoint for the chat
app.post("/api/chat", upload.single("audio"), async (req, res) => {
  const startTime = Date.now();
  let sessionId = req.headers['x-session-id'] || req.body.sessionId;

  try {
    // Check if all services are available
    if (!genAI || !elevenlabs || !deepgram) {
      return res.status(503).json({
        error: "Service temporarily unavailable. API clients not initialized.",
        code: "SERVICE_UNAVAILABLE"
      });
    }

    // Validate audio file
    if (!req.file) {
      return res.status(400).json({
        error: "No audio file provided",
        code: "NO_AUDIO_FILE"
      });
    }

    console.log(`🎵 Processing audio file: ${req.file.size} bytes, type: ${req.file.mimetype}`);

    // 1. Transcribe Audio with Deepgram (Speech-to-Text)
    console.log('🔄 Starting speech-to-text transcription...');

    const { result, error: deepgramError } = await deepgram.listen.prerecorded.transcribeFile(
      req.file.buffer,
      {
        model: "nova-2",
        language: "hi", // Hindi
        punctuate: true,
        diarize: false,
        utterances: true,
        smart_format: true
      }
    );

    if (deepgramError) {
      console.error('❌ Deepgram error:', deepgramError);
      return res.status(500).json({
        error: "Speech recognition failed",
        code: "STT_ERROR",
        details: process.env.NODE_ENV === 'development' ? deepgramError.message : undefined
      });
    }

    const transcribedText = result.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcribedText || transcribedText.trim() === "") {
      console.log("⚠️ Deepgram transcription was empty");
      return res.status(400).json({
        error: "Could not understand audio. Please try again.",
        code: "EMPTY_TRANSCRIPTION"
      });
    }

    console.log(`✅ Transcribed Text: "${transcribedText}"`);

    // 2. Get or create chat session
    const session = getOrCreateChatSession(sessionId);
    sessionId = session.sessionId;
    session.messageCount++;

    // 3. Generate Chat Response with Gemini
    console.log('🔄 Generating response with Gemini...');

    const resultFromGemini = await session.chat.sendMessage(transcribedText);
    const geminiResponseText = resultFromGemini.response.text();

    if (!geminiResponseText || geminiResponseText.trim() === "") {
      throw new Error("Empty response from Gemini");
    }

    console.log(`✅ Gemini Response: "${geminiResponseText}"`);

    // 4. Generate Audio with ElevenLabs (Text-to-Speech)
    console.log('🔄 Converting text to speech...');

    const voiceId = getVoiceId(req.body.voicePreference);
    console.log(`🎤 Using voice ID: ${voiceId} for preference: ${req.body.voicePreference}`);

    const audioStream = await elevenlabs.textToSpeech.stream(voiceId, {
      text: geminiResponseText,
      model_id: "eleven_multilingual_v2"
    });

    // 5. Set response headers and send audio
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("X-Session-Id", sessionId);
    res.setHeader("X-Transcription", encodeURIComponent(transcribedText));
    res.setHeader("X-Response-Text", encodeURIComponent(geminiResponseText));
    res.setHeader("X-Processing-Time", Date.now() - startTime);

    console.log(`✅ Sending audio response (Processing time: ${Date.now() - startTime}ms)`);

    // Handle different types of stream responses
    if (audioStream && typeof audioStream.pipe === 'function') {
      // It's a Node.js stream
      audioStream.pipe(res);
    } else if (audioStream && audioStream.getReader) {
      // It's a ReadableStream (web streams)
      const reader = audioStream.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const audioBuffer = Buffer.concat(chunks);
      res.send(audioBuffer);
    } else {
      // Handle as buffer/arrayBuffer
      const audioBuffer = Buffer.from(await audioStream.arrayBuffer());
      res.send(audioBuffer);
    }

  } catch (error) {
    console.error("❌ Error processing chat:", error);
    console.error("Stack trace:", error.stack);

    // Handle specific error types
    let statusCode = 500;
    let errorResponse = {
      error: "An internal server error occurred",
      code: "INTERNAL_ERROR",
      sessionId: sessionId
    };

    if (error.message.includes('quota') || error.message.includes('limit')) {
      statusCode = 429;
      errorResponse.error = "Service temporarily unavailable due to high demand";
      errorResponse.code = "QUOTA_EXCEEDED";
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      statusCode = 503;
      errorResponse.error = "Service temporarily unavailable";
      errorResponse.code = "SERVICE_UNAVAILABLE";
    } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
      statusCode = 401;
      errorResponse.error = "Authentication failed";
      errorResponse.code = "AUTH_ERROR";
    } else if (error.message.includes('API clients not initialized')) {
      statusCode = 503;
      errorResponse.error = "Service starting up. Please try again in a moment.";
      errorResponse.code = "SERVICE_STARTING";
    }

    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.message;
      errorResponse.stack = error.stack;
    }

    res.status(statusCode).json(errorResponse);
  }
});

// Handle multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 25MB.',
        code: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field.',
        code: 'UNEXPECTED_FILE'
      });
    }
  }

  if (error.message === 'Only audio files are allowed') {
    return res.status(400).json({
      error: 'Only audio files are allowed.',
      code: 'INVALID_FILE_TYPE'
    });
  }

  next(error);
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Something went wrong!',
    code: 'UNHANDLED_ERROR'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

app.listen(port, () => {
  console.log(`🚀 Hindi Voice Bot Server is running at http://localhost:${port}`);
  console.log(`📊 Health check available at http://localhost:${port}/health`);
  console.log(`🎯 Chat API available at http://localhost:${port}/api/chat`);
});

export default app; 