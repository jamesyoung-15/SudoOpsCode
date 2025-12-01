import "./Challenges.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../utils/apiClient";
import "./Challenges.css";
import Navbar from "../../components/Navbar/Navbar";
import type { Challenge, PaginationInfo } from "../../types/Challenge";

export default function Challenges() {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchChallenges(currentPage);
  }, [currentPage]);

  const fetchChallenges = async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getPublicChallenges(page, itemsPerPage);
      setChallenges(response.challenges);
      setPagination(response.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load challenges",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const handleChallengeClick = (id: number) => {
    navigate(`/challenges/${id}`);
  };

  if (loading && challenges.length === 0) {
    return (
      <>
        <Navbar />
        <div className="challenges-container">
          <div className="challenges-header">
            <h1>Challenges</h1>
          </div>
          <div className="loading">Loading challenges...</div>
        </div>
      </>
    );
  }

  if (error && challenges.length === 0) {
    return (
      <>
        <Navbar />
        <div className="challenges-container">
          <div className="challenges-header">
            <h1>Challenges</h1>
          </div>
          <div className="error">{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="challenges-container">
        <div className="challenges-header">
          <h1>Challenges</h1>
          {pagination && (
            <div className="challenges-count">
              {pagination.totalChallenges} challenges
            </div>
          )}
        </div>

        {/* Mobile card view */}
        <div className="challenges-cards">
          {challenges.map((challenge, idx) => (
            <div
              key={challenge.id}
              className="challenge-card"
              onClick={() => handleChallengeClick(challenge.id)}
            >
              <div className="card-row">
                <div className="card-title-section">
                  <h3 className="challenge-title">{`${idx + 1}. ${challenge.title}`}</h3>
                </div>
                <span
                  className={`difficulty-badge ${getDifficultyClass(challenge.difficulty)}`}
                >
                  {challenge.difficulty}
                </span>
              </div>
              <div className="card-row">
                <div className="category-tags">
                  {parseCategories(challenge.category).map((cat, index) => (
                    <span key={index} className="category-tag">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="challenges-table-container">
          <table className="challenges-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Categories</th>
                <th>Solves</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((challenge, idx) => (
                <tr
                  key={challenge.id}
                  onClick={() => handleChallengeClick(challenge.id)}
                  className="challenge-row"
                >
                  <td className="title-cell">
                    <span className="challenge-title">{`${idx + 1}. ${challenge.title}`}</span>
                  </td>
                  <td>
                    <span
                      className={`difficulty-badge ${getDifficultyClass(challenge.difficulty)}`}
                    >
                      {challenge.difficulty}
                    </span>
                  </td>
                  <td className="category-cell">
                    <div className="category-tags">
                      {parseCategories(challenge.category).map((cat, index) => (
                        <span key={index} className="category-tag">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="solves-cell">{challenge.solve_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPreviousPage || loading}
            >
              Previous
            </button>

            <div className="pagination-pages">
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  let pageNum: number;

                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      className={`pagination-page ${currentPage === pageNum ? "active" : ""}`}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={loading}
                    >
                      {pageNum}
                    </button>
                  );
                },
              )}
            </div>

            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNextPage || loading}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
