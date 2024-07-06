const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cluster = require("cluster");
const numCPUs = require("os").cpus().length;
const morgan = require("morgan");
const winston = require("winston");

const app = express();

// List of backend servers
let servers = [
  "https://sevenevelen.onrender.com",
  "https://sevenevelen2.onrender.com",
];

async function wakeUpServer() {
  await Promise.all(
    servers.map(async (server) => {
      const response = await fetch(server);
      const data = await response.json();
      console.log(data);
    })
  );
}

let currentServerIndex = 0;

// Logging configuration
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// HTTP request logging in milliseconds
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      },
    },
  })
);

// Load balancing logic
const loadBalancer = (req, res, next) => {
  const target = servers[currentServerIndex];
  logger.info(`Proxying request to: ${target}`);
  createProxyMiddleware({ target, changeOrigin: true })(req, res, next);
  currentServerIndex = (currentServerIndex + 1) % servers.length;
};

// Health check interval
const healthCheckInterval = 5000; // 5 seconds

// Memory check interval
const memoryCheckInterval = 60000; // 1 minute

// Perform health checks on backend servers
const performHealthChecks = () => {
  servers.forEach((server, index) => {
    // Perform a health check on each server asynchronously
    // If server is unhealthy, remove it from the pool
    // Add logic as per your health check mechanism (e.g., HTTP GET request to /health endpoint)
  });
};

// Memory leak check
const checkMemoryUsage = () => {
  const memoryUsage = process.memoryUsage();
  const memoryLimit = 512 * 1024 * 1024; // 512MB
  if (memoryUsage.heapUsed > memoryLimit) {
    logger.error(`Memory leak detected. Restarting worker...`);
    process.exit(1); // Exit worker process
  }
};

wakeUpServer().then(() => {
  // Worker process
  if (cluster.isMaster) {
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    // Health check interval
    setInterval(performHealthChecks, healthCheckInterval);

    // Memory check interval
    setInterval(checkMemoryUsage, memoryCheckInterval);
  } else {
    // Worker process
    app.use(loadBalancer);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Worker ${cluster.worker.id} running on port ${PORT}`);
    });
  }
});
