interface Challenge {
  id: number;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  category: string;
  created_at: string;
  solve_count: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalChallenges: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ChallengesResponse {
  challenges: Challenge[];
  pagination: PaginationInfo;
}

export type { Challenge, PaginationInfo, ChallengesResponse };