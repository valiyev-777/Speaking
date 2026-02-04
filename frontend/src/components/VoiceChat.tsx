"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useWebRTC } from "@/hooks/useWebRTC";
import { wsManager } from "@/lib/websocket";
import { formatLevel, formatTime } from "@/lib/utils";
import { WSMessage } from "@/types";

interface Message {
  id: string;
  from: "me" | "partner";
  text: string;
}

export default function VoiceChat() {
  const user = useStore((s) => s.user);
  const match = useStore((s) => s.currentMatch);
  const clearMatch = useStore((s) => s.clearMatch);

  const { status, micOn, startCall, endCall, toggleMic } = useWebRTC();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [time, setTime] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [callStarted, setCallStarted] = useState(false);

  // Start call once
  useEffect(() => {
    if (match && !callStarted) {
      setCallStarted(true);
      startCall();
    }
  }, [match, callStarted, startCall]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for messages
  useEffect(() => {
    const handler = (msg: WSMessage) => {
      if (msg.type === "chat" && msg.message) {
        setMessages((prev) => [
          ...prev,
          { id: String(Date.now()), from: "partner", text: msg.message! },
        ]);
      } else if (msg.type === "session_ended") {
        endCall();
        clearMatch();
      }
    };
    wsManager.addMessageHandler(handler);
    return () => wsManager.removeMessageHandler(handler);
  }, [endCall, clearMatch]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMessage = () => {
    const txt = input.trim();
    if (!txt || !match) return;

    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), from: "me", text: txt },
    ]);
    wsManager.sendChat(match.partner_id, txt);
    setInput("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }

    // Keep keyboard open
    requestAnimationFrame(() => {
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  };

  // End session
  const handleEnd = () => {
    if (match?.session_id) {
      wsManager.endSession(match.session_id);
    }
    endCall();
    clearMatch();
  };

  if (!match || !user) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900 flex flex-col"
      style={{ touchAction: "manipulation" }}
    >
      {/* Header */}
      <header className="shrink-0 bg-slate-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-bold">
            {match.partner_username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white text-sm font-medium">
              {match.partner_username}
            </p>
            <p className="text-xs text-slate-400">
              {formatLevel(match.partner_level)} •
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
            </p>
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
      </header>

      {/* Voice Status */}
      <div className="shrink-0 bg-slate-800/50 px-3 py-2 flex items-center justify-center gap-4">
        <span
          className={`text-xs ${
            status === "connected"
              ? "text-green-400"
              : status === "failed"
              ? "text-red-400"
              : "text-yellow-400"
          }`}
        >
          {status === "connected"
            ? "🔊 Ovoz ulandi"
            : status === "failed"
            ? "❌ Xatolik"
            : "⏳ Ulanmoqda..."}
        </span>
        <button
          onClick={toggleMic}
          className={`px-3 py-1 rounded-full text-xs text-white ${
            micOn ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {micOn ? "🎤 Yoniq" : "🔇 O'chiq"}
        </button>
      </div>

      {/* Messages - Telegram/WhatsApp style */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col">
        <div className="flex-1" /> {/* Spacer pushes messages to bottom */}
        <p className="text-center text-slate-500 text-xs py-2">
          Suhbat boshlandi
        </p>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex mb-2 ${
              msg.from === "me" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap ${
                msg.from === "me"
                  ? "bg-violet-600 text-white"
                  : "bg-slate-700 text-white"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input - Safari safe */}
      <div
        className="shrink-0 bg-slate-800 px-3 py-2"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 120) + "px";
            }}
            placeholder="Xabar yozing..."
            rows={1}
            className="flex-1 bg-slate-700 text-white px-4 py-2.5 rounded-2xl outline-none placeholder-slate-400 resize-none"
            style={{
              fontSize: "16px",
              WebkitAppearance: "none",
              minHeight: "44px",
              maxHeight: "120px",
              lineHeight: "1.4",
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
          />
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-violet-600 disabled:bg-slate-600 shrink-0 select-none"
            style={{ WebkitTapHighlightColor: "transparent" }}
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
      </div>
    </div>
  );
}
