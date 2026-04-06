import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000; // Fixed port for AI Studio

  app.use(cors());
  app.use(express.json());

  // Pi Network Validation Key
  app.get("/validation-key.txt", (req, res) => {
    res.type('text/plain');
    res.send("4dcd60204813d07453f6579ecfc9b4f8d3351314b95bef8a04b78f9c9d5dc7ceceb6803cf13e5281061f06718e3feeb114c14abb9297f957d0f3587752792e69");
  });

  // Health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Start listening IMMEDIATELY to prevent IP/DNS errors in preview
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER IS LIVE ON PORT ${PORT} <<<`);
  });

  // Load Vite middleware for development
  try {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        hmr: false // Disable HMR to prevent flickering
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware integrated successfully");
  } catch (err) {
    console.error("Vite failed, falling back to static files:", err);
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
  }
}

startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
});
