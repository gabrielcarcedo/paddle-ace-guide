import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { API_BASE } from "@/config";
import { startJob } from "@/services/api";
import LiveCharts from "@/components/LiveCharts";
import { generateCoachNote } from "@/services/hf";

interface Metrics {
  stroke_rate?: number[];
  cycle_time?: number[];
  phase_aerial_time?: number[];
  phase_water_time?: number[];
  angles?: {
    left_knee?: number[];
    right_knee?: number[];
    left_elbow?: number[];
    right_elbow?: number[];
    left_axilla?: number[];
    right_axilla?: number[];
    rotation?: number[];
  };
  phases?: string[];
  timestamps?: number[];
}

interface ProcessResponse {
  processed_video_url: string;
  metrics: Metrics;
  coach_text: string;
  tts_audio_url?: string;
  job_id?: string;
  status?: string;
}

const Index: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [coachText, setCoachText] = useState<string>("");
  const [ttsUrl, setTtsUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [chartImages, setChartImages] = useState<string[]>([]);

  const [hfKey, setHfKey] = useState<string>(() => localStorage.getItem("hf_api_key") || "");
  const genRef = useRef<{ last: number; running: boolean }>({ last: 0, running: false });

  // Live streaming state
  const wsRef = useRef<WebSocket | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [liveTexts, setLiveTexts] = useState<string[]>([]);
  const [liveSPM, setLiveSPM] = useState<number>(0);
  const [liveStrokes, setLiveStrokes] = useState<number>(0);
  const [liveProgress, setLiveProgress] = useState<number>(0);
  const [liveSeries, setLiveSeries] = useState<
    {
      t: number;
      spm?: number;
      // alturas
      left_hand?: number;
      right_hand?: number;
      head?: number;
      hip?: number;
      // ángulos
      rotation?: number;
      left_axilla?: number;
      right_axilla?: number;
      // compat
      strokes?: number;
    }[]
  >([]);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = "Análisis biomecánico de canotaje | Paddle Wise Coach";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Procesa tu video y recibe análisis y feedback tipo coach en tiempo real.");
    const existing = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    const canonical = existing || (() => { const l = document.createElement('link'); l.setAttribute('rel','canonical'); document.head.appendChild(l); return l; })();
    canonical.setAttribute('href', window.location.origin + '/');
  }, []);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
    };
  }, [originalUrl]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setProcessedUrl(null);
    setMetrics(null);
    setCoachText("");
    setTtsUrl(null);
    setLiveFrame(null);
    setLiveTexts([]);
    setChartImages([]);
    if (f) setOriginalUrl(URL.createObjectURL(f));
  };

  const handleStartLive = async () => {
    if (!file) {
      toast.error("Selecciona un video primero.");
      return;
    }
    setIsLoading(true);
    setProcessedUrl(null);
    setMetrics(null);
    setCoachText("");
    setTtsUrl(null);
    setChartImages([]);
    try {
      const data = await startJob(file);
      setJobId(data.job_id);
      setOriginalUrl(absolutize(data.original_url));

      const wsUrl = API_BASE.replace("http", "ws").replace(/\/$/, "") + `/ws/process?job_id=${data.job_id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setLiveFrame(null);
      setLiveTexts([]);
      setLiveSPM(0);
      setLiveStrokes(0);
      setLiveProgress(0);
      startRef.current = Date.now();
      setLiveSeries([]);

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          switch (msg.type) {
            case "frame":
              if (msg.jpg) setLiveFrame(`data:image/jpeg;base64,${msg.jpg}`);
              if (typeof msg.progress === "number") setLiveProgress(msg.progress);
              break;
            case "metric":
              if (typeof msg.spm === "number") setLiveSPM(msg.spm);
              if (typeof msg.strokes === "number") setLiveStrokes(msg.strokes);
              setLiveSeries((prev) => {
                const last = (prev[prev.length - 1] ?? {}) as any;
                const t0 = startRef.current ?? Date.now();
                const t = (Date.now() - t0) / 1000;
                return [
                  ...prev,
                  {
                    t,
                    spm:
                      typeof msg.spm === "number"
                        ? msg.spm
                        : typeof msg.stroke_rate === "number"
                        ? msg.stroke_rate
                        : last?.spm,
                    left_hand:
                      typeof msg.left_hand === "number"
                        ? msg.left_hand
                        : typeof msg.list_mun_izq === "number"
                        ? msg.list_mun_izq
                        : last?.left_hand,
                    right_hand:
                      typeof msg.right_hand === "number"
                        ? msg.right_hand
                        : typeof msg.list_mun_der === "number"
                        ? msg.list_mun_der
                        : last?.right_hand,
                    head:
                      typeof msg.head === "number"
                        ? msg.head
                        : typeof msg.list_head_alt === "number"
                        ? msg.list_head_alt
                        : last?.head,
                    hip:
                      typeof msg.hip === "number"
                        ? msg.hip
                        : typeof msg.list_hip === "number"
                        ? msg.list_hip
                        : last?.hip,
                    rotation:
                      typeof msg.rotation === "number"
                        ? msg.rotation
                        : last?.rotation,
                    left_axilla:
                      typeof msg.left_axilla === "number"
                        ? msg.left_axilla
                        : typeof msg.list_angle_axi_izq === "number"
                        ? msg.list_angle_axi_izq
                        : last?.left_axilla,
                    right_axilla:
                      typeof msg.right_axilla === "number"
                        ? msg.right_axilla
                        : typeof msg.list_angle_axi_der === "number"
                        ? msg.list_angle_axi_der
                        : last?.right_axilla,
                    strokes:
                      typeof msg.strokes === "number" ? msg.strokes : last?.strokes,
                  },
                ];
              });
              break;
            case "text":
              if (msg.text) setLiveTexts((prev) => [...prev, msg.text]);
              break;
            case "charts":
              if (Array.isArray(msg.urls)) {
                setChartImages(msg.urls.map((u: string) => absolutize(u)));
              } else if (msg.images && typeof msg.images === "object") {
                setChartImages(Object.values(msg.images).map((u: string) => absolutize(u)));
              }
              break;
            case "complete":
              if (msg.processed_video_url) setProcessedUrl(absolutize(msg.processed_video_url));
              toast.success("Procesamiento finalizado");
              setIsLoading(false);
              ws.close();
              break;
            case "error":
              toast.error(msg.message || "Error en streaming");
              setIsLoading(false);
              ws.close();
              break;
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onerror = () => {
        toast.error("WebSocket error");
        setIsLoading(false);
      };
    } catch (e: any) {
      console.error(e);
      toast.error("No se pudo iniciar el procesamiento");
      setIsLoading(false);
    }
  };

  // Generación periódica de notas del coach via LLM (si hay API key)
  useEffect(() => {
    if (!isLoading || !hfKey) return;
    if (!liveSeries.length) return;
    const now = Date.now();
    if (genRef.current.running || now - genRef.current.last < 6000) return;

    const recent = liveSeries.slice(-15);
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const spmAvg = avg(recent.map((r) => r.spm || 0));

    genRef.current.running = true;
    generateCoachNote(hfKey, { spm: spmAvg || liveSPM, strokes: liveStrokes, notesSoFar: liveTexts.slice(-5) })
      .then((text) => {
        if (text) setLiveTexts((prev) => [...prev, `Coach (LLM): ${text}`]);
      })
      .catch((err) => console.error("LLM error", err))
      .finally(() => {
        genRef.current.running = false;
        genRef.current.last = Date.now();
      });
  }, [liveSeries.length, liveSPM, liveStrokes, isLoading, hfKey]);

  const absolutize = (url: string) => {
    if (!url) return url;
    if (url.startsWith("http")) return url;
    return `${API_BASE.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const chartData = useMemo(() => {
    if (!metrics) return [] as any[];
    const len =
      metrics.timestamps?.length ||
      metrics.stroke_rate?.length ||
      metrics.angles?.left_knee?.length ||
      0;
    return Array.from({ length: len }, (_, i) => ({
      t: metrics.timestamps?.[i] ?? i,
      stroke_rate: metrics.stroke_rate?.[i],
      cycle_time: metrics.cycle_time?.[i],
      left_knee: metrics.angles?.left_knee?.[i],
      right_knee: metrics.angles?.right_knee?.[i],
      left_elbow: metrics.angles?.left_elbow?.[i],
      right_elbow: metrics.angles?.right_elbow?.[i],
      rotation: metrics.angles?.rotation?.[i],
    }));
  }, [metrics]);

  return (
    <div>
      <header className="border-b">
        <div className="container mx-auto px-4 py-6 space-y-4">
          <img
            src="/placeholder.svg"
            alt="Banner principal Paddle Wise Coach"
            className="w-full h-40 md:h-56 object-cover rounded-md border"
            loading="eager"
          />
          <div className="flex justify-center">
            <img
              src="/favicon.ico"
              alt="Logo Paddle Wise Coach"
              className="h-16 w-16 object-contain"
              loading="lazy"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análisis biomecánico de canotaje</h1>
            <p className="text-muted-foreground mt-1">
              Carga un video y visualiza resultados frame a frame, con textos del coach generados en tiempo real.
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Subir video</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input type="file" accept="video/*" onChange={onFileChange} />
            <div className="flex items-center gap-3">
              <Button onClick={handleStartLive} disabled={!file || isLoading}>
                {isLoading ? "Procesando..." : "Procesar video"}
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground">
                  Archivo: {file.name} ({Math.round(file.size / (1024 * 1024))} MB)
                </span>
              )}
            </div>

          </CardContent>
        </Card>

         <Tabs defaultValue="procesamiento" className="w-full">
          <TabsList>
            <TabsTrigger value="procesamiento">Procesamiento</TabsTrigger>
            <TabsTrigger value="graficas">Gráficas</TabsTrigger>
          </TabsList>

          <TabsContent value="procesamiento" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Procesamiento en tiempo real</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div>Estado: {isLoading ? "Procesando" : processedUrl ? "Completado" : "Listo"}</div>
                  <div>Strokes: {liveStrokes} | SPM: {liveSPM}</div>
                </div>
                <div>
                  <Progress value={liveProgress * 100} className="h-3" aria-label="Progreso de procesamiento" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Frame actual</h3>
                    {liveFrame ? (
                      <img src={liveFrame} alt="frame en vivo con analítica superpuesta" className="w-full rounded" />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isLoading ? "Esperando frames..." : "Aún no hay frames. Pulsa 'Procesar video'."}
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Notas del coach (incremental)</h3>
                    <div className="h-64 overflow-auto border rounded p-3 text-sm space-y-2">
                      {liveTexts.length ? (
                        liveTexts.map((t, i) => <p key={i}>{t}</p>)
                      ) : (
                        <p className="text-muted-foreground">{isLoading ? "Generando notas..." : "Aún no hay notas."}</p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sección de video final procesado ocultada temporalmente */}
                {null}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="graficas">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard de gráficas</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveCharts data={liveSeries} images={chartImages} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground text-center">
          <span>AiSA 2025 ABModel</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
