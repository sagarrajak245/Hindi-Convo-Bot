import { useEffect, useRef, useState } from "react";
import { FaCog, FaMicrophone, FaRobot, FaStopCircle, FaUser, FaVolumeUp } from 'react-icons/fa';

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [ttsProvider, setTtsProvider] = useState('elevenlabs');
  const [voicePreference, setVoicePreference] = useState('hindi_male');
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const conversationEndRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Updated voice options based on your backend
  const elevenLabsVoices = {
    hindi_male: "एडम (हिंदी पुरुष)",
    hindi_female: "बेला (हिंदी महिला)"
  };

  const geminiVoices = {
    Alnilam: "अल्निलम (जेमिनी)",
    Kore: "कोर (जेमिनी)"
  };

  const ttsProviders = {
    elevenlabs: "ElevenLabs (प्रीमियम)",
    gemini: "Google Gemini (नेटिव)"
  };

  // Get current voice options based on selected provider
  const getCurrentVoiceOptions = () => {
    return ttsProvider === 'gemini' ? geminiVoices : elevenLabsVoices;
  };

  const scrollToBottom = () => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Reset voice preference when provider changes
  useEffect(() => {
    if (ttsProvider === 'gemini') {
      setVoicePreference('Kore'); // Default Gemini voice
    } else {
      setVoicePreference('hindi_male'); // Default ElevenLabs voice
    }
  }, [ttsProvider]);

  // Function to automatically play audio
  const autoPlayAudio = (audioUrl, messageIndex) => {
    // Stop current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(null);
    }

    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    setIsPlaying(messageIndex);

    audio.onended = () => {
      setIsPlaying(null);
      currentAudioRef.current = null;
    };

    audio.onerror = () => {
      setIsPlaying(null);
      currentAudioRef.current = null;
    };

    // Auto-play the audio
    audio.play().catch(error => {
      console.error("Auto-play failed:", error);
      setIsPlaying(null);
      currentAudioRef.current = null;
    });
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsLoading(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        const userMessage = {
          role: 'user',
          type: 'audio',
          timestamp: new Date().toLocaleTimeString('hi-IN')
        };
        setConversation(prev => [...prev, userMessage]);

        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("ttsProvider", ttsProvider); // Send TTS provider
        formData.append("voicePreference", voicePreference);

        try {
          const headers = {};
          if (sessionId) {
            headers['x-session-id'] = sessionId;
          }

          const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

          console.log("Sending request to API:", apiUrl);
          console.log("Using session ID:", sessionId);
          console.log("Using TTS provider:", ttsProvider);
          console.log("Using voice:", voicePreference);

          const response = await fetch(`${apiUrl}/api/chat`, {
            method: "POST",
            body: formData,
            headers: headers
          });

          console.log("API response status:", response.status);
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Server error: ${response.statusText}`);
          }

          // Get session ID from response headers
          const newSessionId = response.headers.get('X-Session-Id');
          if (newSessionId && !sessionId) {
            setSessionId(newSessionId);
          }

          // Get transcription and AI response text from headers
          const transcription = decodeURIComponent(response.headers.get('X-Transcription') || '');
          const aiResponseText = decodeURIComponent(response.headers.get('X-Response-Text') || '');

          const audioBlobResponse = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlobResponse);

          // Update user message with transcription
          if (transcription) {
            setConversation(prev => prev.map((msg, index) =>
              index === prev.length - 1 && msg.role === 'user'
                ? { ...msg, transcription }
                : msg
            ));
          }

          // Add AI response
          const aiMessage = {
            role: 'ai',
            audioUrl,
            text: aiResponseText,
            timestamp: new Date().toLocaleTimeString('hi-IN'),
            ttsProvider // Store which TTS was used
          };

          setConversation(prev => {
            const newConversation = [...prev, aiMessage];

            // Auto-play the AI response after adding it to conversation
            setTimeout(() => {
              autoPlayAudio(audioUrl, newConversation.length - 1);
            }, 200); // Small delay to ensure the message is rendered

            return newConversation;
          });

        } catch (error) {
          console.error("Error sending audio:", error);
          const errorMessage = {
            role: 'ai',
            text: 'माफ़ कीजिए, कुछ गड़बड़ हो गई। कृपया पुनः प्रयास करें।',
            timestamp: new Date().toLocaleTimeString('hi-IN'),
            isError: true
          };
          setConversation(prev => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("माइक्रोफ़ोन तक पहुँचने में त्रुटि हुई। कृपया अनुमति दें।");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handlePlayAudio = (audioUrl, messageIndex) => {
    // Stop current audio if playing
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(null);
    }

    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    setIsPlaying(messageIndex);

    audio.onended = () => {
      setIsPlaying(null);
      currentAudioRef.current = null;
    };

    audio.onerror = () => {
      setIsPlaying(null);
      currentAudioRef.current = null;
    };

    audio.play();
  };

  const clearConversation = () => {
    setConversation([]);
    setSessionId(null);
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-2xl flex flex-col h-[90vh] md:h-[80vh] border border-gray-700">

        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 rounded-t-2xl text-center shadow-lg relative">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <FaRobot className="text-yellow-300" />
            हिंदी AI दोस्त
          </h1>
          <p className="text-sm text-blue-100 mt-1">बात करने के लिए माइक्रोफ़ोन बटन दबाएँ</p>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="absolute right-4 top-4 p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <FaCog />
          </button>

          {/* Settings Panel */}
          {showSettings && (
            <div className="absolute top-16 right-4 bg-gray-800 rounded-lg p-4 shadow-xl border border-gray-600 z-10 min-w-[250px]">
              <div className="space-y-4">
                {/* TTS Provider Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">TTS प्रोवाइडर चुनें:</label>
                  <select
                    value={ttsProvider}
                    onChange={(e) => setTtsProvider(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(ttsProviders).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    {ttsProvider === 'gemini'
                      ? 'तेज़ और नेटिव इंटीग्रेशन'
                      : 'उच्च गुणवत्ता वाली आवाज़'}
                  </p>
                </div>

                {/* Voice Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">आवाज़ चुनें:</label>
                  <select
                    value={voicePreference}
                    onChange={(e) => setVoicePreference(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {Object.entries(getCurrentVoiceOptions()).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Current Settings Display */}
                <div className="bg-gray-700/50 rounded p-3 text-xs">
                  <div className="text-gray-300 mb-1">वर्तमान सेटिंग्स:</div>
                  <div className="text-blue-300">
                    Provider: {ttsProviders[ttsProvider]}
                  </div>
                  <div className="text-green-300">
                    Voice: {getCurrentVoiceOptions()[voicePreference]}
                  </div>
                </div>

                <button
                  onClick={clearConversation}
                  className="w-full bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-sm transition-colors"
                >
                  बातचीत साफ़ करें
                </button>

                {sessionId && (
                  <div className="text-xs text-gray-400 text-center">
                    Session: {sessionId.slice(-8)}
                  </div>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Conversation Area */}
        <main className="flex-grow p-6 overflow-y-auto space-y-4">
          {conversation.length === 0 ? (
            <div className="text-center text-gray-400 mt-8 space-y-2">
              <FaRobot className="text-4xl mx-auto text-blue-400 mb-4" />
              <p>नमस्ते! मैं आपका AI दोस्त हूँ।</p>
              <p className="text-sm">बातचीत शुरू करने के लिए माइक्रोफ़ोन बटन दबाएँ।</p>
              <div className="text-xs text-gray-500 mt-4 bg-gray-700/30 rounded-lg p-3">
                <div>उपयोग में: {ttsProviders[ttsProvider]}</div>
                <div>आवाज़: {getCurrentVoiceOptions()[voicePreference]}</div>
              </div>
            </div>
          ) : (
            conversation.map((msg, index) => (
              <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                {/* Avatar */}
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <FaRobot className="text-white text-sm" />
                  </div>
                )}

                {/* Message */}
                <div className={`max-w-xs lg:max-w-md ${msg.role === 'user' ? 'order-first' : ''}`}>
                  <div className={`p-4 rounded-2xl shadow-lg ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 rounded-br-md'
                    : msg.isError
                      ? 'bg-gradient-to-br from-red-600 to-red-700 rounded-bl-md'
                      : 'bg-gradient-to-br from-gray-700 to-gray-600 rounded-bl-md'
                    }`}>

                    {/* User Audio Message */}
                    {msg.type === 'audio' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FaMicrophone className="text-sm" />
                          <span className="text-sm">वॉयस संदेश</span>
                        </div>
                        {msg.transcription && (
                          <p className="text-sm bg-white/10 rounded-lg p-2 italic">
                            "{msg.transcription}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* AI Audio Response */}
                    {msg.audioUrl && (
                      <div className="space-y-3">
                        {msg.text && (
                          <p className="text-sm bg-white/10 rounded-lg p-3">
                            {msg.text}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handlePlayAudio(msg.audioUrl, index)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isPlaying === index
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                          >
                            <FaVolumeUp className={isPlaying === index ? 'animate-pulse' : ''} />
                            <span className="text-sm">
                              {isPlaying === index ? 'चल रहा है...' : 'सुनें'}
                            </span>
                          </button>

                          {/* TTS Provider Badge */}
                          {msg.ttsProvider && (
                            <span className="text-xs bg-white/10 px-2 py-1 rounded">
                              {msg.ttsProvider === 'gemini' ? '🤖 Gemini' : '🎙️ ElevenLabs'}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Text Only Message */}
                    {msg.text && !msg.audioUrl && <p>{msg.text}</p>}
                  </div>

                  {/* Timestamp */}
                  {msg.timestamp && (
                    <p className={`text-xs text-gray-500 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </p>
                  )}
                </div>

                {/* User Avatar */}
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <FaUser className="text-white text-sm" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaRobot className="text-white text-sm" />
                </div>
                <div className="p-4 rounded-2xl rounded-bl-md bg-gradient-to-br from-gray-700 to-gray-600 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <span className="text-sm ml-2">
                    {ttsProvider === 'gemini' ? 'Gemini से प्रतिक्रिया...' : 'ElevenLabs से आवाज़...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={conversationEndRef} />
        </main>

        {/* Footer */}
        <footer className="p-6 bg-gray-800/50 border-t border-gray-700 rounded-b-2xl">
          <div className="flex items-center justify-center">
            {isLoading ? (
              <div className="text-center text-gray-400 flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                प्रोसेसिंग... कृपया प्रतीक्षा करें
              </div>
            ) : (
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`relative p-6 rounded-full transition-all duration-300 shadow-2xl focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-gray-800 transform hover:scale-105 ${isRecording
                  ? 'bg-gradient-to-br from-red-500 to-red-600 focus:ring-red-500 animate-pulse shadow-red-500/50'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 focus:ring-blue-500 shadow-blue-500/50'
                  }`}
              >
                {isRecording ? (
                  <FaStopCircle size={32} className="drop-shadow-lg" />
                ) : (
                  <FaMicrophone size={32} className="drop-shadow-lg" />
                )}

                {/* Recording pulse effect */}
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-20"></div>
                )}
              </button>
            )}
          </div>

          {/* Status text */}
          <div className="text-center mt-3 text-sm text-gray-400">
            {isRecording ? (
              <span className="text-red-400 font-medium">🎙️ रिकॉर्डिंग... बोलना बंद करने के लिए क्लिक करें</span>
            ) : (
              <div className="space-y-1">
                <span>🎯 बोलने के लिए तैयार</span>
                <div className="text-xs">
                  {ttsProvider === 'gemini' ? '🤖 Gemini TTS' : '🎙️ ElevenLabs'} • {getCurrentVoiceOptions()[voicePreference]}
                </div>
              </div>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;