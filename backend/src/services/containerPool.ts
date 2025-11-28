import Docker from "dockerode";
import { logger } from "../utils/logger.js";
import { Container, ContainerPoolConfig } from "../types/index.js";
import { v4 as uuidv4 } from "uuid";

const docker = new Docker();

export class ContainerPool {
  private availableContainers: Set<Container> = new Set();
  private config: ContainerPoolConfig;
  private isInitialized = false;

  constructor(config: ContainerPoolConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Container pool already initialized");
      return;
    }

    logger.info(
      { poolSize: this.config.poolSize },
      "Initializing container pool",
    );

    // Pull image if not exists
    await this.ensureImageExists();

    // Create initial pool
    const promises = Array.from({ length: this.config.poolSize }, () =>
      this.createContainer(),
    );

    // Add created containers to available set
    const containers = await Promise.all(promises);
    containers.forEach((container) => {
      this.availableContainers.add(container);
    });

    this.isInitialized = true;
    logger.info(
      { availableContainers: this.availableContainers.size },
      "Container pool initialized successfully",
    );
  }

  private async ensureImageExists(): Promise<void> {
    try {
      await docker.getImage(this.config.imageName).inspect();
      logger.info({ image: this.config.imageName }, "Docker image found");
    } catch (error) {
      logger.error(
        { image: this.config.imageName },
        "Docker image not found. Please build it first.",
      );
      throw new Error(
        `Docker image ${this.config.imageName} not found. Run: docker build -f Dockerfile.challenge -t ${this.config.imageName} .`,
      );
    }
  }

  private async createContainer(): Promise<Container> {
    const containerName = `challenge-${uuidv4()}`;

    try {
      const container = await docker.createContainer({
        Image: this.config.imageName,
        name: containerName,
        Tty: true,
        OpenStdin: true,
        HostConfig: {
          Memory: this.parseMemoryLimit(this.config.memoryLimit),
          NanoCpus: this.parseCpuLimit(this.config.cpuLimit),
          NetworkMode: "none",
          ReadonlyRootfs: true,
          Tmpfs: {
            "/tmp": "rw,noexec,nosuid,size=50m",
            "/home/challenger": "rw,noexec,nosuid,size=100m",
          },
          SecurityOpt: ["no-new-privileges"],
          CapDrop: ["ALL"],
          CapAdd: ["CHOWN", "DAC_OVERRIDE", "SETGID", "SETUID"],
        },
      });

      await container.start();

      const containerData: Container = {
        id: container.id,
        name: containerName,
        createdAt: new Date(),
      };

      logger.info(
        { containerId: container.id, containerName },
        "Container created and started",
      );

      return containerData;
    } catch (error) {
      logger.error({ error, containerName }, "Failed to create container");
      throw error;
    }
  }

  private parseMemoryLimit(limit: string): number {
    // Convert "256m" to bytes
    const match = limit.match(/^(\d+)([kmg]?)$/i);
    if (!match) throw new Error(`Invalid memory limit: ${limit}`);

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers: { [key: string]: number } = {
      "": 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }

  private parseCpuLimit(limit: string): number {
    // Convert "0.5" to nanocpus (1 CPU = 1e9 nanocpus)
    return parseFloat(limit) * 1e9;
  }

  async getContainer(): Promise<Container | null> {
    if (this.availableContainers.size === 0) {
      logger.warn("No containers available in pool");
      return null;
    }

    const container = Array.from(this.availableContainers)[0];
    this.availableContainers.delete(container);

    logger.info(
      { containerId: container.id, remaining: this.availableContainers.size },
      "Container assigned from pool",
    );

    // Refill pool asynchronously
    this.createContainer()
      .then((newContainer) => {
        this.availableContainers.add(newContainer);
        logger.info(
          {
            containerId: newContainer.id,
            poolSize: this.availableContainers.size,
          },
          "Pool refilled with new container",
        );
      })
      .catch((error) => {
        logger.error({ error }, "Failed to refill pool");
      });

    return container;
  }

  async releaseContainer(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.stop();
      await container.remove();

      logger.info({ containerId }, "Container released and removed");

      // Create replacement
      const newContainer = await this.createContainer();
      this.availableContainers.add(newContainer);

      logger.info(
        { poolSize: this.availableContainers.size },
        "Replacement container added to pool",
      );
    } catch (error) {
      logger.error({ error, containerId }, "Failed to release container");
    }
  }

  async cleanup(): Promise<void> {
    logger.info("Cleaning up all containers in pool");

    const containers = Array.from(this.availableContainers);
    const promises = containers.map(async (container) => {
      try {
        const dockerContainer = docker.getContainer(container.id);
        await dockerContainer.stop();
        await dockerContainer.remove();
        logger.info({ containerId: container.id }, "Container cleaned up");
      } catch (error) {
        logger.error(
          { error, containerId: container.id },
          "Failed to cleanup container",
        );
      }
    });

    await Promise.all(promises);
    this.availableContainers.clear();
    logger.info("Container pool cleanup complete");
  }

  getPoolSize(): number {
    return this.availableContainers.size;
  }
}
