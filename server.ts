import express from "express";
import path from "path";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Route for Examples
  app.get("/api/examples", async (req, res) => {
    console.log(`[Server] Received request for /api/examples from ${req.ip}`);
    try {
      const examplesPath = path.join(process.cwd(), 'public', 'data', 'examples.json');
      console.log(`[Server] Reading examples from: ${examplesPath}`);
      const data = await fs.readFile(examplesPath, 'utf8');
      res.json(JSON.parse(data));
      console.log(`[Server] Successfully served examples`);
    } catch (error) {
      console.error("[Server] Error reading examples:", error);
      res.status(500).json({ error: "Failed to fetch examples" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Content Learning App Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
  });
}

startServer();
