import "./App.css";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import { useEffect } from "react";
import { useAuthStore } from "./store/authStore";
import { Register } from "./pages/Register/Register";
import { Login } from "./pages/Login/Login";
import { GuestRoute } from "./components/GuestRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Challenges from "./pages/Challenges/Challenges";
import Challenge from "./pages/Challenge/Challenge";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const checkAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <>
      <ToastContainer
        position="top-right"
        autoClose={1000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
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
        <Route
          path="/challenges/:id"
          element={
            <ProtectedRoute>
              <Challenge />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
