import "./App.css";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { Register } from "./pages/Register/Register";
import { Login } from "./pages/Login/Login";
import { GuestRoute } from "./components/GuestRoute";
import Challenges from "./pages/Challenges/Challenges";

function App() {
  const checkAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <Register />
            </GuestRoute>
          }
        />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route path="/challenges" element={<Challenges />} />
      </Routes>
    </>
  );
}

export default App;
