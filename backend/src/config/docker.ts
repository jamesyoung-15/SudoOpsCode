import { ContainerPoolConfig } from "../types/index.js";
import dotenv from "dotenv";

dotenv.config();

const dockerConfig: ContainerPoolConfig = {
  poolSize: parseInt(process.env.POOL_SIZE || "5"),
  imageName: process.env.DOCKER_IMAGE || "sysadmin-challenges:base",
  memoryLimit: process.env.MEMORY_LIMIT || "256m",
  cpuLimit: process.env.CPU_LIMIT || "0.5",
  idleTimeoutMs: parseInt(process.env.IDLE_TIMEOUT_MS || "900000"), // default: 15 min
  maxSessionTimeMs: parseInt(process.env.MAX_SESSION_TIME_MS || "1200000"), // default: 20 min
};

export { dockerConfig };
