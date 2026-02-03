"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { wsManager } from "@/lib/websocket";
import { WSMessage } from "@/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function useWebRTC() {
  const currentMatch = useStore((state) => state.currentMatch);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "failed"
  >("idle");
  const [micOn, setMicOn] = useState(true);

  // Audio element
  useEffect(() => {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audioRef.current = audio;
    return () => {
      audio.srcObject = null;
    };
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  // Get mic
  const getMic = useCallback(async () => {
    if (streamRef.current) return streamRef.current;

    console.log("[WebRTC] Requesting mic...");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    streamRef.current = stream;
    console.log("[WebRTC] Mic OK");
    return stream;
  }, []);

  // Create PC
  const createPC = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate && currentMatch) {
        wsManager.sendSignaling("ice_candidate", currentMatch.partner_id, {
          candidate: e.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE:", pc.iceConnectionState);
      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setStatus("connected");
      } else if (pc.iceConnectionState === "failed") {
        setStatus("failed");
      }
    };

    pc.ontrack = (e) => {
      console.log("[WebRTC] Got track");
      if (audioRef.current && e.streams[0]) {
        audioRef.current.srcObject = e.streams[0];
        audioRef.current.play().catch(() => {});
      }
    };

    return pc;
  }, [currentMatch]);

  // Start call
  const startCall = useCallback(async () => {
    if (!currentMatch) return;

    console.log("[WebRTC] Starting, initiator:", currentMatch.is_initiator);
    setStatus("connecting");

    try {
      const stream = await getMic();
      const pc = createPC();

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      if (currentMatch.is_initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsManager.sendSignaling("offer", currentMatch.partner_id, {
          type: offer.type,
          sdp: offer.sdp,
        });
        console.log("[WebRTC] Offer sent");
      }
    } catch (err) {
      console.error("[WebRTC] Error:", err);
      setStatus("failed");
    }
  }, [currentMatch, getMic, createPC]);

  // Handle offer
  const handleOffer = useCallback(
    async (data: RTCSessionDescriptionInit) => {
      if (!currentMatch) return;
      console.log("[WebRTC] Got offer");

      try {
        const stream = await getMic();
        const pc = createPC();

        if (pc.getSenders().length === 0) {
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        }

        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsManager.sendSignaling("answer", currentMatch.partner_id, {
          type: answer.type,
          sdp: answer.sdp,
        });
        console.log("[WebRTC] Answer sent");
      } catch (err) {
        console.error("[WebRTC] Offer error:", err);
      }
    },
    [currentMatch, getMic, createPC]
  );

  // Handle answer
  const handleAnswer = useCallback(async (data: RTCSessionDescriptionInit) => {
    console.log("[WebRTC] Got answer");
    const pc = pcRef.current;
    if (pc && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    }
  }, []);

  // Handle ICE
  const handleIce = useCallback(async (data: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(data));
    }
  }, []);

  // Listen signaling
  useEffect(() => {
    const handler = (msg: WSMessage) => {
      if (msg.type === "offer" && msg.data) {
        handleOffer(msg.data);
      } else if (msg.type === "answer" && msg.data) {
        handleAnswer(msg.data);
      } else if (msg.type === "ice_candidate" && msg.data?.candidate) {
        handleIce(msg.data.candidate);
      }
    };
    wsManager.addMessageHandler(handler);
    return () => wsManager.removeMessageHandler(handler);
  }, [handleOffer, handleAnswer, handleIce]);

  // Toggle mic
  const toggleMic = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  // End call
  const endCall = useCallback(() => {
    cleanup();
    setMicOn(true);
  }, [cleanup]);

  return { status, micOn, startCall, endCall, toggleMic };
}
