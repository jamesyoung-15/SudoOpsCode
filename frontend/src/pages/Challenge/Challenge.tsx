import { apiClient } from "../../utils/apiClient";
import "./Challenge.css";
import Navbar from "../../components/Navbar/Navbar";
import Terminal from "../../components/Terminal/Terminal";
import { Modal } from "../../components/Modal/Modal";
import type { ChallengeUserResponse } from "../../types/Challenge";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FavoriteButton } from "../../components/FavoriteButton/FavoriteButton";

const Challenge = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ChallengeUserResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solutionModal, setSolutionModal] = useState(false);
  const [solution, setSolution] = useState<string>("");
  const [loadingSolution, setLoadingSolution] = useState(false);

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

  const handleChallengeSolved = () => {
    if (id) fetchChallenge(parseInt(id));
  };

  const handleGetSolution = async () => {
    if (!challenge) return;

    try {
      setLoadingSolution(true);
      const response = await apiClient.getSolution(challenge.id);
      setSolution(response.solution);
      setSolutionModal(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load solution";
      toast.error(errorMessage);
    } finally {
      setLoadingSolution(false);
    }
  };

  const getDifficultyClass = (difficulty: string) =>
    `difficulty-${difficulty.toLowerCase()}`;

  const parseCategories = (categoryString: string): string[] =>
    categoryString
      .split(",")
      .map((cat) => cat.trim())
      .filter(Boolean);

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
                {challenge.solved ? "Solved" : "Unsolved"}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Attempts:</span>
              <span className="stat-value">{challenge.attempts}</span>
            </div>
          </div>

          <div className="problem-description">
            <h2>Description</h2>
            <Markdown remarkPlugins={[remarkGfm]}>
              {challenge.description}
            </Markdown>
          </div>

          <FavoriteButton challengeId={challenge.id} />

          <div className="problem-actions">
            <button
              className="solution-btn"
              onClick={handleGetSolution}
              disabled={loadingSolution}
            >
              {loadingSolution ? "Loading..." : "View Solution"}
            </button>
          </div>
        </div>

        <Terminal challengeId={challenge.id} onSolved={handleChallengeSolved} />
      </div>

      <Modal
        isOpen={solutionModal}
        onClose={() => setSolutionModal(false)}
        title="Solution"
      >
        <Markdown remarkPlugins={[remarkGfm]}>{solution}</Markdown>
      </Modal>
    </>
  );
};

export default Challenge;
