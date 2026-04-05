import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

console.log("--- SERVER.TS EXECUTION STARTED ---");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock data for demo purposes
const mockWallets: Record<string, any> = {
  "user1": { pi: 100, usd: 500, dzd: 10000 },
  "user2": { pi: 50, usd: 200, dzd: 5000 }
};

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json());

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Pi Network Validation Key Route - Standard implementation
  app.get("/validation-key.txt", (req, res) => {
    const key = "4dcd60204813d07453f6579ecfc9b4f8d3351314b95bef8a04b78f9c9d5dc7ceceb6803cf13e5281061f06718e3feeb114c14abb9297f957d0f3587752792e69";
    res.type('text/plain');
    res.send(key.trim());
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV, piAppId: process.env.PI_APP_ID ? 'Configured' : 'Missing' });
  });

  // Test route to verify server is alive
  app.get("/test-alive", (req, res) => {
    res.send("Server is alive and responding on port 3000");
  });

  app.get("/api/exchange-rates", (req, res) => {
    res.json({
      pi_usd: 314159,
      usd_dzd: 134.5,
      last_updated: new Date().toISOString()
    });
  });

  // Pi Network Payment Approval
  app.post("/api/pi/approve", async (req, res) => {
    const { paymentId } = req.body;
    const apiKey = process.env.PI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "PI_API_KEY not configured in environment variables" });
    }
    
    try {
      console.log(`[Pi Payment] Approving payment: ${paymentId}`);
      const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pi API Error: ${error}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error(`[Pi Payment] Approval failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Pi Network Payment Completion
  app.post("/api/pi/complete", async (req, res) => {
    const { paymentId, txid } = req.body;
    const apiKey = process.env.PI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "PI_API_KEY not configured in environment variables" });
    }
    
    try {
      console.log(`[Pi Payment] Completing payment: ${paymentId} with txid: ${txid}`);
      const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ txid })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Pi API Error: ${error}`);
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error(`[Pi Payment] Completion failed: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pay", (req, res) => {
    const { amount, currency, merchantId, userId } = req.body;
    console.log(`Payment request: ${amount} ${currency} to ${merchantId} from ${userId}`);
    
    // Simple logic for demo
    if (mockWallets[userId] && mockWallets[userId][currency.toLowerCase()] >= amount) {
      mockWallets[userId][currency.toLowerCase()] -= amount;
      res.json({ success: true, reference: `TGB-${Math.random().toString(36).toUpperCase().slice(2, 10)}` });
    } else {
      res.status(400).json({ success: false, error: "Insufficient funds or user not found" });
    }
  });

  console.log(`Current Directory: ${process.cwd()}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`PORT: ${PORT}`);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          host: '0.0.0.0',
          port: 3000
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware loaded successfully");
    } catch (err) {
      console.error("Vite failed to start:", err);
      // Fallback to static if build exists
      const distPath = path.join(process.cwd(), "dist");
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          res.sendFile(path.join(distPath, "index.html"));
        });
      }
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      app.get("*", (req, res) => {
        res.status(500).send("Production build missing. Please run build first.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
