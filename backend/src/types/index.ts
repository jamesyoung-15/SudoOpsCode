export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}
