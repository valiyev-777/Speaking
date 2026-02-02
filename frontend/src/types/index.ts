// User types
export interface User {
  id: string;
  email: string;
  username: string;
  current_level: number;
  target_score: number;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  username: string;
  current_level?: number;
  target_score?: number;
}

export interface LoginData {
  email: string;
  password: string;
}

// Queue types
export interface QueueStatus {
  in_queue: boolean;
  mode?: 'roulette' | 'level_filter';
  position?: number;
  joined_at?: string;
  estimated_wait_seconds?: number;
}

export interface MatchData {
  partner_id: string;
  partner_username: string;
  partner_level: number;
  room_id: string;
  session_id: string;
  is_initiator: boolean;
}

// WebSocket message types
export type WSMessageType = 
  | 'join_queue'
  | 'leave_queue'
  | 'queue_joined'
  | 'queue_left'
  | 'matched'
  | 'offer'
  | 'answer'
  | 'ice_candidate'
  | 'session_ended'
  | 'chat'
  | 'error'
  | 'ping'
  | 'pong';

export interface WSMessage {
  type: WSMessageType;
  data?: any;
  from_user_id?: string;
  message?: string;
}

// Session types
export interface Session {
  id: string;
  user1_id: string;
  user2_id: string;
  mode: 'roulette' | 'level_filter';
  room_id: string;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  ended_at?: string;
}
