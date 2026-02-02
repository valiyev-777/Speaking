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
}

export const api = new ApiClient();
