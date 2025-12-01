import './Home.css';
import Navbar from "../../components/Navbar/Navbar";
import { Link } from 'react-router-dom';
import { VscTerminalBash } from "react-icons/vsc";
import { FaServer, FaDocker } from "react-icons/fa";
import Footer from '../../components/Footer/Footer';

const Home = () => {
    return (
        <>
            <Navbar />
            <div className="homepage container">
                <div className="homepage-intro">
                    <h1 className="hero-title">Master Linux & SysAdmin Skills</h1>
                    <p className="hero-subtitle">Practice real-world system administration challenges in an interactive terminal environment.</p>
                    <div className="cta-buttons">
                        <Link to="/signup" className="btn btn-primary">Sign Up for Free</Link>
                        <Link to="/challenges" className="btn btn-secondary">Explore Challenges</Link>
                    </div>
                </div>

                <div className="features-section">
                    <div className="feature-card">
                        <VscTerminalBash size={48} className="feature-icon" />
                        <h3>Interactive Terminal</h3>
                        <p>Practice commands in a real Linux environment</p>
                    </div>
                    <div className="feature-card">
                        <FaServer size={48} className="feature-icon" />
                        <h3>Real-World Scenarios</h3>
                        <p>Solve practical sysadmin problems you'll face</p>
                    </div>
                    <div className="feature-card">
                        <FaDocker size={48} className="feature-icon" />
                        <h3>Modern Tools</h3>
                        <p>Learn Docker, scripting and other commands useful for sysadmins</p>
                    </div>
                </div>

                <div className="stats-section">
                    <div className="stat">
                        <h2>10+</h2>
                        <p>Challenges</p>
                    </div>
                    <div className="stat">
                        <h2>2+</h2>
                        <p>Topics</p>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default Home;