import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware for API calls
  app.use(express.json({ limit: '15mb' }));

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Proxy upload endpoint to route file uploads server-side to bypass client-side network firewall blocks/CORS
  app.post("/api/proxy-upload", async (req, res) => {
    try {
      const {
        name,
        type,
        base64Data,
        assessmentId,
        itemId,
        folderYear,
        partFolderName,
        itemFolderName,
        fullItemFolderName,
        partName,
        itemCode,
        itemName,
        currentPartNum
      } = req.body;

      if (!base64Data) {
        res.status(400).json({ status: "error", error: "ไม่มีข้อมูลไฟล์แนบ (No file data provided)" });
        return;
      }

      const baseUrl = 'https://script.google.com/macros/s/AKfycbzB0xAgBngYtD7ptUSh1FQ6Na364rHPOTrBcg4TtAT4gBhWaEnrOzSUYg7iwBiGY_JWcw/exec';
      const queryParams = new URL(baseUrl);
      queryParams.searchParams.set('filename', name || '');
      queryParams.searchParams.set('fileName', name || '');
      queryParams.searchParams.set('name', name || '');
      queryParams.searchParams.set('type', type || '');
      queryParams.searchParams.set('mimeType', type || '');
      queryParams.searchParams.set('assessmentId', assessmentId || '');
      queryParams.searchParams.set('itemId', itemId || '');
      queryParams.searchParams.set('year', String(folderYear || ''));
      queryParams.searchParams.set('fiscalYear', String(folderYear || ''));
      queryParams.searchParams.set('folderYear', String(folderYear || ''));
      queryParams.searchParams.set('yearFolderName', `ปีงบประมาณ ${folderYear || ''}`);
      
      queryParams.searchParams.set('partFolderName', partFolderName || '');
      queryParams.searchParams.set('itemFolderName', itemFolderName || '');
      queryParams.searchParams.set('fullItemFolderName', fullItemFolderName || '');
      queryParams.searchParams.set('partName', partName || '');
      queryParams.searchParams.set('itemCode', itemCode || '');
      queryParams.searchParams.set('itemName', itemName || '');
      queryParams.searchParams.set('partNumber', String(currentPartNum || ''));

      const scriptUrl = queryParams.toString();

      console.log(`[ProxyUpload] Proxying upload to Apps Script for file "${name}" (${type}). Size of base64: ${base64Data.length}`);

      const requestBody = JSON.stringify({
        filename: name,
        fileName: name,
        name: name,
        file_name: name,
        title: name,

        mimeType: type,
        mimetype: type,
        type: type,
        contentType: type,

        file: base64Data,
        base64: base64Data,
        data: base64Data,
        content: base64Data,
        contents: base64Data,

        assessmentId,
        itemId,
        year: folderYear,
        fiscalYear: folderYear,
        folderYear: folderYear,
        yearFolderName: `ปีงบประมาณ ${folderYear}`,

        partFolderName,
        itemFolderName,
        fullItemFolderName,
        partName,
        itemCode,
        itemName,
        partNumber: currentPartNum
      });

      // Send the POST request. Google Apps Script automatically coordinates with a 302 Found redirect,
      // which standard Node fetch (redirect: 'follow') follows automatically.
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: requestBody
      });

      if (!response.ok) {
        console.error(`[ProxyUpload] Google Apps Script returned status ${response.status}`);
        res.status(response.status).json({
          status: "error",
          error: `Google Apps Script returned HTTP status code: ${response.status}`
        });
        return;
      }

      const resText = await response.text();
      console.log(`[ProxyUpload] Apps Script returned raw response length: ${resText.length}. Response snippet: ${resText.substring(0, 150)}`);
      
      res.json({ text: resText });
    } catch (err: any) {
      console.error("[ProxyUpload] Upload proxying exception:", err);
      res.status(500).json({
        status: "error",
        error: err.message || "Internal server error during upload proxying."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the dist directory
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
