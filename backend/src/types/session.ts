export interface Session {
  id: string;
  userId: number;
  challengeId: number;
  containerId: string;
  status: "active" | "expired" | "ended";
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export interface StartSessionRequest {
  challengeId: number;
}

export interface StartSessionResponse {
  sessionId: string;
  containerId: string;
  message: string;
}

export interface ValidateRequest {
  sessionId: string;
}

export interface ValidateResponse {
  success: boolean;
  message: string;
  points?: number;
}
