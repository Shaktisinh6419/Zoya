import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Search (Proxy)
  app.post("/api/search", async (req, res) => {
    const { query } = req.body;
    const apiKey = process.env.SEARCH_API_KEY || "e4BAaJxFYZ7Pp7fMnRZMha83";

    try {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query }),
      });

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Search API error:", error);
      res.status(500).json({ error: "Failed to fetch search results" });
    }
  });

  // API Route for Gemini (if we want to move AI calls to server for security)
  // For now, keeping them in frontend but adding this proxy for the search key protection.

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
