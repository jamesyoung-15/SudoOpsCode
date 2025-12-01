import "./Navbar.css";
import { Link } from "react-router-dom";
import { VscTerminalBash } from "react-icons/vsc";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoCloseOutline } from "react-icons/io5";
import { useState } from "react";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="navbar-container">
      <div className="navbar-left">
        <Link to="/" className="navbar-logo">
          <div>
            <VscTerminalBash size={24} className="terminal-icon" />
          </div>
          <span className="logo-text">SudoOpsCode</span>
        </Link>
        <nav className="navbar-links">
          <Link to="/challenges" className="navbar-link">
            Challenges
          </Link>
        </nav>
      </div>
      <div className="navbar-right">
        <nav className="navbar-auth">
          <Link to="/login" className="navbar-link">
            Login
          </Link>
          <Link to="/signup" className="navbar-link navbar-signup">
            Sign Up
          </Link>
        </nav>
      </div>
      <button
        className="hamburger-menu"
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        {isMenuOpen ? (
          <IoCloseOutline size={24} />
        ) : (
          <RxHamburgerMenu size={24} />
        )}
      </button>
      {isMenuOpen && (
        <div className="mobile-menu">
          <Link to="/" className="navbar-link" onClick={toggleMenu}>
            Home
          </Link>
          <Link to="/challenges" className="navbar-link" onClick={toggleMenu}>
            Challenges
          </Link>
          <Link to="/login" className="navbar-link" onClick={toggleMenu}>
            Login
          </Link>
          <Link
            to="/signup"
            className="navbar-link navbar-signup"
            onClick={toggleMenu}
          >
            Sign Up
          </Link>
        </div>
      )}
    </div>
  );
};

export default Navbar;
