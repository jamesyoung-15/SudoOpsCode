/* User auth types */
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

/* Docker types */
export interface Container {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  userId: number;
  containerId: string;
  challengeId: number;
  createdAt: Date;
  lastActivity: Date;
}

export interface ContainerPoolConfig {
  poolSize: number;
  imageName: string;
  memoryLimit: string;
  cpuLimit: string;
  idleTimeoutMs: number;
  maxSessionTimeMs: number;
}
