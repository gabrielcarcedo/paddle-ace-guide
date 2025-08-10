import React, { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
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
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const slides = (images || []).map((src, i) => ({ src, alt: `gráfica biomecánica ${i + 1}` }));
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



      {images && images.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Gráficas generadas (backend)</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {images.slice(0, 2).map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`gráfica biomecánica ${i + 1}`}
                  loading="lazy"
                  className="w-full rounded border cursor-zoom-in"
                  onClick={() => {
                    setIndex(i);
                    setOpen(true);
                  }}
                />
              ))}
            </div>
            {images.slice(2).map((src, i) => (
              <img
                key={i + 2}
                src={src}
                alt={`gráfica biomecánica ${i + 3}`}
                loading="lazy"
                className="w-full rounded border cursor-zoom-in"
                onClick={() => {
                  setIndex(i + 2);
                  setOpen(true);
                }}
              />
            ))}
          </div>
          <Lightbox
            open={open}
            close={() => setOpen(false)}
            index={index}
            slides={slides}
            plugins={[Zoom]}
          />
        </section>
      )}

      {!hasCharts && (
        <p className="text-sm text-muted-foreground">No hay datos para graficar todavía.</p>
      )}
    </div>
  );
};

export default LiveCharts;
