import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { API_BASE } from "@/config";
import { uploadVideo, startJob } from "@/services/api";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

  // Live streaming state
  const wsRef = useRef<WebSocket | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [liveFrame, setLiveFrame] = useState<string | null>(null);
  const [liveTexts, setLiveTexts] = useState<string[]>([]);
  const [liveSPM, setLiveSPM] = useState<number>(0);
  const [liveStrokes, setLiveStrokes] = useState<number>(0);
  const [liveProgress, setLiveProgress] = useState<number>(0);

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
              break;
            case "text":
              if (msg.text) setLiveTexts((prev) => [...prev, msg.text]);
              break;
            case "charts":
              if (Array.isArray(msg.urls)) {
                setChartImages(msg.urls.map((u: string) => absolutize(u)));
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
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Análisis biomecánico de canotaje</h1>
          <p className="text-muted-foreground mt-1">
            Carga un video y visualiza resultados frame a frame, con textos del coach generados en tiempo real.
          </p>
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
            <TabsTrigger value="graficas" disabled={!metrics && chartImages.length === 0}>Gráficas</TabsTrigger>
          </TabsList>

          <TabsContent value="procesamiento" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Procesamiento en tiempo real</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div>Estado: {isLoading ? "Procesando" : processedUrl ? "Completado" : "Listo"}</div>
                  <div>Progreso: {(liveProgress * 100).toFixed(0)}%</div>
                  <div>Strokes: {liveStrokes} | SPM: {liveSPM}</div>
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
                <CardTitle>Evolución de métricas</CardTitle>
              </CardHeader>
              <CardContent>
                {(chartImages.length > 0 || metrics) ? (
                  <div className="space-y-6">
                    {chartImages.length > 0 && (
                      <section>
                        <h2 className="text-lg font-semibold">Gráficas generadas</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {chartImages.map((src, i) => (
                            <img key={i} src={src} alt={`gráfica biomecánica ${i + 1}`} loading="lazy" className="w-full rounded border" />
                          ))}
                        </div>
                      </section>
                    )}
                    {metrics && (
                      <section>
                        <h2 className="text-lg font-semibold">Ritmo y ciclo</h2>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="t" tick={{ fontSize: 12 }} label={{ value: "t (s)", position: "insideBottomRight", offset: -5 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <ReTooltip />
                              <Legend />
                              <Line dot={false} type="monotone" dataKey="stroke_rate" stroke="hsl(var(--primary))" name="SPM" />
                              <Line dot={false} type="monotone" dataKey="cycle_time" stroke="hsl(var(--muted-foreground))" name="Tiempo de ciclo" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </section>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay datos para graficar todavía.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">
          <span>Backend esperado en: {API_BASE}</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
