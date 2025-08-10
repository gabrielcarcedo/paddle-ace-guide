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
} from "recharts";

export type LivePoint = { t: number; spm?: number; strokes?: number };

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
          <h2 className="text-lg font-semibold">Strokes en el tiempo</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 12 }} label={{ value: "t (s)", position: "insideBottomRight", offset: -5 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <ReTooltip />
                <Legend />
                <Line dot={false} type="monotone" dataKey="strokes" stroke="hsl(var(--muted-foreground))" name="Strokes" />
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
