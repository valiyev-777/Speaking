"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useWebRTC } from "@/hooks/useWebRTC";
import { wsManager } from "@/lib/websocket";
import { formatLevel, formatTime } from "@/lib/utils";
import { WSMessage } from "@/types";

interface Msg {
  id: string;
  from: "me" | "partner";
  text: string;
}

export default function VoiceChat() {
  const user = useStore((s) => s.user);
  const match = useStore((s) => s.currentMatch);
  const clearMatch = useStore((s) => s.clearMatch);

  const { status, micOn, startCall, endCall, toggleMic } = useWebRTC();

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [time, setTime] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [started, setStarted] = useState(false);

  // Start call
  useEffect(() => {
    if (match && !started) {
      setStarted(true);
      startCall();
    }
  }, [match, started, startCall]);

  // Timer
  useEffect(() => {
    const i = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Listen messages
  useEffect(() => {
    const fn = (m: WSMessage) => {
      if (m.type === "chat" && m.message) {
        setMsgs((p) => [
          ...p,
          { id: `${Date.now()}`, from: "partner", text: m.message! },
        ]);
      } else if (m.type === "session_ended") {
        endCall();
        clearMatch();
      }
    };
    wsManager.addMessageHandler(fn);
    return () => wsManager.removeMessageHandler(fn);
  }, [endCall, clearMatch]);

  // Scroll to bottom
  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [msgs]);

  const send = () => {
    const t = text.trim();
    if (!t || !match) return;
    setMsgs((p) => [...p, { id: `${Date.now()}`, from: "me", text: t }]);
    wsManager.sendChat(match.partner_id, t);
    setText("");
    // Keep focus on input
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const end = () => {
    if (match?.session_id) wsManager.endSession(match.session_id);
    endCall();
    clearMatch();
  };

  if (!match || !user) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#1e293b",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #334155",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: "#7c3aed",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            {match.partner_username[0].toUpperCase()}
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>
              {match.partner_username}
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12 }}>
              {formatLevel(match.partner_level)} •
              <span
                style={{
                  color:
                    status === "connected"
                      ? "#4ade80"
                      : status === "failed"
                      ? "#f87171"
                      : "#fbbf24",
                }}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{ color: "#fff", fontSize: 14, fontFamily: "monospace" }}
          >
            {formatTime(time)}
          </span>
          <button
            onClick={end}
            style={{
              background: "#dc2626",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Tugatish
          </button>
        </div>
      </div>

      {/* Voice bar */}
      <div
        style={{
          background: "#1e293b80",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          borderBottom: "1px solid #334155",
        }}
      >
        <span
          style={{
            color:
              status === "connected"
                ? "#4ade80"
                : status === "failed"
                ? "#f87171"
                : "#fbbf24",
            fontSize: 12,
          }}
        >
          {status === "connected"
            ? "🔊 Ovoz ulandi"
            : status === "failed"
            ? "❌ Ulanmadi"
            : "⏳ Ulanmoqda..."}
        </span>
        <button
          onClick={toggleMic}
          style={{
            background: micOn ? "#16a34a" : "#dc2626",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: 20,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          {micOn ? "🎤 Yoniq" : "🔇 O'chiq"}
        </button>
      </div>

      {/* Chat */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        <div
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          Suhbat boshlandi
        </div>
        {msgs.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.from === "me" ? "flex-end" : "flex-start",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "8px 12px",
                borderRadius: 16,
                background: m.from === "me" ? "#7c3aed" : "#334155",
                color: "#fff",
                fontSize: 14,
                wordBreak: "break-word",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          background: "#1e293b",
          padding: 8,
          borderTop: "1px solid #334155",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Xabar yozing..."
            style={{
              flex: 1,
              background: "#334155",
              color: "#fff",
              border: "none",
              padding: "10px 16px",
              borderRadius: 20,
              fontSize: 16,
              outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            style={{
              width: 44,
              height: 44,
              background: text.trim() ? "#7c3aed" : "#475569",
              border: "none",
              borderRadius: "50%",
              cursor: text.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#fff"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
