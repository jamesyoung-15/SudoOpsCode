import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { apiClient, WS_BASE_URL } from "../../utils/apiClient";
import { toast } from "react-toastify";
import "xterm/css/xterm.css";
import "./Terminal.css";

interface TerminalProps {
  challengeId: number;
  onSolved: () => void;
}

// Define session states
type SessionState =
  | "idle"
  | "starting"
  | "connecting"
  | "connected"
  | "validating"
  | "ending"
  | "solved"
  | "error";

const Terminal = ({ challengeId, onSolved }: TerminalProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataListenerRef = useRef<{ dispose: () => void } | null>(null);
  const isSolvingRef = useRef<boolean>(false);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [solveMessage, setSolveMessage] = useState<string>("");
  const [solvePoints, setSolvePoints] = useState<number>(0);

  // Initialize terminal only when starting a session
  const initializeTerminal = () => {
    if (!terminalRef.current || xtermRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Courier New', monospace",
      theme: {
        background: "#000000",
        foreground: "#00ff00",
        cursor: "#00ff00",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (error) {
        console.error("Error fitting terminal:", error);
      }
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      try {
        if (fitAddonRef.current) {
          fitAddon.fit();
        }
      } catch (error) {
        console.error("Error resizing terminal:", error);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  };

  useEffect(() => {
    return () => {
      cleanup();
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, []);

  const cleanup = () => {
    if (dataListenerRef.current) {
      dataListenerRef.current.dispose();
      dataListenerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const handleStartChallenge = async () => {
    try {
      setSessionState("starting");
      initializeTerminal();

      const response = await apiClient.startSession(challengeId);
      setSessionId(response.sessionId);

      await connectTerminal(response.sessionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start session";
      toast.error(message);
      setSessionState("error");
      console.error("Failed to start challenge:", error);
    }
  };

  const connectTerminal = async (sessionId: string) => {
    if (!xtermRef.current) return;

    try {
      setSessionState("connecting");

      const token = sessionStorage.getItem("auth_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const wsUrl = `${WS_BASE_URL}/terminal?token=${token}&sessionId=${sessionId}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      wsRef.current = ws;

      ws.onopen = () => {
        setSessionState("connected");
        toast.success("Terminal connected!");

        setTimeout(() => {
          if (fitAddonRef.current) {
            try {
              fitAddonRef.current.fit();
            } catch (error) {
              console.error("Error fitting terminal on connect:", error);
            }
          }
        }, 100);

        if (xtermRef.current) {
          dataListenerRef.current = xtermRef.current.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          });
        }
      };

      ws.onmessage = (event) => {
        if (!xtermRef.current) return;

        let data;
        if (event.data instanceof ArrayBuffer) {
          data = new Uint8Array(event.data);
        } else {
          data = event.data;
        }

        xtermRef.current.write(data);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast.error("Terminal connection error");
        setSessionState("error");
      };

      ws.onclose = () => {
        if (isSolvingRef.current) {
          console.log("WebSocket closed during solve process - ignoring");
          return;
        }

        toast.info("Terminal disconnected");
        setSessionState("idle");
        cleanup();
      };
    } catch (error) {
      console.error("Failed to connect terminal:", error);
      toast.error("Failed to connect to terminal");
      setSessionState("error");
    }
  };

  const handleValidate = async () => {
    if (!sessionId) return;

    try {
      setSessionState("validating");
      isSolvingRef.current = true;

      const response = await apiClient.validateSession(sessionId);

      if (response.success) {
        setSolveMessage(response.message);
        setSolvePoints(response.points || 0);
        setSessionState("solved");

        // Show success toast
        toast.success(
          `${response.message}${response.points ? ` +${response.points} points!` : ""}`,
          {
            autoClose: 5000,
          },
        );

        cleanup();

        // Don't call onSolved() immediately - let user see success screen
      } else {
        isSolvingRef.current = false;
        toast.error(response.message);
        setSessionState("connected");
      }
    } catch (error) {
      isSolvingRef.current = false;
      const message =
        error instanceof Error ? error.message : "Validation failed";
      toast.error(message);
      setSessionState("connected");
      console.error("Validation error:", error);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;

    try {
      setSessionState("ending");

      await apiClient.endSession(sessionId);
      toast.info("Session ended");

      if (xtermRef.current) {
        xtermRef.current.clear();
      }

      cleanup();
      setSessionState("idle");
      setSessionId(null);
    } catch (error) {
      console.error("Failed to end session:", error);
      toast.error("Failed to end session");
      setSessionState("connected");
    }
  };

  const handleBackToChallenges = () => {
    // Call onSolved to refresh challenge data before navigating
    onSolved();
    // Small delay to allow state update
    setTimeout(() => {
      window.location.href = "/challenges";
    }, 100);
  };

  const isIdle = sessionState === "idle" || sessionState === "error";
  const isActive = sessionState === "connected";
  const isLoading =
    sessionState === "starting" ||
    sessionState === "connecting" ||
    sessionState === "validating" ||
    sessionState === "ending";

  if (sessionState === "solved") {
    return (
      <div className="terminal-container">
        <div className="terminal-header">
          <h2>Terminal</h2>
          <div className="terminal-controls">
            <span className="terminal-status solved">Solved</span>
          </div>
        </div>
        <div className="terminal-content">
          <div className="success-overlay">
            <div className="success-content">
              <div className="success-icon">
                {/* Big checkmark logo */}
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2 className="success-title">Challenge Complete!</h2>
              <p className="success-message">{solveMessage}</p>
              <button className="success-btn" onClick={handleBackToChallenges}>
                Back to Challenges
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <h2>Terminal</h2>
        <div className="terminal-controls">
          {isIdle && (
            <button
              className="terminal-btn start-btn"
              onClick={handleStartChallenge}
              disabled={isLoading}
            >
              {isLoading && sessionState === "starting"
                ? "Starting..."
                : "Start Challenge"}
            </button>
          )}

          {isActive && (
            <>
              <button
                className="terminal-btn validate-btn"
                onClick={handleValidate}
                disabled={isLoading}
              >
                {isLoading && sessionState === "validating"
                  ? "Validating..."
                  : "Submit Solution"}
              </button>
              <button
                className="terminal-btn end-btn"
                onClick={handleEndSession}
                disabled={isLoading}
              >
                {isLoading && sessionState === "ending"
                  ? "Ending..."
                  : "End Session"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="terminal-content">
        {isIdle && (
          <div className="terminal-overlay">
            <div className="terminal-overlay-content">
              <p>Click "Start Challenge" to begin your interactive session</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="terminal-loading-overlay">
            <div className="loading-spinner"></div>
            <p className="loading-text">
              {sessionState === "starting" && "Starting session..."}
              {sessionState === "connecting" && "Connecting to terminal..."}
              {sessionState === "validating" && "Validating solution..."}
              {sessionState === "ending" && "Ending session..."}
            </p>
          </div>
        )}

        <div
          ref={terminalRef}
          className={`terminal-wrapper ${isLoading ? "disabled" : ""}`}
        />
      </div>
    </div>
  );
};

export default Terminal;
