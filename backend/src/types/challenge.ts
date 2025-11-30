export interface Challenge {
  id: number;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  category: string;
  solution: string | null;
  directory: string;
  created_at: string;
}

export interface ChallengeMetadata {
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  category: string;
  solution?: string;
}

export interface ChallengeWithProgress extends Omit<Challenge, "solution"> {
  solved: boolean;
  attempts: number;
}
