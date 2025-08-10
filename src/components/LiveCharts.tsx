import React from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Legend,
  Area,
} from "recharts";

export type LivePoint = {
  t: number;
  spm?: number;
  // alturas (px relativos)
  left_hand?: number;
  right_hand?: number;
  head?: number;
  hip?: number;
  // ángulos (grados)
  rotation?: number;
  left_axilla?: number;
  right_axilla?: number;
  // compatibilidad
  strokes?: number;
};

interface LiveChartsProps {
  data: LivePoint[];
  images: string[];
}

const LiveCharts: React.FC<LiveChartsProps> = ({ data, images }) => {
  const hasCharts = (data && data.length > 0) || (images && images.length > 0);

  return (
    <div className="space-y-6">
      {data && data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">SPM en tiempo real</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 12 }} label={{ value: "t (s)", position: "insideBottomRight", offset: -5 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <ReTooltip />
                <Legend />
                <Line dot={false} type="monotone" dataKey="spm" stroke="hsl(var(--primary))" name="SPM" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {data && data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Alturas de landmarks (manos, cabeza, cadera)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 12 }} label={{ value: "t (s)", position: "insideBottomRight", offset: -5 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <ReTooltip />
                <Legend />
                <Line dot={false} type="monotone" dataKey="left_hand" stroke="hsl(var(--primary))" name="Mano Izquierda (altura)" />
                <Line dot={false} type="monotone" dataKey="right_hand" stroke="hsl(var(--secondary))" name="Mano Derecha (altura)" />
                <Line dot={false} type="monotone" dataKey="head" stroke="hsl(var(--accent))" name="Cabeza (altura)" />
                <Line dot={false} type="monotone" dataKey="hip" stroke="hsl(var(--muted-foreground))" name="Cadera (altura)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {data && data.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Ángulos de rotación y axila</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 12 }} label={{ value: "t (s)", position: "insideBottomRight", offset: -5 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <ReTooltip />
                <Legend />
                <Area type="monotone" dataKey="left_axilla" stackId="ax" stroke="hsl(var(--secondary))" fill="hsl(var(--secondary) / 0.3)" name="Axila Izq (área)" />
                <Area type="monotone" dataKey="right_axilla" stackId="ax" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.3)" name="Axila Der (área)" />
                <Line dot={false} type="monotone" dataKey="rotation" stroke="hsl(var(--primary))" name="Rotación" />
                <Line dot={false} type="monotone" dataKey="left_axilla" stroke="hsl(var(--secondary))" name="Axila Izq" />
                <Line dot={false} type="monotone" dataKey="right_axilla" stroke="hsl(var(--muted-foreground))" name="Axila Der" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {images && images.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Gráficas generadas (backend)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.map((src, i) => (
              <img key={i} src={src} alt={`gráfica biomecánica ${i + 1}`} loading="lazy" className="w-full rounded border" />
            ))}
          </div>
        </section>
      )}

      {!hasCharts && (
        <p className="text-sm text-muted-foreground">No hay datos para graficar todavía.</p>
      )}
    </div>
  );
};

export default LiveCharts;
