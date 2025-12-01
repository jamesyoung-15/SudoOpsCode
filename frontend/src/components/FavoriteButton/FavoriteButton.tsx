import { useState, useEffect } from "react";
import { apiClient } from "../../utils/apiClient";
import { toast } from "react-toastify";
import { FaStar, FaRegStar } from "react-icons/fa";
import "./FavoriteButton.css";

interface FavoriteButtonProps {
  challengeId: number;
}

export const FavoriteButton = ({ challengeId }: FavoriteButtonProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFavoriteStatus();
  }, [challengeId]);

  const checkFavoriteStatus = async () => {
    try {
      const { isFavorite } = await apiClient.checkFavorite(challengeId);
      setIsFavorite(isFavorite);
    } catch (error) {
      console.error("Failed to check favorite status:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      setLoading(true);

      if (isFavorite) {
        await apiClient.removeFavorite(challengeId);
        setIsFavorite(false);
        toast.success("Removed from favorites");
      } else {
        await apiClient.addFavorite(challengeId);
        setIsFavorite(true);
        toast.success("Added to favorites");
      }
    } catch (error) {
      toast.error("Failed to update favorites");
      console.error("Failed to toggle favorite:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`favorite-btn ${isFavorite ? "favorited" : ""}`}
      onClick={toggleFavorite}
      disabled={loading}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      {isFavorite ? <FaStar /> : <FaRegStar />}
      <span>{isFavorite ? "Favorited" : "Favorite"}</span>
    </button>
  );
};
