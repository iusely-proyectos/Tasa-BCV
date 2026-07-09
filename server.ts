import express from "express";
import path from "path";
import fs from "fs";
import https from "https";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const STATE_FILE = path.join(process.cwd(), "bcv_state.json");

interface RateState {
  usd: number;
  eur: number;
  cny: number;
  try: number;
  rub: number;
  rawUsd: number;
  rawEur: number;
  rawCny: number;
  rawTry: number;
  rawRub: number;
  dateText: string;
  updatedAt: string;
}

interface HistoryItem {
  id: string;
  usd: number;
  eur: number;
  dateText: string;
  updatedAt: string;
}

interface AppState {
  current: RateState;
  history: HistoryItem[];
}

// Initial state based on the user's provided screenshot
const DEFAULT_STATE: AppState = {
  current: {
    usd: 667.05,
    eur: 763.19,
    cny: 98.40,
    try: 14.25,
    rub: 8.63,
    rawUsd: 667.05000000,
    rawEur: 763.19191650,
    rawCny: 98.39656596,
    rawTry: 14.25354014,
    rawRub: 8.63048259,
    dateText: "Fecha Valor: Lunes, 06 Julio 2026",
    updatedAt: new Date().toISOString()
  },
  history: [
    {
      id: "hist_1",
      usd: 665.12,
      eur: 760.85,
      dateText: "Fecha Valor: Viernes, 03 Julio 2026",
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "hist_2",
      usd: 663.45,
      eur: 758.90,
      dateText: "Fecha Valor: Jueves, 02 Julio 2026",
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "hist_3",
      usd: 661.80,
      eur: 757.10,
      dateText: "Fecha Valor: Miércoles, 01 Julio 2026",
      updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "hist_4",
      usd: 659.95,
      eur: 755.02,
      dateText: "Fecha Valor: Martes, 30 Junio 2026",
      updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

// Helper to load state
function loadState(): AppState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error loading state file, resetting to default:", err);
  }
  // Write default state if it doesn't exist or is invalid
  saveState(DEFAULT_STATE);
  return DEFAULT_STATE;
}

// Helper to save state
function saveState(state: AppState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving state file:", err);
  }
}

// Decode basic HTML entities to keep strings clean
function decodeHTMLEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
    .replace(/\s+/g, " ")
    .trim();
}

// Scraping function using Node https
function fetchBCVHtml(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "www.bcv.org.ve",
      port: 443,
      path: "/",
      method: "GET",
      rejectUnauthorized: false, // Critical for BCV due to recurrent SSL cert issues
      timeout: 12000, // 12 seconds timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    };

    const req = https.get(options, (res) => {
      // Handle non-200 status codes
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`Server returned status code ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => { resolve(data); });
    });

    req.on("error", (err) => { reject(err); });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout waiting for BCV response"));
    });
    req.end();
  });
}

// Extract a specific rate by ID
function extractRate(html: string, currencyId: string): number | null {
  const idIndex = html.indexOf(`id="${currencyId}"`);
  if (idIndex === -1) return null;
  
  // Take a slice of 450 characters after the ID
  const slice = html.substring(idIndex, idIndex + 450);
  
  // Find the first decimal number formatted as 12,34 or 12.34
  const numberRegex = /(\d+[\.,]\d+)/;
  const match = slice.match(numberRegex);
  if (match) {
    const valueStr = match[1].replace(",", ".").trim();
    const val = parseFloat(valueStr);
    return isNaN(val) ? null : val;
  }
  return null;
}

// Extract date text from BCV html
function isValidDateText(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.includes("%")) return false;
  if (trimmed.length < 8) return false;
  const hasLetters = /[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(trimmed);
  if (!hasLetters) return false;
  if (/^\d+[\.,]\d+$/.test(trimmed)) return false;
  return true;
}

function extractDate(html: string): string {
  // Look for text like "Fecha Valor:" or class date-display-single
  const dateRegexes = [
    /class="date-display-single"[^>]*>\s*([^<]+)\s*<\/span>/i,
    /Fecha Valor:[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i,
    /Fecha Valor:[\s\S]*?<strong>\s*([^<]+)\s*<\/strong>/i,
    /Fecha Valor:\s*([^<]+)/i
  ];
  
  for (const regex of dateRegexes) {
    const match = html.match(regex);
    if (match) {
      const decoded = decodeHTMLEntities(match[1]).trim();
      if (isValidDateText(decoded)) {
        return decoded;
      }
    }
  }
  
  // Fallback to today's date formatted nicely if not found
  const options: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  const formattedToday = new Date().toLocaleDateString("es-VE", options);
  // Capitalize first letter
  const capToday = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);
  return `Fecha Valor: ${capToday}`;
}

// Shared core scraping & state updating function
async function performScrapeAndStore(): Promise<{ success: boolean; message: string; state: AppState }> {
  const state = loadState();
  let success = false;
  let message = "";
  let scrapedRates: Partial<RateState> = {};

  try {
    const html = await fetchBCVHtml();
    
    const scrapedUsd = extractRate(html, "dolar");
    const scrapedEur = extractRate(html, "euro");
    const scrapedCny = extractRate(html, "cny");
    const scrapedTry = extractRate(html, "try");
    const scrapedRub = extractRate(html, "rub");
    const dateText = extractDate(html);

    if (scrapedUsd !== null) {
      scrapedRates = {
        rawUsd: scrapedUsd,
        rawEur: scrapedEur || state.current.rawEur,
        rawCny: scrapedCny || state.current.rawCny,
        rawTry: scrapedTry || state.current.rawTry,
        rawRub: scrapedRub || state.current.rawRub,
        usd: parseFloat(scrapedUsd.toFixed(2)),
        eur: parseFloat((scrapedEur || state.current.rawEur).toFixed(2)),
        cny: parseFloat((scrapedCny || state.current.rawCny).toFixed(2)),
        try: parseFloat((scrapedTry || state.current.rawTry).toFixed(2)),
        rub: parseFloat((scrapedRub || state.current.rawRub).toFixed(2)),
        dateText: dateText.startsWith("Fecha Valor") ? dateText : `Fecha Valor: ${dateText}`,
        updatedAt: new Date().toISOString()
      };

      // Check if the USD rate changed (using 2-decimal precision for matching)
      if (Math.abs(state.current.usd - scrapedRates.usd!) > 0.001) {
        // A change occurred! Shift current rate to history
        const historyItem: HistoryItem = {
          id: `hist_${Date.now()}`,
          usd: state.current.usd,
          eur: state.current.eur,
          dateText: state.current.dateText,
          updatedAt: state.current.updatedAt
        };

        // Prepends and keeps only 4 historical elements
        state.history = [historyItem, ...state.history].slice(0, 4);
        message = "¡Nueva tasa detectada! El historial ha sido actualizado.";
      } else {
        message = "La tasa del BCV no ha cambiado desde la última actualización.";
      }

      // Update current rates
      state.current = {
        ...state.current,
        ...scrapedRates
      };

      saveState(state);
      success = true;
    } else {
      throw new Error("No se pudo extraer la tasa de USD del HTML del BCV.");
    }
  } catch (err: any) {
    console.error("Scraping failed:", err);
    success = false;
    message = `No se pudo conectar o parsear la página del BCV: ${err.message}. Mostrando datos guardados de forma segura.`;
  }

  return { success, message, state };
}

// Background scheduler specifically built for Venezuelan 4:00 PM onwards window
function setupBackgroundScheduler() {
  console.log("Iniciando programador de fondo para sincronización automática del BCV...");
  
  // Checking every 1 minute to trigger conditional checks
  setInterval(async () => {
    try {
      const now = new Date();
      // Calculate Venezuela time (UTC-4)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const veDate = new Date(utc - (4 * 3600000));
      
      const veDay = veDate.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
      const veHour = veDate.getHours();
      const veMinute = veDate.getMinutes();

      // De lunes a viernes, entre las 4:00 PM (16:00) y las 5:00 PM (17:00), que es el intervalo solicitado,
      // ejecutamos la sincronización constantemente CADA 1 MINUTO para capturar el cambio al instante.
      const isGoldenHour = (veHour === 16); // 16:00 a 16:59 (4:00 PM a 5:00 PM)
      const isCriticalWindow = (veHour >= 17 && veHour < 19); // 5:00 PM a 7:00 PM
      
      let shouldSync = false;
      
      if (veDay >= 1 && veDay <= 5) {
        if (isGoldenHour) {
          // Cada 1 minuto de 4:00 PM a 5:00 PM
          shouldSync = true;
        } else if (isCriticalWindow) {
          // Cada 5 minutos de 5:00 PM a 7:00 PM
          shouldSync = (veMinute % 5 === 0);
        } else {
          // Cada 30 minutos el resto del día
          shouldSync = (veMinute % 30 === 0);
        }
      } else {
        // Fines de semana: cada 30 minutos por seguridad
        shouldSync = (veMinute % 30 === 0);
      }

      if (shouldSync) {
        console.log(`[AUTOSYNC] Sincronización automática periódica en curso... (Hora VE: ${veHour}:${veMinute.toString().padStart(2, '0')}, Día VE: ${veDay})`);
        const result = await performScrapeAndStore();
        console.log(`[AUTOSYNC] Sincronización automática completada. Éxito: ${result.success}. Mensaje: ${result.message}`);
      }
    } catch (err) {
      console.error("[AUTOSYNC] Error en el ciclo de actualización de fondo:", err);
    }
  }, 60000);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API to get rates and history (CORS enabled for external synchronization)
  app.get("/api/rates", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    const state = loadState();
    res.json(state);
  });

  // API to update the rate (performs real scraping)
  app.post("/api/rates/scrape", async (req, res) => {
    const result = await performScrapeAndStore();
    res.json(result);
  });

  // API to manually update rates (triggers shift if USD is different)
  app.post("/api/rates/manual", (req, res) => {
    const { usd, eur, cny, tryRate, rub, dateText } = req.body;
    
    if (typeof usd !== "number" || isNaN(usd) || usd <= 0) {
      res.status(400).json({ error: "La tasa del USD debe ser un número positivo válido." });
      return;
    }

    const state = loadState();
    const newUsd = parseFloat(usd.toFixed(2));
    const newEur = typeof eur === "number" ? parseFloat(eur.toFixed(2)) : parseFloat((newUsd * 1.14).toFixed(2));
    const newCny = typeof cny === "number" ? parseFloat(cny.toFixed(2)) : state.current.cny;
    const newTry = typeof tryRate === "number" ? parseFloat(tryRate.toFixed(2)) : state.current.try;
    const newRub = typeof rub === "number" ? parseFloat(rub.toFixed(2)) : state.current.rub;

    let message = "Tasa actualizada manualmente.";

    if (Math.abs(state.current.usd - newUsd) > 0.001) {
      // Rate changed! Shift old to history
      const historyItem: HistoryItem = {
        id: `hist_${Date.now()}`,
        usd: state.current.usd,
        eur: state.current.eur,
        dateText: state.current.dateText,
        updatedAt: state.current.updatedAt
      };
      state.history = [historyItem, ...state.history].slice(0, 4);
      message = "¡Tasa diferente guardada! Se desplazó la tasa anterior al historial.";
    }

    state.current = {
      usd: newUsd,
      eur: newEur,
      cny: newCny,
      try: newTry,
      rub: newRub,
      rawUsd: usd,
      rawEur: typeof eur === "number" ? eur : usd * 1.1441,
      rawCny: typeof cny === "number" ? cny : state.current.rawCny,
      rawTry: typeof tryRate === "number" ? tryRate : state.current.rawTry,
      rawRub: typeof rub === "number" ? rub : state.current.rawRub,
      dateText: dateText || `Fecha Valor: Modificado manualmente el ${new Date().toLocaleDateString("es-VE")}`,
      updatedAt: new Date().toISOString()
    };

    saveState(state);
    res.json({ success: true, message, state });
  });

  // API to simulate a random rate change (for testing the history shifting easily)
  app.post("/api/rates/simulate", (req, res) => {
    const state = loadState();
    
    // Choose a random change of -3% to +3% (excluding 0)
    let percentChange = 0;
    while (Math.abs(percentChange) < 0.2) {
      percentChange = (Math.random() * 6) - 3; // -3% to +3%
    }
    
    const factor = 1 + (percentChange / 100);
    const newRawUsd = state.current.rawUsd * factor;
    const newUsd = parseFloat(newRawUsd.toFixed(2));

    const newRawEur = state.current.rawEur * factor;
    const newEur = parseFloat(newRawEur.toFixed(2));

    const newRawCny = state.current.rawCny * factor;
    const newCny = parseFloat(newRawCny.toFixed(2));

    const newRawTry = state.current.rawTry * factor;
    const newTry = parseFloat(newRawTry.toFixed(2));

    const newRawRub = state.current.rawRub * factor;
    const newRub = parseFloat(newRawRub.toFixed(2));

    // Shift current rate to history
    const historyItem: HistoryItem = {
      id: `hist_${Date.now()}`,
      usd: state.current.usd,
      eur: state.current.eur,
      dateText: state.current.dateText,
      updatedAt: state.current.updatedAt
    };

    state.history = [historyItem, ...state.history].slice(0, 4);

    // Format simulation date text
    const dateObj = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    const formattedDate = dateObj.toLocaleDateString("es-VE", options);
    const capDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    state.current = {
      usd: newUsd,
      eur: newEur,
      cny: newCny,
      try: newTry,
      rub: newRub,
      rawUsd: newRawUsd,
      rawEur: newRawEur,
      rawCny: newRawCny,
      rawTry: newRawTry,
      rawRub: newRawRub,
      dateText: `Fecha Valor: ${capDate} (Simulado)`,
      updatedAt: new Date().toISOString()
    };

    saveState(state);
    res.json({
      success: true,
      message: `¡Simulación ejecutada! Cambio del ${percentChange.toFixed(2)}%. Se desplazó la tasa de ${historyItem.usd.toFixed(2)} Bs/USD al historial.`,
      state
    });
  });

  // API to clear / reset history to mock defaults
  app.post("/api/rates/reset", (req, res) => {
    saveState(DEFAULT_STATE);
    res.json({ success: true, message: "Portal restaurado a los valores predeterminados.", state: DEFAULT_STATE });
  });

  // Vite Integration for dev or production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Serve index.html for any remaining route in production Express
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Initialize background automatic synchronization
  setupBackgroundScheduler();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
