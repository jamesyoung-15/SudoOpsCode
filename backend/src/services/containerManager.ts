import Docker from "dockerode";
import { logger } from "../utils/logger.js";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
import tar from "tar-stream";
import { challengeLoader } from "./challengeLoader.js";

const docker = new Docker();

export class ContainerManager {
  private readonly IMAGE_NAME = config.docker.imageName;
  private readonly CHALLENGES_DIR = path.join(config.docker.challengesPath);

  /**
   * Ensure the base Docker image exists
   */
  async ensureImage(): Promise<void> {
    try {
      await docker.getImage(this.IMAGE_NAME).inspect();
      logger.debug("Docker image already exists");
    } catch (error) {
      logger.info("Building Docker image...");

      const dockerfile = `
FROM alpine:latest

# Install common tools
RUN apk add --update --no-cache \
    bash \
    vim \
    nano \
    curl \
    grep \
    sed \
    busybox \
    coreutils \
    util-linux \
    procps \
    net-tools \
    bind-tools \
    sudo \
    python3

# Create non-root user
RUN adduser -D -s /bin/bash challenger

# Create validation scripts directory
RUN mkdir -p /validate && chown challenger:challenger /validate

# Set working directory
WORKDIR /home/challenger

# Switch to non-root user
USER challenger

# Keep container running
CMD ["sleep", "infinity"]
      `.trim();

      const pack = tar.pack();

      pack.entry({ name: "Dockerfile" }, dockerfile);
      pack.finalize();

      const stream = await docker.buildImage(pack, {
        t: this.IMAGE_NAME,
      });

      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });

      logger.info("Docker image built successfully");
    }
  }

  /**
   * Create a container for a specific challenge
   */
  async createContainer(challengeId: number, userId: number): Promise<string> {
    await this.ensureImage();

    const challengeDir = await this.getChallengeDir(challengeId);
    const absoluteChallengeDir = path.resolve(challengeDir);

    if (!fs.existsSync(absoluteChallengeDir)) {
      throw new Error(`Challenge directory not found: ${absoluteChallengeDir}`);
    }

    logger.debug(
      {
        challengeId,
        userId,
        challengeDir: absoluteChallengeDir,
      },
      "Creating container with challenge directory",
    );

    const container = await docker.createContainer({
      Image: this.IMAGE_NAME,
      Tty: true,
      OpenStdin: true,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        Binds: [
          `${absoluteChallengeDir}:/challenge:ro`, // Mount challenge files as read-only
        ],
        Memory: config.docker.memoryLimit, // Memory limit from config
        NanoCpus: Math.floor(config.docker.cpuLimit * 1e9), // CPU limit from config
        PidsLimit: 100, // Limit number of processes
        NetworkMode: "none", // No network access
      },
      Labels: {
        "challenges.user_id": userId.toString(),
        "challenges.challenge_id": challengeId.toString(),
        "challenges.created_at": new Date().toISOString(),
      },
    });

    await container.start();

    // Run setup script if it exists
    const setupScript = path.join(absoluteChallengeDir, "setup.sh");
    if (fs.existsSync(setupScript)) {
      logger.debug(
        { containerId: container.id, challengeId },
        "Running setup script",
      );

      const exec = await container.exec({
        Cmd: ["/bin/bash", "/challenge/setup.sh"],
        AttachStdout: true,
        AttachStderr: true,
      });

      await exec.start({});
    }

    logger.info(
      { containerId: container.id, challengeId, userId },
      "Container created",
    );
    return container.id;
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);

      // Stop if running
      try {
        await container.stop({ t: 5 }); // 5 second timeout
      } catch (error) {
        // Container might already be stopped
      }

      await container.remove({ force: true });
      logger.info({ containerId }, "Container removed");
    } catch (error) {
      logger.error({ error, containerId }, "Failed to remove container");
      throw error;
    }
  }

  /**
   * Validate challenge solution
   */
  async validateChallenge(
    containerId: string,
    challengeId: number,
  ): Promise<boolean> {
    const container = docker.getContainer(containerId);
    const challengeDir = await this.getChallengeDir(challengeId);
    const validateScript = path.join(challengeDir, "validate.sh");

    if (!fs.existsSync(validateScript)) {
      throw new Error(
        `Validation script not found for challenge ${challengeId}`,
      );
    }

    try {
      logger.debug({ containerId, challengeId }, "Starting validation");
      const exec = await container.exec({
        Cmd: ["/bin/bash", "/challenge/validate.sh"],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({});

      logger.debug({ containerId, challengeId }, "Validation script started");

      // IMPORTANT: Consume the stream data to prevent blocking
      let output = "";
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString();
      });

      // Wait for validation to complete
      await new Promise((resolve) => {
        stream.on("end", resolve);
      });

      logger.debug({ containerId, challengeId }, "Validation script finished");

      const inspect = await exec.inspect();
      const exitCode = inspect.ExitCode;

      logger.debug(
        { containerId, challengeId, exitCode },
        "Validation complete",
      );

      return exitCode === 0;
    } catch (error) {
      logger.error({ error, containerId, challengeId }, "Validation failed");
      return false;
    }
  }

  async createExec(containerId: string, options: any) {
    const container = docker.getContainer(containerId);
    const exec = await container.exec(options);
    logger.debug({ containerId, execId: exec.id }, "Created exec instance");
    return exec;
  }

  /**
   * Get challenge directory path
   */
  private async getChallengeDir(challengeId: number): Promise<string> {
    return await challengeLoader.getChallengeDirectory(challengeId);
  }

  /**
   * Cleanup all containers
   */
  async cleanupAllContainers(): Promise<void> {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        label: ["challenges.user_id"],
      },
    });

    logger.info({ count: containers.length }, "Cleaning up containers");

    for (const containerInfo of containers) {
      await this.removeContainer(containerInfo.Id);
    }
  }
}

export const containerManager = new ContainerManager();
