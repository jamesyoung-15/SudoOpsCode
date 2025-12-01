import "./Favorite.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../utils/apiClient";
import Navbar from "../../components/Navbar/Navbar";
import { toast } from "react-toastify";
import { FaTrash } from "react-icons/fa";

interface FavoriteChallenge {
  id: number;
  title: string;
  difficulty: string;
  points: number;
  category: string;
  favorited_at: string;
  solved: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalFavorites: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export default function Favorites() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteChallenge[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchFavorites(currentPage);
  }, [currentPage]);

  const fetchFavorites = async (page: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFavorites(page, itemsPerPage);
      setFavorites(response.favorites);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load favorites");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (
    challengeId: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    try {
      setRemovingId(challengeId);
      await apiClient.removeFavorite(challengeId);
      toast.success("Removed from favorites");

      // Refresh the list
      fetchFavorites(currentPage);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      toast.error("Failed to remove favorite");
    } finally {
      setRemovingId(null);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getDifficultyClass = (difficulty: string) =>
    `difficulty-${difficulty.toLowerCase()}`;

  const parseCategories = (categoryString: string): string[] =>
    categoryString
      .split(",")
      .map((cat) => cat.trim())
      .filter(Boolean);

  const handleChallengeClick = (id: number) => {
    navigate(`/challenges/${id}`);
  };

  if (loading && favorites.length === 0) {
    return (
      <>
        <Navbar />
        <div className="favorites-container">
          <div className="favorites-header">
            <h1>My Favorites</h1>
          </div>
          <div className="loading">Loading favorites...</div>
        </div>
      </>
    );
  }

  if (error && favorites.length === 0) {
    return (
      <>
        <Navbar />
        <div className="favorites-container">
          <div className="favorites-header">
            <h1>My Favorites</h1>
          </div>
          <div className="error">{error}</div>
        </div>
      </>
    );
  }

  if (favorites.length === 0 && !loading) {
    return (
      <>
        <Navbar />
        <div className="favorites-container">
          <div className="favorites-header">
            <h1>My Favorites</h1>
          </div>
          <div className="empty-state">
            <p>No favorite challenges yet.</p>
            <button
              className="browse-btn"
              onClick={() => navigate("/challenges")}
            >
              Browse Challenges
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="favorites-container">
        <div className="favorites-header">
          <h1>My Favorites</h1>
          {pagination && (
            <div className="favorites-count">
              {pagination.totalFavorites} favorite
              {pagination.totalFavorites !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Mobile card view */}
        <div className="favorites-cards">
          {favorites.map((favorite) => (
            <div
              key={favorite.id}
              className="favorite-card"
              onClick={() => handleChallengeClick(favorite.id)}
            >
              <div className="card-row">
                <div className="card-title-section">
                  <h3 className="favorite-title">{favorite.title}</h3>
                  {!!favorite.solved && (
                    <span className="solved-badge">Solved</span>
                  )}
                </div>
                <button
                  className="remove-btn-mobile"
                  onClick={(e) => handleRemoveFavorite(favorite.id, e)}
                  disabled={removingId === favorite.id}
                  aria-label="Remove from favorites"
                >
                  <FaTrash />
                </button>
              </div>
              <div className="card-row">
                <span
                  className={`difficulty-badge ${getDifficultyClass(favorite.difficulty)}`}
                >
                  {favorite.difficulty}
                </span>
                <div className="category-tags">
                  {parseCategories(favorite.category).map((cat, index) => (
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
        <div className="favorites-table-container">
          <table className="favorites-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Difficulty</th>
                <th>Categories</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((favorite) => (
                <tr
                  key={favorite.id}
                  onClick={() => handleChallengeClick(favorite.id)}
                  className="favorite-row"
                >
                  <td className="title-cell">
                    <span className="favorite-title">{favorite.title}</span>
                  </td>
                  <td>
                    <span
                      className={`difficulty-badge ${getDifficultyClass(favorite.difficulty)}`}
                    >
                      {favorite.difficulty}
                    </span>
                  </td>
                  <td className="category-cell">
                    <div className="category-tags">
                      {parseCategories(favorite.category).map((cat, index) => (
                        <span key={index} className="category-tag">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="status-cell">
                    {favorite.solved ? (
                      <span className="solved-badge">✓ Solved</span>
                    ) : (
                      <span className="unsolved-badge">Unsolved</span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="remove-btn"
                      onClick={(e) => handleRemoveFavorite(favorite.id, e)}
                      disabled={removingId === favorite.id}
                      aria-label="Remove from favorites"
                    >
                      <FaTrash />
                    </button>
                  </td>
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
