import "dotenv/config";
import http from "http";
import app from "./index";
import { initSocket } from "./services/socket";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

// Create HTTP server from Express app
const server = http.createServer(app);

// Attach Socket.io to the same HTTP server
initSocket(server);

// Start listening
server.listen(PORT, () => {
  console.log(`[server] PitWall backend running on http://localhost:${PORT}`);
  console.log(`[server] Frontend CORS origin: ${process.env.FRONTEND_URL ?? "http://localhost:8080"}`);
  console.log(`[server] Socket.io ready`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[server] received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("[server] HTTP server closed");
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => {
    console.error("[server] forced exit after timeout");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
