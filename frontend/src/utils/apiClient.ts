export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3008";

interface RegisterCredentials {
  username: string;
  password: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  token: string;
  user: {
    userId: number;
    username: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthToken(): string | null {
    return sessionStorage.getItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = this.getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: "Request failed" }));
      
      // Only redirect to login on 401 if NOT on auth endpoints
      // (login/register failures should show error, not redirect)
      const isAuthEndpoint = endpoint.includes('/api/auth/login') || endpoint.includes('/api/auth/register');
      
      if (response.status === 401 && !isAuthEndpoint) {
        sessionStorage.removeItem("auth_token");
        sessionStorage.removeItem("auth_user");
        window.location.href = "/login";
      }

      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth methods
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  // Example protected endpoint
  async getChallenges(): Promise<unknown> {
    return this.request("/api/challenges");
  }
}

export const apiClient = new ApiClient(API_BASE_URL);