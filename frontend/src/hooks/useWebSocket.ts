'use client';

import { useEffect, useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import { wsManager } from '@/lib/websocket';
import { WSMessage, MatchData } from '@/types';

export function useWebSocket() {
  const { user, token, setQueueStatus, setCurrentMatch, setIsInSession, clearMatch } = useStore();
  const [isConnected, setIsConnected] = useState(wsManager.isConnected);

  // Handle state-changing messages (queue, match)
  useEffect(() => {
    const handleMessage = (message: WSMessage) => {
      // Only handle specific messages that affect global state
      switch (message.type) {
        case 'connection_status':
          setIsConnected(message.data?.connected || false);
          break;

        case 'queue_joined':
          setQueueStatus({
            in_queue: true,
            mode: message.data?.mode,
            estimated_wait_seconds: 20,
          });
          break;

        case 'queue_left':
          setQueueStatus(null);
          break;

        case 'matched':
          console.log('useWebSocket: Matched!', message.data);
          const matchData: MatchData = message.data;
          setCurrentMatch(matchData);
          setQueueStatus(null);
          setIsInSession(true);
          break;

        case 'session_ended':
          // Let VoiceChat handle this too, but also clear state here
          clearMatch();
          break;
      }
    };

    wsManager.addMessageHandler(handleMessage);
    return () => {
      wsManager.removeMessageHandler(handleMessage);
    };
  }, [setQueueStatus, setCurrentMatch, setIsInSession, clearMatch]);

  // Connect when user is authenticated
  useEffect(() => {
    if (user && token) {
      wsManager.connect(user.id, token);
      setIsConnected(wsManager.isConnected);
    }
    return () => {
      // Don't disconnect on unmount - let it persist
    };
  }, [user, token]);

  // Disconnect on logout
  useEffect(() => {
    if (!user || !token) {
      wsManager.disconnect();
      setIsConnected(false);
    }
  }, [user, token]);

  const joinQueue = useCallback((mode: 'roulette' | 'level_filter', levelFilter?: number) => {
    wsManager.joinQueue(mode, levelFilter);
  }, []);

  const leaveQueue = useCallback(() => {
    wsManager.leaveQueue();
  }, []);

  return {
    isConnected,
    joinQueue,
    leaveQueue,
  };
}
