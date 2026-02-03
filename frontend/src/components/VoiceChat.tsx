"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useWebRTC } from "@/hooks/useWebRTC";
import { wsManager } from "@/lib/websocket";
import { formatLevel, formatTime } from "@/lib/utils";
import { WSMessage } from "@/types";

interface ChatMsg {
  id: string;
  from: "me" | "partner";
  text: string;
  time: Date;
}

export default function VoiceChat() {
  const user = useStore((s) => s.user);
  const currentMatch = useStore((s) => s.currentMatch);
  const clearMatch = useStore((s) => s.clearMatch);

  const { status, micOn, startCall, endCall, toggleMic } = useWebRTC();

  const chatRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);

  // Start call once
  useEffect(() => {
    if (currentMatch && !started) {
      setStarted(true);
      startCall();
    }
  }, [currentMatch, started, startCall]);

  // Timer
  useEffect(() => {
    const i = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Messages
  useEffect(() => {
    const handler = (msg: WSMessage) => {
      if (msg.type === "chat" && msg.message) {
        setMsgs((p) => [
          ...p,
          {
            id: Date.now().toString(),
            from: "partner",
            text: msg.message!,
            time: new Date(),
          },
        ]);
      } else if (msg.type === "session_ended") {
        endCall();
        clearMatch();
      }
    };
    wsManager.addMessageHandler(handler);
    return () => wsManager.removeMessageHandler(handler);
  }, [endCall, clearMatch]);

  // Scroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [msgs]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = input.trim();
    if (!txt || !currentMatch) return;
    setMsgs((p) => [
      ...p,
      { id: Date.now().toString(), from: "me", text: txt, time: new Date() },
    ]);
    wsManager.sendChat(currentMatch.partner_id, txt);
    setInput("");
  };

  const handleEnd = () => {
    if (currentMatch?.session_id) {
      wsManager.endSession(currentMatch.session_id);
    }
    endCall();
    clearMatch();
  };

  if (!currentMatch || !user) return null;

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 px-3 py-2 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-primary-600 rounded-full flex items-center justify-center text-white font-bold">
            {currentMatch.partner_username[0].toUpperCase()}
          </div>
          <div>
            <div className="text-white text-sm font-medium">
              {currentMatch.partner_username}
            </div>
            <div className="text-xs text-slate-400">
              {formatLevel(currentMatch.partner_level)} •
              <span
                className={
                  status === "connected"
                    ? "text-green-400"
                    : status === "failed"
                    ? "text-red-400"
                    : "text-yellow-400"
                }
              >
                {status === "connected"
                  ? " Ulandi"
                  : status === "failed"
                  ? " Xatolik"
                  : " Ulanmoqda..."}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-mono">
            {formatTime(time)}
          </span>
          <button
            onClick={handleEnd}
            className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg"
          >
            Tugatish
          </button>
        </div>
      </div>

      {/* Voice bar */}
      <div className="bg-slate-800/50 px-3 py-2 flex items-center justify-center gap-4 border-b border-slate-700">
        {status === "connected" ? (
          <span className="text-green-400 text-xs">🔊 Ovoz ulandi</span>
        ) : status === "failed" ? (
          <span className="text-red-400 text-xs">❌ Ulanmadi</span>
        ) : (
          <span className="text-yellow-400 text-xs">⏳ Ulanmoqda...</span>
        )}
        <button
          onClick={toggleMic}
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            micOn ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {micOn ? "🎤 Yoniq" : "🔇 O'chiq"}
        </button>
      </div>

      {/* Chat messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-center text-slate-500 text-xs py-2">
          {currentMatch.partner_username} bilan suhbat boshlandi
        </div>

        {msgs.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.from === "me" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                m.from === "me"
                  ? "bg-primary-600 text-white"
                  : "bg-slate-700 text-white"
              }`}
            >
              {m.text}
              <div
                className={`text-[10px] mt-1 ${
                  m.from === "me" ? "text-primary-200" : "text-slate-400"
                }`}
              >
                {m.time.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={send}
        className="bg-slate-800 px-3 py-2 border-t border-slate-700"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Xabar yozing..."
            className="flex-1 bg-slate-700 text-white text-base px-4 py-2 rounded-full outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center disabled:opacity-50"
          >
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
