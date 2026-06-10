import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import {
  openf1,
  latestRaceSession,
  isSessionLive,
  sleep,
  type OF1Session,
} from "./openf1";

const POLL_INTERVAL_MS = 5_000; // poll every 5 seconds
const OF1_RATE_DELAY_MS = 300; // 300ms between each OpenF1 call

let io: SocketServer | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentSession: OF1Session | null = null;

// ─── Polling loop ─────────────────────────────────────────────────────────────

async function pollLiveData(): Promise<void> {
  if (!io) return;
  if (!currentSession) return;

  const live = isSessionLive(currentSession);

  if (!live) {
    console.log("[socket] no live session — stopping poll");
    stopPolling();
    io.emit("session_status", { live: false });
    return;
  }

  const key = currentSession.session_key;

  try {
    // Fetch each endpoint with 300ms delay between calls (rate-limit)
    const positions = await openf1.positions(key, true);
    await sleep(OF1_RATE_DELAY_MS);

    const intervals = await openf1.intervals(key, true);
    await sleep(OF1_RATE_DELAY_MS);

    const stints = await openf1.stints(key, true);
    await sleep(OF1_RATE_DELAY_MS);

    const pits = await openf1.pits(key, true);

    // Emit to all connected clients
    io.emit("position_update", positions);
    io.emit("interval_update", intervals);
    io.emit("stint_update", stints);
    io.emit("pit_update", pits);
    io.emit("session_status", { live: true });

    console.log(
      `[socket] emitted live data — ${positions.length} positions, ${intervals.length} intervals`,
    );
  } catch (err) {
    console.error("[socket] poll error:", err);
  }
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startPolling(): void {
  stopPolling();
  console.log("[socket] starting live poll every", POLL_INTERVAL_MS, "ms");
  pollTimer = setInterval(pollLiveData, POLL_INTERVAL_MS);
}

// ─── Session detection ────────────────────────────────────────────────────────

async function detectSession(): Promise<void> {
  try {
    const sessions = await openf1.raceSessions(2025);
    currentSession = latestRaceSession(sessions);

    if (!currentSession) {
      console.log("[socket] no race session found for 2025");
      io?.emit("session_status", { live: false });
      return;
    }

    const live = isSessionLive(currentSession);
    console.log(
      `[socket] latest session: ${currentSession.circuit_short_name} (key: ${currentSession.session_key}) — live: ${live}`,
    );

    if (live) {
      startPolling();
    } else {
      io?.emit("session_status", { live: false });
    }
  } catch (err) {
    console.error("[socket] session detection failed:", err);
    io?.emit("session_status", { live: false });
  }
}

// ─── Connection handler ───────────────────────────────────────────────────────

function handleConnection(socket: Socket): void {
  console.log(`[socket] client connected: ${socket.id}`);

  // Immediately send current session status to the new client
  if (currentSession) {
    socket.emit("session_status", { live: isSessionLive(currentSession) });
  } else {
    socket.emit("session_status", { live: false });
  }

  // Client requests to join a race session
  socket.on("join_race", async ({ sessionKey }: { sessionKey: string | number }) => {
    console.log(`[socket] join_race from ${socket.id}, sessionKey: ${sessionKey}`);

    if (sessionKey === "latest" && currentSession) {
      // Send a snapshot of the latest data immediately
      const key = currentSession.session_key;
      const live = isSessionLive(currentSession);
      try {
        const [positions, intervals, stints, pits] = await Promise.all([
          openf1.positions(key, live),
          openf1.intervals(key, live),
          openf1.stints(key, live),
          openf1.pits(key, live),
        ]);
        socket.emit("position_update", positions);
        socket.emit("interval_update", intervals);
        socket.emit("stint_update", stints);
        socket.emit("pit_update", pits);
        socket.emit("session_status", { live });
      } catch (err) {
        console.error(`[socket] snapshot error for ${socket.id}:`, err);
        socket.emit("session_status", { live: false });
      }

      // Start polling if there is a live session and no poll is running
      if (live && !pollTimer) startPolling();
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] client disconnected: ${socket.id} (${reason})`);
    // If no clients remain, stop polling to conserve API quota
    if (io && io.sockets.sockets.size === 0) {
      console.log("[socket] no clients left — stopping poll");
      stopPolling();
    }
  });
}

// ─── Initialiser ─────────────────────────────────────────────────────────────

/**
 * Attach Socket.io to an existing HTTP server and start the live-data engine.
 */
export function initSocket(server: HttpServer): SocketServer {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:8080";

  io = new SocketServer(server, {
    cors: {
      origin: frontendUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", handleConnection);

  // Detect current session on startup
  detectSession();

  // Re-detect every 10 minutes (handles sessions rolling over)
  setInterval(detectSession, 10 * 60_000);

  console.log("[socket] Socket.io initialised, CORS origin:", frontendUrl);
  return io;
}

export { io };
