import { FaGithub } from "react-icons/fa";
import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        {/* <span>SudoOpsCode</span> */}
        <span>METCS602 Final Project</span>
        <a
          href="https://github.com/jamesyoung-15/SudoOpsCode"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Source Code</span>
          <FaGithub size={12} className="footer-icon" />
        </a>
      </div>
    </footer>
  );
};

export default Footer;
