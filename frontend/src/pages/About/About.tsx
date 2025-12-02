import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import "./About.css";
import { FaGithub } from "react-icons/fa";

export const About = () => {
  return (
    <>
      <Navbar />
      <div className="about-page">
        <section id="about-hero" className="about-section">
          <div className="container">
            <h1 id="about-title" className="page-title">
              About SudoOps
            </h1>
            <p id="about-subtitle" className="page-subtitle">
              Leetcode for system administrators. A terminal-based challenge
              platform for solving Linux problems. Created for METCS602 course
              project.
            </p>
          </div>
        </section>

        <section id="mission-section" className="about-section">
          <div className="container">
            <h2 id="mission-title" className="section-title">
              Project Overview
            </h2>
            <p id="mission-text" className="section-text">
              SudoOps is a web application that provides hands-on Linux terminal
              challenges within isolated Docker containers. Users can practice
              system administration tasks, test their solutions, and track their
              progress through various difficulty levels.
            </p>
          </div>
        </section>

        <section id="features-section" className="about-section">
          <div className="container">
            <h2 id="features-title" className="section-title">
              Key Features
            </h2>
            <div id="features-grid" className="features-grid">
              <div id="feature-1" className="feature-item">
                <h3 className="feature-title">Interactive Terminal</h3>
                <p className="feature-description">
                  Practice real Linux commands inside isolated Docker containers
                </p>
              </div>
              <div id="feature-2" className="feature-item">
                <h3 className="feature-title">Progress Tracking</h3>
                <p className="feature-description">
                  Monitor completed challenges and save favorites for later
                </p>
              </div>
              <div id="feature-3" className="feature-item">
                <h3 className="feature-title">Automated Validation</h3>
                <p className="feature-description">
                  Immediate feedback on whether your solution meets the
                  requirements
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="tech-stack-section" className="about-section">
          <div className="container">
            <h2 id="tech-stack-title" className="section-title">
              Technology Stack
            </h2>
            <div id="tech-stack-grid" className="tech-stack-grid">
              <div id="tech-1" className="tech-card">
                <h3 className="tech-category">Frontend</h3>
                <ul className="tech-list">
                  <li className="tech-item">React + Vite + TypeScript</li>
                  <li className="tech-item">Xterm.js</li>
                  <li className="tech-item">Zustand</li>
                </ul>
              </div>
              <div id="tech-2" className="tech-card">
                <h3 className="tech-category">Backend</h3>
                <ul className="tech-list">
                  <li className="tech-item">Node.js + Express</li>
                  <li className="tech-item">SQLite</li>
                  <li className="tech-item">JWT Authentication</li>
                </ul>
              </div>
              <div id="tech-3" className="tech-card">
                <h3 className="tech-category">Infrastructure</h3>
                <ul className="tech-list">
                  <li className="tech-item">Docker</li>
                  <li className="tech-item">WebSocket (Terminal I/O)</li>
                  <li className="tech-item">Bash Scripting</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="team-section" className="about-section">
          <div className="container">
            <h2 id="team-title" className="section-title">
              Created By
            </h2>
            <div id="team-grid" className="team-grid">
              <div id="team-member-1" className="team-member">
                <div className="member-avatar">JY</div>
                <h3 className="member-name">James Young</h3>
                <div className="member-link">
                  <a
                    href="https://github.com/jamesyoung-15"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaGithub />
                    <span>Github</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="cta-section" className="about-section">
          <div className="container">
            <div id="cta-box" className="cta-box">
              <h2 id="cta-title" className="cta-title">
                Start Practicing
              </h2>
              <p id="cta-text" className="cta-text">
                Create an account to access terminal challenges and track your
                progress
              </p>
              <a href="/register" id="cta-button" className="cta-button">
                Create Account
              </a>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
};
