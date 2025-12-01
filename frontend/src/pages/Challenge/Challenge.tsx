import { apiClient } from "../../utils/apiClient";
import "./Challenge.css";
import Navbar from "../../components/Navbar/Navbar";
import type { ChallengeUserResponse } from "../../types/Challenge";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const Challenge = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeUserResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      navigate("/challenges");
      return;
    }

    fetchChallenge(parseInt(id));
  }, [id, navigate]);

  const fetchChallenge = async (challengeId: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getChallenge(challengeId);
      setChallenge(response.challenge);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load challenge";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyClass = (difficulty: string) => {
    return `difficulty-${difficulty.toLowerCase()}`;
  };

  const parseCategories = (categoryString: string): string[] => {
    return categoryString
      .split(",")
      .map((cat) => cat.trim())
      .filter((cat) => cat.length > 0);
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="challenge-container">
          <div className="loading">Loading challenge...</div>
        </div>
      </>
    );
  }

  if (error || !challenge) {
    return (
      <>
        <Navbar />
        <div className="challenge-container">
          <div className="error">{error || "Challenge not found"}</div>
          <button className="back-btn" onClick={() => navigate("/challenges")}>
            Back to Challenges
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="challenge-layout">
        {/* Problem Description Panel */}
        <div className="problem-panel">
          <div className="problem-header">
            <h1 className="problem-title">{`${id}. ${challenge.title}`}</h1>
            <div className="problem-meta">
              <span
                className={`difficulty-badge ${getDifficultyClass(challenge.difficulty)}`}
              >
                {challenge.difficulty}
              </span>
              {parseCategories(challenge.category).map((cat, index) => (
                <span key={index} className="category-tag">
                  {cat}
                </span>
              ))}
            </div>
          </div>

          <div className="problem-stats">
            <div className="stat-item">
              <span className="stat-label">Status:</span>
              <span
                className={`stat-value ${challenge.solved ? "solved" : "unsolved"}`}
              >
                {challenge.solved ? "✓ Solved" : "Unsolved"}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Attempts:</span>
              <span className="stat-value">{challenge.attempts}</span>
            </div>
          </div>

          <div className="problem-description">
            <h2>Description</h2>
            <div className="description-content">{challenge.description}</div>
          </div>

          {challenge.solved && challenge.solution && (
            <div className="problem-solution">
              <h2>Solution</h2>
              <div className="solution-content">
                <pre>{challenge.solution}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Solution/Terminal Panel */}
        <div className="solution-panel">
          <div className="solution-header">
            <h2>Terminal</h2>
          </div>
          <div className="terminal-placeholder">
            <div className="terminal-line">$ ssh ctf@challenge-server</div>
            <div className="terminal-line terminal-cursor">_</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Challenge;
