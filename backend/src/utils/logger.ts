import pino from "pino";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const level = process.env.LOG_LEVEL || "info";
const logToFile =
  process.env.LOG_TO_FILE === "true" || process.env.LOG_TO_FILE === "1";
const logFilePath = process.env.LOG_FILE_PATH || "./logs/app.log";

// ensure directory exists when logging to file
if (logToFile) {
  try {
    await fs.mkdir(path.dirname(logFilePath), { recursive: true });
  } catch (err) {
    // ignore mkdir errors; pino will throw if it cannot write
    // console.error(`Failed to create log directory: ${err}`);
  }
}

const baseOptions = {
  level,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

let logger: pino.Logger;

if (logToFile) {
  // create a file destination and keep console pretty via transport (if available)
  const fileDest = pino.destination({ dest: logFilePath, sync: false });

  // console transport using pino-pretty (works in modern pino)
  const consoleTransport = pino.transport
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "yyyy-mm-dd HH:MM:ss",
        },
      })
    : process.stdout;

  // combine streams: file + console
  logger = pino(
    baseOptions,
    pino.multistream([
      { level, stream: fileDest },
      { level, stream: consoleTransport },
    ]),
  );
} else {
  // only console pretty
  logger = pino({
    ...baseOptions,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "yyyy-mm-dd HH:MM:ss",
      },
    },
  });
}

export { logger };
