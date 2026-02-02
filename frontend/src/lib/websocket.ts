'use client';

import { WSMessage, MatchData } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

type MessageHandler = (message: WSMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private _isConnected: boolean = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(userId: string, token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    this.userId = userId;
    this.token = token;

    console.log('WebSocketManager: Connecting...');
    this.ws = new WebSocket(`${WS_URL}/ws/match/${userId}?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocketManager: Connected');
      this._isConnected = true;
      this.notifyHandlers({ type: 'connection_status', data: { connected: true } } as any);

      // Ping every 30 seconds
      this.pingInterval = setInterval(() => {
        this.send({ type: 'ping' });
      }, 30000);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        console.log('WebSocketManager: Received:', message);
        this.notifyHandlers(message);
      } catch (e) {
        console.error('WebSocketManager: Parse error:', e);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocketManager: Disconnected', event.code, event.reason);
      this._isConnected = false;
      this.notifyHandlers({ type: 'connection_status', data: { connected: false } } as any);

      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }

      // Reconnect after 3 seconds
      if (this.userId && this.token) {
        this.reconnectTimeout = setTimeout(() => {
          this.connect(this.userId!, this.token!);
        }, 3000);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocketManager: Error:', error);
    };
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
    this.userId = null;
    this.token = null;
  }

  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocketManager: Sending:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocketManager: Cannot send, not connected');
    }
  }

  addMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.add(handler);
  }

  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers.delete(handler);
  }

  private notifyHandlers(message: WSMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (e) {
        console.error('WebSocketManager: Handler error:', e);
      }
    });
  }

  // Convenience methods
  joinQueue(mode: 'roulette' | 'level_filter', levelFilter?: number): void {
    this.send({
      type: 'join_queue',
      data: { mode, level_filter: levelFilter },
    });
  }

  leaveQueue(): void {
    this.send({ type: 'leave_queue' });
  }

  endSession(sessionId: string): void {
    this.send({
      type: 'end_session',
      data: { session_id: sessionId },
    });
  }

  sendSignaling(type: 'offer' | 'answer' | 'ice_candidate', targetUserId: string, signalData: any): void {
    this.send({
      type,
      data: {
        target_user_id: targetUserId,
        data: signalData,
      },
    });
  }

  sendChat(targetUserId: string, message: string): void {
    this.send({
      type: 'chat',
      data: {
        target_user_id: targetUserId,
        message,
      },
    });
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
