const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

function getGoogleConfig() {
  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || "",
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    apiKey: process.env.GOOGLE_API_KEY || "",
  };
}

app.get("/api/health", (_req, res) => {
  const cfg = getGoogleConfig();
  res.json({
    ok: true,
    port: PORT,
    googleConfigured: Boolean(cfg.projectId && cfg.location && cfg.apiKey),
    projectId: cfg.projectId || null,
    location: cfg.location || null,
  });
});

app.get("/api/google/check", (_req, res) => {
  const cfg = getGoogleConfig();
  res.json({
    ok: Boolean(cfg.projectId && cfg.location && cfg.apiKey),
    projectId: cfg.projectId || null,
    location: cfg.location || null,
    hasApiKey: Boolean(cfg.apiKey),
  });
});

app.post("/api/google/generate", async (req, res) => {
  try {
    const cfg = getGoogleConfig();
    const {
      prompt = "",
      model = "gemini-2.5-flash-image",
      parts = [],
      ratio = "4:5",
      quality = "2K",
    } = req.body || {};

    if (!cfg.projectId || !cfg.location || !cfg.apiKey) {
      return res.status(400).json({
        ok: false,
        error: "Faltan variables de Google Cloud en Railway.",
      });
    }

    const finalParts = Array.isArray(parts) && parts.length
      ? parts
      : [{ text: prompt }];

    if (!finalParts.length) {
      return res.status(400).json({
        ok: false,
        error: "Faltan datos para generar.",
      });
    }

    const endpoint =
      `https://${cfg.location}-aiplatform.googleapis.com/v1/projects/${cfg.projectId}` +
      `/locations/${cfg.location}/publishers/google/models/${model}:generateContent` +
      `?key=${cfg.apiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: finalParts,
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: ratio,
          imageSize: String(quality).toUpperCase(),
        },
      },
    };

    const googleRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await googleRes.json();

    if (!googleRes.ok) {
      return res.status(googleRes.status).json({
        ok: false,
        error: data?.error?.message || "Error al llamar a Google.",
        raw: data,
      });
    }

    const images = [];
    const texts = [];

    for (const candidate of data?.candidates || []) {
      for (const part of candidate?.content?.parts || []) {
        if (part?.inlineData?.data) {
          images.push(
            `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`
          );
        }
        if (typeof part?.text === "string" && part.text.trim()) {
          texts.push(part.text.trim());
        }
      }
    }

    return res.json({
      ok: true,
      images,
      text: texts.join("\n"),
      raw: data,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || String(error),
    });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "dashboard_final.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});