import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // 1. Pi Network Validation - MUST BE ABSOLUTELY FIRST
  app.get("/validation-key.txt", (req, res) => {
    const key = "4dcd60204813d07453f6579ecfc9b4f8d3351314b95bef8a04b78f9c9d5dc7ceceb6803cf13e5281061f06718e3feeb114c14abb9297f957d0f3587752792e69";
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.status(200).send(key.trim());
    return;
  });

  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json());

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

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production";
  console.log(`Starting server in ${isProd ? 'production' : 'development'} mode`);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Trust Global Bank server running at http://localhost:${PORT}`);
    
    // Self-ping every 10 minutes to keep Render alive
    if (process.env.NODE_ENV === "production" && process.env.APP_URL) {
      setInterval(() => {
        const url = `${process.env.APP_URL}/api/health`;
        fetch(url).catch(() => console.log("Self-ping failed, but that's okay."));
      }, 600000); // 10 minutes
    }
  });
}

startServer();
