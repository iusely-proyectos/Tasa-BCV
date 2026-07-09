import { useState, useEffect, FormEvent } from "react";
import { 
  RefreshCw, 
  Calendar, 
  Edit3, 
  Info, 
  RotateCcw, 
  Check, 
  AlertTriangle,
  ArrowUpDown,
  History,
  X,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppState, RateState, HistoryItem } from "./types";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "warning" | "error" | "info";
    text: string;
  } | null>(null);

  // Manual Form State
  const [showManualForm, setShowManualForm] = useState<boolean>(false);
  const [manualUsd, setManualUsd] = useState<string>("");
  const [manualEur, setManualEur] = useState<string>("");
  const [manualCny, setManualCny] = useState<string>("");
  const [manualTry, setManualTry] = useState<string>("");
  const [manualRub, setManualRub] = useState<string>("");
  const [manualDateText, setManualDateText] = useState<string>("");

  // Fetch initial rates
  const fetchRates = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("/api/rates");
      if (!res.ok) throw new Error("No se pudo obtener las tasas.");
      const data: AppState = await res.json();
      setState(data);
      
      // Sync manual form values
      if (data.current) {
        setManualUsd(data.current.usd.toString());
        setManualEur(data.current.eur.toString());
        setManualCny(data.current.cny.toString());
        setManualTry(data.current.try.toString());
        setManualRub(data.current.rub.toString());
        setManualDateText(data.current.dateText);
      }
    } catch (err: any) {
      showNotification("error", err.message || "Error al conectar con el servidor.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();

    // Poll backend silently every 60 seconds for automatic updates
    const interval = setInterval(() => {
      fetchRates(false);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const showNotification = (type: "success" | "warning" | "error" | "info", text: string) => {
    setNotification({ type, text });
    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Scrape BCV Page Live
  const triggerScrape = async () => {
    setActionLoading("scrape");
    try {
      const res = await fetch("/api/rates/scrape", { method: "POST" });
      const data = await res.json();
      
      if (data.success) {
        setState(data.state);
        showNotification("success", data.message || "Tasas actualizadas exitosamente desde el BCV.");
        // Sync manual values
        setManualUsd(data.state.current.usd.toString());
        setManualEur(data.state.current.eur.toString());
        setManualCny(data.state.current.cny.toString());
        setManualTry(data.state.current.try.toString());
        setManualRub(data.state.current.rub.toString());
        setManualDateText(data.state.current.dateText);
      } else {
        showNotification("warning", data.message || "No se pudo raspar el sitio. Se cargaron los datos seguros de respaldo.");
      }
    } catch (err: any) {
      showNotification("error", "Error de red al consultar el sitio oficial.");
    } finally {
      setActionLoading(null);
    }
  };

  // Simulate Rate Fluctuation
  const triggerSimulation = async () => {
    setActionLoading("simulate");
    try {
      const res = await fetch("/api/rates/simulate", { method: "POST" });
      if (!res.ok) throw new Error("Error en la simulación.");
      const data = await res.json();
      if (data.success) {
        setState(data.state);
        showNotification("success", data.message);
        // Sync manual values
        setManualUsd(data.state.current.usd.toString());
        setManualEur(data.state.current.eur.toString());
        setManualCny(data.state.current.cny.toString());
        setManualTry(data.state.current.try.toString());
        setManualRub(data.state.current.rub.toString());
        setManualDateText(data.state.current.dateText);
      }
    } catch (err: any) {
      showNotification("error", "Error al simular la variación.");
    } finally {
      setActionLoading(null);
    }
  };

  // Manual Update Submit
  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const usdVal = parseFloat(manualUsd);
    const eurVal = parseFloat(manualEur);
    const cnyVal = parseFloat(manualCny);
    const tryVal = parseFloat(manualTry);
    const rubVal = parseFloat(manualRub);

    if (isNaN(usdVal) || usdVal <= 0) {
      showNotification("error", "La tasa de USD debe ser un número positivo válido.");
      return;
    }

    setActionLoading("manual");
    try {
      const res = await fetch("/api/rates/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usd: usdVal,
          eur: isNaN(eurVal) ? undefined : eurVal,
          cny: isNaN(cnyVal) ? undefined : cnyVal,
          tryRate: isNaN(tryVal) ? undefined : tryVal,
          rub: isNaN(rubVal) ? undefined : rubVal,
          dateText: manualDateText.trim() || undefined
        })
      });

      if (!res.ok) throw new Error("Error al guardar la tasa manual.");
      const data = await res.json();
      if (data.success) {
        setState(data.state);
        showNotification("success", data.message);
        setShowManualForm(false);
      }
    } catch (err: any) {
      showNotification("error", "Error al registrar la tasa manual.");
    } finally {
      setActionLoading(null);
    }
  };

  // Reset Server State to default
  const triggerReset = async () => {
    if (!confirm("¿Está seguro de que desea restaurar los valores y el historial predeterminados?")) return;
    setActionLoading("reset");
    try {
      const res = await fetch("/api/rates/reset", { method: "POST" });
      if (!res.ok) throw new Error("Error al reiniciar.");
      const data = await res.json();
      if (data.success) {
        setState(data.state);
        showNotification("info", "Portal restaurado a los valores predeterminados de la captura de pantalla.");
        // Sync manual values
        setManualUsd(data.state.current.usd.toString());
        setManualEur(data.state.current.eur.toString());
        setManualCny(data.state.current.cny.toString());
        setManualTry(data.state.current.try.toString());
        setManualRub(data.state.current.rub.toString());
        setManualDateText(data.state.current.dateText);
        setShowManualForm(false);
      }
    } catch (err: any) {
      showNotification("error", "Error al restaurar el portal.");
    } finally {
      setActionLoading(null);
    }
  };

  // Format Helper for rates (shows 2 decimals as requested)
  const formatDecimals = (val: number): string => {
    return val.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper to calculate percentage change between current USD and a historical USD
  const getPercentageChange = (currentUsd: number, historicalUsd: number) => {
    const diff = currentUsd - historicalUsd;
    const pct = (diff / historicalUsd) * 100;
    return {
      value: Math.abs(pct).toFixed(2),
      isUp: pct > 0,
      isDown: pct < 0
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans text-slate-100" id="loading-screen">
        <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 bcv-glow-blue animate-pulse">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
            <div className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-emerald-500 rounded-full border-2 border-slate-950 bcv-glow-green animate-ping" />
          </div>
          <div>
            <h2 className="text-2xl font-light tracking-tight text-white font-display">
              Monitor <span className="font-bold text-blue-400">BCV</span>
            </h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest mt-1.5 font-mono">Cargando Terminal...</p>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">Conectando de forma segura con el servicio de tasas oficiales del Banco Central de Venezuela...</p>
          <div className="flex space-x-1.5 justify-center pt-2">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="h-2 w-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="h-2 w-2 bg-blue-300 rounded-full animate-bounce"></div>
          </div>
        </div>
      </div>
    );
  }

  const current = state?.current;
  const history = state?.history || [];

  // Calculate stats for Bento cards
  const lastHistory = history[0];
  const usdDiff = lastHistory && current ? current.usd - lastHistory.usd : 0;
  const usdDiffPct = lastHistory && current ? ((current.usd - lastHistory.usd) / lastHistory.usd) * 100 : 0;
  const isUp = usdDiff > 0;
  const isDown = usdDiff < 0;

  const formatDisplayDate = (dateText: string, updatedAtStr: string): string => {
    const cleanText = (dateText || "").replace("Fecha Valor: ", "").trim();
    if (!cleanText || cleanText.includes("%") || cleanText.length < 5) {
      const date = new Date(updatedAtStr);
      const formatted = date.toLocaleDateString("es-VE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    return cleanText;
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans selection:bg-blue-500/30 selection:text-white" id="app-root">
      


      {/* Main Content Bento Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 lg:p-12 space-y-8" id="main-content">
        
        {/* Alerts / Notifications Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-4 rounded-2xl border flex items-start space-x-3.5 shadow-xl backdrop-blur-md ${
                notification.type === "success" 
                  ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-200" 
                  : notification.type === "warning"
                  ? "bg-amber-950/40 border-amber-500/20 text-amber-200"
                  : notification.type === "error"
                  ? "bg-rose-950/40 border-rose-500/20 text-rose-200"
                  : "bg-blue-950/40 border-blue-500/20 text-blue-200"
              }`}
              id="notification-toast"
            >
              <div className="mt-0.5">
                {notification.type === "success" && <Check className="h-5 w-5 text-emerald-400 shrink-0" />}
                {notification.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />}
                {notification.type === "error" && <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />}
                {notification.type === "info" && <Info className="h-5 w-5 text-blue-400 shrink-0" />}
              </div>
              
              <div className="flex-1">
                <p className="text-xs md:text-sm font-medium leading-relaxed">{notification.text}</p>
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Premium Unified Monitor Console */}
        <div 
          className="max-w-5xl mx-auto bg-slate-950/40 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-slate-700/50" 
          id="unified-monitor-card"
        >
          {/* Top Panel Accent / Status Header */}
          <div className="border-b border-slate-900 bg-slate-950/80 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase font-sans">
                Sistema de Referencia Cambiaria
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 font-mono">
              <span>BCV OFICIAL</span>
              <span>•</span>
              <span>ACTUALIZACIÓN CONTINUA</span>
            </div>
          </div>

          {/* Core Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-900">
            
            {/* Left Section: Primary Rates Screen (Col 7) */}
            <div className="lg:col-span-7 p-6 md:p-10 flex flex-col justify-between space-y-8" id="primary-rate-screen">
              
              <div className="flex justify-between items-center gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                    Tasa de Cambio Oficial
                  </span>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Dólar Estadounidense
                  </h1>
                </div>

                {/* Actualizar Button */}
                <button
                  onClick={triggerScrape}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-950/40 transition-all cursor-pointer disabled:cursor-not-allowed select-none shrink-0"
                  id="btn-sync-bcv"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${actionLoading === "scrape" ? "animate-spin" : ""}`} />
                  <span>{actionLoading === "scrape" ? "Actualizando..." : "Actualizar"}</span>
                </button>
              </div>

              {/* Central Value Block */}
              <div className="py-2">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-6xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter select-all font-mono">
                    {current ? formatDecimals(current.usd) : "---"}
                  </span>
                  <span className="text-xl sm:text-2xl font-semibold text-slate-500">
                    Bs/USD
                  </span>
                </div>

                {/* Amount / Change indicator */}
                {usdDiff !== 0 && (
                  <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm font-medium">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                      isUp ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{formatDecimals(usdDiff)} Bs
                    </span>
                    <span className="text-slate-400">
                      respecto a la tasa anterior de {lastHistory ? formatDecimals(lastHistory.usd) : "---"} Bs
                    </span>
                  </div>
                )}
              </div>

              {/* Real-time schedule / Venezuelan time 4 PM note */}
              <div className="p-4 bg-slate-900/20 border border-slate-900 rounded-2xl flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-200 block mb-0.5">Sincronización en Tiempo Real</span>
                  La tasa oficial se actualiza de <span className="text-blue-400 font-semibold">lunes a viernes a partir de las 4:00 PM (hora de Venezuela)</span>, tan pronto como el Banco Central de Venezuela emita los valores oficiales de cierre de la jornada cambiaria.
                </div>
              </div>

              {/* Meta & Verification Footer */}
              <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                    Fecha Valor Oficial
                  </span>
                  <span className="font-medium text-slate-300 mt-1 block">
                    {current ? `Fecha Valor: ${formatDisplayDate(current.dateText, current.updatedAt)}` : "---"}
                  </span>
                </div>

                {current && (
                  <div className="sm:text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                      Último Registro Local
                    </span>
                    <span className="font-mono text-slate-400 mt-1 block">
                      {new Date(current.updatedAt).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      })} • {new Date(current.updatedAt).toLocaleTimeString("es-VE", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                      })}
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Right Section: Historical Data Feed (Col 5) */}
            <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between bg-slate-950/20" id="historical-data-feed">
              
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Historial de Cierre
                  </h3>
                  <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                    {history.length} Registros
                  </span>
                </div>

                {/* History list feed */}
                <div className="space-y-3" id="history-list">
                  {history.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-600 border border-dashed border-slate-800 rounded-2xl">
                      No hay registros de cierre anteriores.
                    </div>
                  ) : (
                    history.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center justify-between p-3 bg-slate-950/30 rounded-xl border border-slate-900 hover:border-slate-800 transition-all duration-300"
                      >
                        <div>
                          <p className="text-[10px] text-slate-500 font-medium">
                            {formatDisplayDate(item.dateText, item.updatedAt)}
                          </p>
                          <p className="text-xs font-semibold text-slate-300 mt-0.5">
                            Cierre de Jornada
                          </p>
                        </div>
                        <p className="text-sm font-bold text-white font-mono">
                          {formatDecimals(item.usd)} Bs
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Source Link Accent */}
              <div className="mt-8 pt-4 border-t border-slate-900 text-center lg:text-right">
                <span className="text-[9px] text-slate-600 uppercase font-bold tracking-wider block">
                  Fuente Oficial
                </span>
                <a 
                  href="https://www.bcv.org.ve" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[11px] text-blue-400/80 hover:text-blue-400 font-mono transition-colors mt-0.5 inline-block"
                >
                  bcv.org.ve
                </a>
              </div>

            </div>

          </div>
        </div>

      </main>

      {/* Footer Section */}
      <footer className="py-8 px-6 text-center text-slate-600 text-[10px] font-mono tracking-wider" id="main-footer">
        <div className="max-w-5xl mx-auto">
          <p>© 2026 MONITOR REFERENCIAL • DATOS PROCESADOS DIRECTAMENTE DE LA BANCA CENTRAL</p>
        </div>
      </footer>

    </div>
  );
}

