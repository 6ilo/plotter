import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes-clean";
import { log } from "./vite";
import { serveStatic, setupVite } from "./vite";

/**
 * Main application function
 */
async function main() {
  // Create Express app
  const app = express();

  // Basic app setup
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup session
  const MemoryStoreSession = MemoryStore(session);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 86400000 },
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // prune expired entries every 24h
      }),
    })
  );

  // Setting up error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    log("Error: " + err.message, "error");
    res.status(500).json({ error: err.message || "Something went wrong" });
  });

  // Register routes and start the server
  const server = await registerRoutes(app);

  // Set up Vite middleware for development
  await setupVite(app, server);

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  // Get PORT from env or use 5000 as default
  const PORT = process.env.PORT || 5000;

  // Start the server
  server.listen(PORT, () => {
    log(`serving on port ${PORT}`, "express");
  });
}

// Run the application
main().catch((err) => {
  console.error("Failed to start application:", err);
  process.exit(1);
});