"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { wsManager } from "@/lib/websocket";
import { WSMessage } from "@/types";

// ICE Servers - STUN for discovery, TURN for relay
const ICE_SERVERS: RTCIceServer[] = [
  // Google STUN
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },

  // Twilio STUN
  { urls: "stun:global.stun.twilio.com:3478" },

  // Free TURN servers
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

type ConnectionStatus = "idle" | "connecting" | "connected" | "failed";

export function useWebRTC() {
  const { currentMatch } = useStore();

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isNegotiating = useRef(false);

  const [connectionState, setConnectionState] =
    useState<ConnectionStatus>("idle");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  // Create audio element on mount
  useEffect(() => {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);
    remoteAudioRef.current = audio;

    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
        remoteAudioRef.current.remove();
        remoteAudioRef.current = null;
      }
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("[WebRTC] Cleanup");

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("[WebRTC] Stopped track:", track.kind);
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    iceCandidatesQueue.current = [];
    isNegotiating.current = false;
    setConnectionState("idle");
  }, []);

  // Get microphone access
  const getLocalStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    console.log("[WebRTC] Requesting microphone...");

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
      console.log("[WebRTC] Microphone granted");
      return stream;
    } catch (error) {
      console.error("[WebRTC] Microphone error:", error);
      alert("Mikrofon ruxsati berilmadi!");
      throw error;
    }
  }, []);

  // Process queued ICE candidates
  const processIceCandidates = useCallback(async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;

    console.log(
      "[WebRTC] Processing",
      iceCandidatesQueue.current.length,
      "queued candidates"
    );

    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log("[WebRTC] Added queued ICE candidate");
        } catch (e) {
          console.error("[WebRTC] Error adding queued candidate:", e);
        }
      }
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((): RTCPeerConnection => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log("[WebRTC] Creating peer connection");

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    peerConnectionRef.current = pc;

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && currentMatch) {
        const candidateType = event.candidate.type || "unknown";
        const protocol = event.candidate.protocol || "unknown";
        console.log(
          `[WebRTC] ICE candidate: type=${candidateType}, protocol=${protocol}`
        );

        wsManager.sendSignaling("ice_candidate", currentMatch.partner_id, {
          candidate: event.candidate.toJSON(),
        });
      } else if (!event.candidate) {
        console.log("[WebRTC] ICE gathering complete");
      }
    };

    // ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log("[WebRTC] ICE gathering state:", pc.iceGatheringState);
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE connection state:", pc.iceConnectionState);

      if (
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        setConnectionState("connected");
      } else if (pc.iceConnectionState === "failed") {
        console.log("[WebRTC] ICE failed, attempting restart...");
        // Try ICE restart
        pc.restartIce();
        setConnectionState("connecting");

        // If still failing after 5 seconds, notify user
        setTimeout(() => {
          if (pc.iceConnectionState === "failed") {
            console.log("[WebRTC] ICE restart failed");
            setConnectionState("failed");
          }
        }, 5000);
      } else if (pc.iceConnectionState === "disconnected") {
        console.log("[WebRTC] ICE disconnected, waiting for reconnection...");
        setConnectionState("connecting");

        // Give it 10 seconds to reconnect
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            console.log("[WebRTC] Still disconnected, restarting ICE...");
            pc.restartIce();
          }
        }, 10000);
      }
    };

    // Connection state
    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Connection state:", pc.connectionState);

      if (pc.connectionState === "connected") {
        setConnectionState("connected");
      } else if (pc.connectionState === "failed") {
        setConnectionState("failed");
      }
    };

    // Remote track handler
    pc.ontrack = (event) => {
      console.log("[WebRTC] Received remote track:", event.track.kind);

      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];

        // Try to play
        remoteAudioRef.current
          .play()
          .then(() => console.log("[WebRTC] Audio playing"))
          .catch((e) => console.log("[WebRTC] Audio play blocked:", e.message));
      }
    };

    return pc;
  }, [currentMatch]);

  // Start call (initiator creates offer)
  const startCall = useCallback(async () => {
    if (!currentMatch) {
      console.log("[WebRTC] No match, cannot start call");
      return;
    }

    console.log(
      "[WebRTC] Starting call, initiator:",
      currentMatch.is_initiator
    );
    setConnectionState("connecting");

    try {
      const stream = await getLocalStream();
      const pc = createPeerConnection();

      // Add local audio track
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
        console.log("[WebRTC] Added local audio track");
      }

      // Only initiator creates offer
      if (currentMatch.is_initiator) {
        isNegotiating.current = true;

        console.log("[WebRTC] Creating offer...");
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });

        await pc.setLocalDescription(offer);
        console.log("[WebRTC] Local description set (offer)");

        wsManager.sendSignaling("offer", currentMatch.partner_id, {
          type: offer.type,
          sdp: offer.sdp,
        });
        console.log("[WebRTC] Offer sent");

        isNegotiating.current = false;
      } else {
        console.log("[WebRTC] Waiting for offer from initiator...");
      }
    } catch (error) {
      console.error("[WebRTC] Start call error:", error);
      setConnectionState("failed");
    }
  }, [currentMatch, getLocalStream, createPeerConnection]);

  // Handle incoming offer
  const handleOffer = useCallback(
    async (offerData: RTCSessionDescriptionInit) => {
      if (!currentMatch) return;

      console.log("[WebRTC] Received offer");

      try {
        const stream = await getLocalStream();
        const pc = createPeerConnection();

        // Add track if not added
        if (pc.getSenders().length === 0) {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            pc.addTrack(audioTrack, stream);
            console.log("[WebRTC] Added local audio track (on offer)");
          }
        }

        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(offerData));
        console.log("[WebRTC] Remote description set (offer)");

        // Process any queued candidates
        await processIceCandidates();

        // Create and send answer
        console.log("[WebRTC] Creating answer...");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("[WebRTC] Local description set (answer)");

        wsManager.sendSignaling("answer", currentMatch.partner_id, {
          type: answer.type,
          sdp: answer.sdp,
        });
        console.log("[WebRTC] Answer sent");
      } catch (error) {
        console.error("[WebRTC] Handle offer error:", error);
        setConnectionState("failed");
      }
    },
    [currentMatch, getLocalStream, createPeerConnection, processIceCandidates]
  );

  // Handle incoming answer
  const handleAnswer = useCallback(
    async (answerData: RTCSessionDescriptionInit) => {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.log("[WebRTC] No peer connection for answer");
        return;
      }

      console.log("[WebRTC] Received answer");

      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answerData));
          console.log("[WebRTC] Remote description set (answer)");

          // Process any queued candidates
          await processIceCandidates();
        } else {
          console.log(
            "[WebRTC] Unexpected signaling state for answer:",
            pc.signalingState
          );
        }
      } catch (error) {
        console.error("[WebRTC] Handle answer error:", error);
      }
    },
    [processIceCandidates]
  );

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(
    async (candidateData: RTCIceCandidateInit) => {
      const pc = peerConnectionRef.current;

      if (!pc) {
        console.log("[WebRTC] Queuing ICE candidate (no PC yet)");
        iceCandidatesQueue.current.push(candidateData);
        return;
      }

      if (!pc.remoteDescription) {
        console.log("[WebRTC] Queuing ICE candidate (no remote desc)");
        iceCandidatesQueue.current.push(candidateData);
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateData));
        console.log("[WebRTC] Added ICE candidate");
      } catch (error) {
        console.error("[WebRTC] Add ICE candidate error:", error);
      }
    },
    []
  );

  // Listen for signaling messages
  useEffect(() => {
    const handleSignaling = (message: WSMessage) => {
      console.log("[WebRTC] Received signaling:", message.type);

      if (message.type === "offer" && message.data) {
        handleOffer(message.data);
      } else if (message.type === "answer" && message.data) {
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
    if (!stream) return;

    const track = stream.getAudioTracks()[0];
    if (!track) return;

    const newState = !track.enabled;
    track.enabled = newState;

    // Also update sender
    const pc = peerConnectionRef.current;
    if (pc) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender?.track) {
        sender.track.enabled = newState;
      }
    }

    setIsAudioEnabled(newState);
    console.log("[WebRTC] Microphone:", newState ? "ON" : "OFF");
  }, []);

  // End call
  const endCall = useCallback(() => {
    console.log("[WebRTC] Ending call");
    cleanup();
    setIsAudioEnabled(true);
  }, [cleanup]);

  // Cleanup on unmount
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
