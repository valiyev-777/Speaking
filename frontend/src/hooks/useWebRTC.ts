"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { wsManager } from "@/lib/websocket";
import { WSMessage } from "@/types";

const ICE_SERVERS = [
  // STUN servers
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  // Free TURN servers (Open Relay Project)
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
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

export function useWebRTC() {
  const { currentMatch } = useStore();

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>("new");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // Create and attach audio element
  useEffect(() => {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true"); // Important for mobile/iOS
    remoteAudioRef.current = audio;

    // Append to DOM (helps with some mobile browsers)
    audio.style.display = "none";
    document.body.appendChild(audio);

    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.remove();
      }
    };
  }, []);

  const cleanup = useCallback(() => {
    console.log("WebRTC: Cleanup");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    pendingCandidates.current = [];
    setConnectionState("new");
  }, []);

  const createPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log("WebRTC: Creating peer connection");
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && currentMatch) {
        console.log("WebRTC: Sending ICE candidate");
        wsManager.sendSignaling("ice_candidate", currentMatch.partner_id, {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("WebRTC: ICE state:", pc.iceConnectionState);

      // Restart ICE if failed
      if (pc.iceConnectionState === "failed") {
        console.log("WebRTC: ICE failed, attempting restart...");
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("WebRTC: Connection state:", pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    pc.ontrack = (event) => {
      console.log("WebRTC: Got remote track", event.track.kind);
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];

        // Try to play (needed for mobile)
        remoteAudioRef.current.play().catch((e) => {
          console.log("WebRTC: Auto-play blocked, user interaction needed");
        });
      }
    };

    return pc;
  }, [currentMatch]);

  const getLocalStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    console.log("WebRTC: Requesting microphone...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      console.log("WebRTC: Microphone access granted");
      return stream;
    } catch (error) {
      console.error("WebRTC: Microphone error:", error);
      alert(
        "Mikrofon ruxsati berilmadi. Iltimos sozlamalardan mikrofonga ruxsat bering."
      );
      throw error;
    }
  }, []);

  const addPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    if (pendingCandidates.current.length > 0 && pc.remoteDescription) {
      console.log(
        "WebRTC: Adding",
        pendingCandidates.current.length,
        "pending candidates"
      );
      for (const candidate of pendingCandidates.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("WebRTC: Error adding pending candidate:", e);
        }
      }
      pendingCandidates.current = [];
    }
  }, []);

  const startCall = useCallback(async () => {
    if (!currentMatch) return;

    console.log("WebRTC: Starting call, initiator:", currentMatch.is_initiator);

    try {
      const stream = await getLocalStream();
      const pc = createPeerConnection();

      // Add audio track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
        console.log("WebRTC: Audio track added");
      }

      if (currentMatch.is_initiator) {
        console.log("WebRTC: Creating offer...");
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);

        wsManager.sendSignaling("offer", currentMatch.partner_id, {
          type: offer.type,
          sdp: offer.sdp,
        });
        console.log("WebRTC: Offer sent");
      } else {
        console.log("WebRTC: Waiting for offer...");
      }
    } catch (error) {
      console.error("WebRTC: Start call error:", error);
    }
  }, [currentMatch, getLocalStream, createPeerConnection]);

  const handleOffer = useCallback(
    async (offerData: any) => {
      if (!currentMatch) return;

      console.log("WebRTC: Received offer");

      try {
        const stream = await getLocalStream();
        const pc = createPeerConnection();

        const senders = pc.getSenders();
        if (senders.length === 0) {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            pc.addTrack(audioTrack, stream);
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offerData));

        // Add any pending candidates
        await addPendingCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsManager.sendSignaling("answer", currentMatch.partner_id, {
          type: answer.type,
          sdp: answer.sdp,
        });
        console.log("WebRTC: Answer sent");
      } catch (error) {
        console.error("WebRTC: Handle offer error:", error);
      }
    },
    [currentMatch, getLocalStream, createPeerConnection, addPendingCandidates]
  );

  const handleAnswer = useCallback(
    async (answerData: any) => {
      console.log("WebRTC: Received answer");

      try {
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState !== "stable") {
          await pc.setRemoteDescription(new RTCSessionDescription(answerData));

          // Add any pending candidates
          await addPendingCandidates(pc);
        }
      } catch (error) {
        console.error("WebRTC: Handle answer error:", error);
      }
    },
    [addPendingCandidates]
  );

  const handleIceCandidate = useCallback(async (candidateData: any) => {
    try {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      } else {
        // Queue candidate if remote description not set yet
        console.log("WebRTC: Queuing ICE candidate");
        pendingCandidates.current.push(candidateData);
      }
    } catch (error) {
      console.error("WebRTC: ICE error:", error);
    }
  }, []);

  // Listen for signaling messages
  useEffect(() => {
    const handleSignaling = (message: WSMessage) => {
      if (message.type === "offer") {
        handleOffer(message.data);
      } else if (message.type === "answer") {
        handleAnswer(message.data);
      } else if (message.type === "ice_candidate" && message.data?.candidate) {
        handleIceCandidate(message.data.candidate);
      }
    };

    wsManager.addMessageHandler(handleSignaling);
    return () => wsManager.removeMessageHandler(handleSignaling);
  }, [handleOffer, handleAnswer, handleIceCandidate]);

  // Toggle microphone
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) {
      console.log("WebRTC: No stream to toggle");
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.log("WebRTC: No audio tracks");
      return;
    }

    const track = audioTracks[0];
    const newState = !track.enabled;
    track.enabled = newState;
    setIsAudioEnabled(newState);

    console.log("WebRTC: Microphone", newState ? "ENABLED" : "MUTED");

    // Also update the sender's track in peer connection
    const pc = peerConnectionRef.current;
    if (pc) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender && sender.track) {
        sender.track.enabled = newState;
      }
    }
  }, []);

  const endCall = useCallback(() => {
    console.log("WebRTC: Ending call");
    cleanup();
    setIsAudioEnabled(true);
  }, [cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    connectionState,
    isAudioEnabled,
    startCall,
    endCall,
    toggleAudio,
  };
}
