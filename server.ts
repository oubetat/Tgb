import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());

  // Pi Network Validation Key
  app.get("/validation-key.txt", (req, res) => {
    res.type("text/plain");
    res.send(process.env.PI_VALIDATION_KEY || "MISSING_VALIDATION_KEY");
  });

  // Health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  // Serve static files
  const distPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get("*", (req, res) =>
      res.sendFile(path.join(distPath, "index.html"))
    );
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVER IS LIVE ON PORT ${PORT} <<<`);
  });
}

startServer().catch((err) => {
  console.error("CRITICAL SERVER ERROR:", err);
});
