import {
  AuthResponse,
  LoginData,
  RegisterData,
  User,
  QueueStatus,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "An error occurred" }));
      throw new Error(error.detail || "Request failed");
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: RegisterData): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const formData = new URLSearchParams();
    formData.append("username", data.email);
    formData.append("password", data.password);

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Login failed" }));
      throw new Error(error.detail || "Login failed");
    }

    return response.json();
  }

  async getMe(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  // User endpoints
  async getUsers(onlineOnly: boolean = false): Promise<User[]> {
    const query = onlineOnly ? "?online_only=true" : "";
    return this.request<User[]>(`/users${query}`);
  }

  async getUser(id: string): Promise<User> {
    return this.request<User>(`/users/${id}`);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Queue endpoints
  async joinRouletteQueue(): Promise<QueueStatus> {
    return this.request<QueueStatus>("/queue/roulette", {
      method: "POST",
    });
  }

  async joinLevelFilterQueue(levelFilter?: number): Promise<QueueStatus> {
    return this.request<QueueStatus>("/queue/level-filter", {
      method: "POST",
      body: JSON.stringify({ level_filter: levelFilter }),
    });
  }

  async leaveQueue(): Promise<void> {
    await this.request("/queue/leave", {
      method: "POST",
    });
  }

  async getQueueStatus(): Promise<QueueStatus> {
    return this.request<QueueStatus>("/queue/status");
  }

  // Partner endpoints
  async searchUsers(query: string): Promise<UserSearchResult[]> {
    return this.request<UserSearchResult[]>(`/partners/search?q=${encodeURIComponent(query)}`);
  }

  async sendPartnerRequest(toUserId: string): Promise<PartnerRequest> {
    return this.request<PartnerRequest>("/partners/request", {
      method: "POST",
      body: JSON.stringify({ to_user_id: toUserId }),
    });
  }

  async getIncomingRequests(): Promise<PartnerRequest[]> {
    return this.request<PartnerRequest[]>("/partners/requests/incoming");
  }

  async acceptRequest(requestId: string): Promise<void> {
    await this.request(`/partners/requests/${requestId}/accept`, {
      method: "POST",
    });
  }

  async rejectRequest(requestId: string): Promise<void> {
    await this.request(`/partners/requests/${requestId}/reject`, {
      method: "POST",
    });
  }

  async getPartners(): Promise<Partner[]> {
    return this.request<Partner[]>("/partners/");
  }

  async removePartner(partnerUserId: string): Promise<void> {
    await this.request(`/partners/${partnerUserId}`, {
      method: "DELETE",
    });
  }
}

// Partner types
export interface UserSearchResult {
  id: string;
  username: string;
  current_level: number;
  is_online: boolean;
  is_partner: boolean;
  has_pending_request: boolean;
}

export interface PartnerRequest {
  id: string;
  from_user_id: string;
  from_username: string;
  from_level: number;
  to_user_id: string;
  to_username: string;
  to_level: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Partner {
  id: string;
  user_id: string;
  username: string;
  current_level: number;
  target_score: number;
  is_online: boolean;
  last_seen: string;
  partnership_date: string;
}

export const api = new ApiClient();
