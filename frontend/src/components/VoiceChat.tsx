'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { useWebRTC } from '@/hooks/useWebRTC';
import { wsManager } from '@/lib/websocket';
import { formatLevel, formatTime } from '@/lib/utils';
import { WSMessage } from '@/types';

interface ChatMessage {
  id: string;
  from: 'me' | 'partner';
  message: string;
  time: Date;
}

export default function VoiceChat() {
  const { user, currentMatch, clearMatch } = useStore();
  const {
    connectionState,
    isAudioEnabled,
    startCall,
    endCall,
    toggleAudio,
  } = useWebRTC();

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [sessionTime, setSessionTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [wsConnected, setWsConnected] = useState(wsManager.isConnected);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (message: WSMessage) => {
      if (message.type === 'chat') {
        setChatMessages(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          from: 'partner' as const,
          message: message.message || '',
          time: new Date(),
        }]);
      } else if (message.type === 'session_ended') {
        endCall();
        clearMatch();
      } else if (message.type === 'connection_status') {
        setWsConnected(message.data?.connected || false);
      }
    };

    wsManager.addMessageHandler(handleMessage);
    return () => wsManager.removeMessageHandler(handleMessage);
  }, [endCall, clearMatch]);

  // Start voice call when matched
  useEffect(() => {
    if (currentMatch && !isCallStarted) {
      setIsCallStarted(true);
      setTimeout(() => startCall(), 1000);
    }
  }, [currentMatch, isCallStarted, startCall]);

  // Check if user is at bottom of chat
  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  }, []);

  // Auto-scroll chat only if user is at bottom
  useEffect(() => {
    if (chatContainerRef.current && shouldAutoScroll) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, shouldAutoScroll]);

  // Session timer
  useEffect(() => {
    const interval = setInterval(() => setSessionTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleEndCall = () => {
    if (currentMatch?.session_id) {
      wsManager.endSession(currentMatch.session_id);
    }
    endCall();
    clearMatch();
    setIsCallStarted(false);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && currentMatch) {
      const msg = chatInput.trim();
      setChatMessages(prev => [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        from: 'me',
        message: msg,
        time: new Date(),
      }]);
      wsManager.sendChat(currentMatch.partner_id, msg);
      setChatInput('');
      setShouldAutoScroll(true);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      setShouldAutoScroll(true);
    }
  };

  if (!currentMatch || !user) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-900">
      {/* Header */}
      <header className="flex-shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-white">
                {currentMatch.partner_username[0].toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-white font-semibold">{currentMatch.partner_username}</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-primary-400">Level {formatLevel(currentMatch.partner_level)}</span>
                <span className="text-slate-500">•</span>
                <span className={connectionState === 'connected' ? 'text-emerald-400' : 'text-yellow-400'}>
                  {connectionState === 'connected' ? 'Ulandi ✓' : 'Ulanmoqda...'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-white font-mono text-lg">{formatTime(sessionTime)}</div>
            <button onClick={handleEndCall} className="btn btn-danger text-sm">
              Tugatish
            </button>
          </div>
        </div>
      </header>

      {/* Voice Status Bar */}
      <div className="flex-shrink-0 bg-slate-800/50 border-b border-slate-700 p-3">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-6">
          <div className="flex items-center gap-1 text-xs">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-slate-400">Server</span>
          </div>

          {connectionState === 'connected' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-end gap-0.5 h-5">
                {[40, 70, 100, 60, 30].map((h, i) => (
                  <div 
                    key={i}
                    className="w-1 bg-emerald-500 rounded-full animate-pulse" 
                    style={{ height: `${h}%`, animationDelay: `${i * 150}ms` }} 
                  />
                ))}
              </div>
              <span className="text-emerald-400 text-sm">Ovoz ulandi</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-yellow-400 text-sm">Ulanmoqda...</span>
            </div>
          )}

          <button
            onClick={toggleAudio}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isAudioEnabled 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {isAudioEnabled ? '🎤 Mikrofon yoniq' : '🔇 Mikrofon o\'chiq'}
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full min-h-0">
        <div 
          ref={chatContainerRef} 
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ minHeight: 0 }}
        >
          <div className="text-center py-2">
            <div className="inline-block bg-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-400">
              {currentMatch.partner_username} bilan session boshlandi 🎉
            </div>
          </div>

          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                  msg.from === 'me'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-slate-700 text-white rounded-bl-sm'
                }`}
              >
                <p className="break-words">{msg.message}</p>
                <p className={`text-xs mt-1 ${msg.from === 'me' ? 'text-primary-200' : 'text-slate-400'}`}>
                  {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {chatMessages.length === 0 && (
            <div className="text-center text-slate-500 py-8">
              <p className="text-lg">💬</p>
              <p>Hali xabar yo'q</p>
              <p className="text-sm">Pastda yozing!</p>
            </div>
          )}
        </div>

        {!shouldAutoScroll && chatMessages.length > 3 && (
          <div className="relative">
            <button
              onClick={scrollToBottom}
              className="absolute -top-12 right-4 w-10 h-10 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center shadow-lg z-10"
            >
              ⬇️
            </button>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <div className="flex-shrink-0 bg-slate-800 border-t border-slate-700 p-4">
        <form onSubmit={handleSendChat} className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-slate-700 rounded-full px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Xabar yozing..."
              autoFocus
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="w-12 h-12 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-full flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
