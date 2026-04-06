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

  // Start listening IMMEDIATELY to prevent IP/DNS errors in preview
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER IS LIVE AND STABLE ON PORT ${PORT} <<<`);
  });

  // Global Redirect to Netlify (Stable Version)
  const API_URL = process.env.API_URL || "https://tgbfinale.netlify.app/";
  
  app.get("*", (req, res, next) => {
    // Allow the validation key to be accessed if needed
    if (req.path === "/validation-key.txt" || req.path === "/api/health") {
      return next();
    }
    console.log(`Redirecting request from ${req.path} to ${API_URL}...`);
    res.redirect(301, API_URL);
  });

  app.use(cors());
  app.use(express.json());

  // Pi Network Validation Key
  app.get("/validation-key.txt", (req, res) => {
    res.type('text/plain');
    res.send("4dcd60204813d07453f6579ecfc9b4f8d3351314b95bef8a04b78f9c9d5dc7ceceb6803cf13e5281061f06718e3feeb114c14abb9297f957d0f3587752792e69");
  });

  // Serve static files from the 'dist' directory
  const distPath = path.join(process.cwd(), "dist");
  
  if (fs.existsSync(distPath)) {
    console.log("Serving production build from /dist");
    app.use(express.static(distPath));
    
    // API routes and other specific handlers should stay above the wildcard
    app.get("/api/health", (req, res) => res.json({ status: "ok" }));
    
    // SPA fallback
    app.get("*", (req, res) => {
      // Check if it's an API call or a static file request first
      if (req.path.startsWith('/api') || req.path.includes('.')) {
        return res.status(404).send('Not found');
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Fallback to Vite middleware for development if dist doesn't exist
    console.log("Dist folder not found, falling back to Vite middleware");
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          host: '0.0.0.0',
          hmr: false 
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("Vite failed:", err);
    }
  }
}

startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
});
