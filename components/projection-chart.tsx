"use client";

import { useMemo, useState } from "react";
import type { ProjectionPoint } from "@/lib/projections";

type ValueView = "both" | "nominal" | "real";
type YScale = "log" | "linear";

type ProjectionChartProps = {
  points: ProjectionPoint[];
  valueView: ValueView;
  yScale: YScale;
  modelVisibility: {
    fixed: boolean;
    cagr: boolean;
    s2f: boolean;
    powerLaw: boolean;
    monteCarlo: boolean;
    halving: boolean;
  };
};

const W = 1000;
const H = 440;
const PAD = { top: 24, right: 20, bottom: 36, left: 64 };

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const compactUsd = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const toPath = (pts: Array<{ x: number; y: number }>) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

const bandPath = (top: Array<{ x: number; y: number }>, bottom: Array<{ x: number; y: number }>) =>
  `${toPath(top)} ${bottom
    .slice()
    .reverse()
    .map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ")} Z`;

export function ProjectionChart({ points, valueView, yScale, modelVisibility }: ProjectionChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverLegendTone, setHoverLegendTone] = useState<string | null>(null);

  const xMin = 0;
  const xMax = Math.max(...points.map((p) => p.year));

  const visibleValues = useMemo(() => {
    const values: number[] = [];
    for (const p of points) {
      if (valueView === "both" || valueView === "nominal") {
        if (modelVisibility.fixed) {
          values.push(p.fixedNominal);
        }
        if (modelVisibility.cagr) {
          values.push(p.cagrBaseNominal, p.cagrLowNominal, p.cagrHighNominal);
        }
        if (modelVisibility.s2f) {
          values.push(p.s2fNominal);
        }
        if (modelVisibility.powerLaw) {
          values.push(p.powerLawNominal);
        }
        if (modelVisibility.halving) {
          values.push(p.halvingNominal);
        }
        if (modelVisibility.monteCarlo) {
          values.push(p.mcP10Nominal, p.mcP50Nominal, p.mcP90Nominal);
        }
      }
      if (valueView === "both" || valueView === "real") {
        if (modelVisibility.fixed) {
          values.push(p.fixedReal);
        }
        if (modelVisibility.cagr) {
          values.push(p.cagrBaseReal, p.cagrLowReal, p.cagrHighReal);
        }
        if (modelVisibility.s2f) {
          values.push(p.s2fReal);
        }
        if (modelVisibility.powerLaw) {
          values.push(p.powerLawReal);
        }
        if (modelVisibility.halving) {
          values.push(p.halvingReal);
        }
        if (modelVisibility.monteCarlo) {
          values.push(p.mcP10Real, p.mcP50Real, p.mcP90Real);
        }
      }
    }
    return values.filter((v) => Number.isFinite(v) && v > 0);
  }, [points, valueView, modelVisibility]);

  const yMinRaw = visibleValues.length ? Math.min(...visibleValues) : 1;
  const yMaxRaw = visibleValues.length ? Math.max(...visibleValues) : 10;
  const yMin = yScale === "log" ? Math.max(1, yMinRaw * 0.9) : Math.max(0, yMinRaw * 0.9);
  const yMax = yMaxRaw * 1.1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const xToPx = (x: number) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const yToPx = (y: number) => {
    const safeY = yScale === "log" ? Math.max(1, y) : y;
    if (yScale === "log") {
      const lo = Math.log10(yMin);
      const hi = Math.log10(yMax);
      const v = Math.log10(safeY);
      return PAD.top + (1 - (v - lo) / (hi - lo || 1)) * plotH;
    }
    return PAD.top + (1 - (safeY - yMin) / (yMax - yMin || 1)) * plotH;
  };

  const fixedNominalPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.fixedNominal) }));
  const cagrBaseNominalPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.cagrBaseNominal) }));
  const s2fNominalPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.s2fNominal) }));
  const powerNominalPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.powerLawNominal) }));
  const halvingNominalPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.halvingNominal) }));
  const mcMedianNominalPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.mcP50Nominal) }));

  const fixedRealPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.fixedReal) }));
  const cagrBaseRealPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.cagrBaseReal) }));
  const s2fRealPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.s2fReal) }));
  const powerRealPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.powerLawReal) }));
  const halvingRealPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.halvingReal) }));
  const mcMedianRealPts = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.mcP50Real) }));

  const cagrNominalTop = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.cagrHighNominal) }));
  const cagrNominalBottom = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.cagrLowNominal) }));
  const mcNominalTop = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.mcP90Nominal) }));
  const mcNominalBottom = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.mcP10Nominal) }));

  const cagrRealTop = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.cagrHighReal) }));
  const cagrRealBottom = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.cagrLowReal) }));
  const mcRealTop = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.mcP90Real) }));
  const mcRealBottom = points.map((p) => ({ x: xToPx(p.year), y: yToPx(p.mcP10Real) }));

  const yTicks = (() => {
    if (yScale === "log") {
      const lo = Math.floor(Math.log10(yMin));
      const hi = Math.ceil(Math.log10(yMax));
      return Array.from({ length: hi - lo + 1 }, (_, i) => Math.pow(10, lo + i));
    }
    return Array.from({ length: 6 }, (_, i) => yMin + ((yMax - yMin) * i) / 5);
  })();

  const xTicks = Array.from({ length: 11 }, (_, i) => Math.round((xMax * i) / 10));

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const toneOpacity = (tone: string) =>
    hoverLegendTone === null || hoverLegendTone === tone ? 1 : 0.16;
  const toneStrokeWidth = (tone: string, base: number) =>
    hoverLegendTone === tone ? base + 1 : base;
  const legendItems = [
    ...(valueView === "both" || valueView === "nominal"
      ? [
          ...(modelVisibility.cagr
            ? [{ label: "CAGR nominal band", tone: "bandCagrNominal" as const }]
            : []),
          ...(modelVisibility.monteCarlo
            ? [{ label: "MC nominal band (p10-p90)", tone: "bandMcNominal" as const }]
            : []),
          ...(modelVisibility.fixed
            ? [{ label: "Fixed annual (nominal)", tone: "fixedNominal" as const }]
            : []),
          ...(modelVisibility.cagr
            ? [{ label: "CAGR base (nominal)", tone: "cagrNominal" as const }]
            : []),
          ...(modelVisibility.s2f
            ? [{ label: "S2F style (nominal)", tone: "s2fNominal" as const }]
            : []),
          ...(modelVisibility.powerLaw
            ? [{ label: "Power-law (nominal)", tone: "powerNominal" as const }]
            : []),
          ...(modelVisibility.halving
            ? [{ label: "Halving-cycle (nominal)", tone: "halvingNominal" as const }]
            : []),
          ...(modelVisibility.monteCarlo
            ? [{ label: "Monte Carlo median (nominal)", tone: "mcMedianNominal" as const }]
            : [])
        ]
      : []),
    ...(valueView === "both" || valueView === "real"
      ? [
          ...(modelVisibility.cagr
            ? [{ label: "CAGR real band", tone: "bandCagrReal" as const }]
            : []),
          ...(modelVisibility.monteCarlo
            ? [{ label: "MC real band (p10-p90)", tone: "bandMcReal" as const }]
            : []),
          ...(modelVisibility.fixed
            ? [{ label: "Fixed annual (real)", tone: "fixedReal" as const }]
            : []),
          ...(modelVisibility.cagr
            ? [{ label: "CAGR base (real)", tone: "cagrReal" as const }]
            : []),
          ...(modelVisibility.s2f
            ? [{ label: "S2F style (real)", tone: "s2fReal" as const }]
            : []),
          ...(modelVisibility.powerLaw
            ? [{ label: "Power-law (real)", tone: "powerReal" as const }]
            : []),
          ...(modelVisibility.halving
            ? [{ label: "Halving-cycle (real)", tone: "halvingReal" as const }]
            : []),
          ...(modelVisibility.monteCarlo
            ? [{ label: "Monte Carlo median (real)", tone: "mcMedianReal" as const }]
            : [])
        ]
      : [])
  ];

  return (
    <div className="svg-chart-wrap">
      <div
        className="svg-chart-canvas"
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const el = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - el.left;
          const normalizedX = (x / el.width) * W;
          const year = ((normalizedX - PAD.left) / plotW) * xMax;
          const idx = Math.max(0, Math.min(points.length - 1, Math.round(year)));
          setHoverIndex(idx);
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          role="img"
          aria-label="Projection chart"
        >
        <defs>
          <linearGradient id="bandCagrNominal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-fixed-nominal)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--chart-fixed-nominal)" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="bandMcNominal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-mc-nominal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-mc-nominal)" stopOpacity="0.07" />
          </linearGradient>
          <linearGradient id="bandCagrReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-fixed-real)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--chart-fixed-real)" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="bandMcReal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-mc-real)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--chart-mc-real)" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="rgba(3,8,28,0.52)" />

        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={PAD.left}
              y1={yToPx(v)}
              x2={W - PAD.right}
              y2={yToPx(v)}
              stroke="rgba(255,255,255,0.13)"
              strokeDasharray="2 4"
            />
            <text x={10} y={yToPx(v) + 4} fill="#cfe9ff" fontSize="12">
              {compactUsd(v)}
            </text>
          </g>
        ))}

        {xTicks.map((v) => (
          <g key={`x-${v}`}>
            <line
              x1={xToPx(v)}
              y1={PAD.top}
              x2={xToPx(v)}
              y2={H - PAD.bottom}
              stroke="rgba(255,255,255,0.13)"
              strokeDasharray="2 4"
            />
            <text x={xToPx(v)} y={H - 10} textAnchor="middle" fill="#cfe9ff" fontSize="12">
              {v}
            </text>
          </g>
        ))}

        {(valueView === "both" || valueView === "nominal") && (
          <>
            {modelVisibility.cagr && (
              <path
                d={bandPath(cagrNominalTop, cagrNominalBottom)}
                fill="url(#bandCagrNominal)"
                opacity={toneOpacity("bandCagrNominal")}
              />
            )}
            {modelVisibility.monteCarlo && (
              <path
                d={bandPath(mcNominalTop, mcNominalBottom)}
                fill="url(#bandMcNominal)"
                opacity={toneOpacity("bandMcNominal")}
              />
            )}
            {modelVisibility.fixed && (
              <path
                d={toPath(fixedNominalPts)}
                fill="none"
                stroke="var(--chart-fixed-nominal)"
                strokeWidth={toneStrokeWidth("fixedNominal", 3)}
                opacity={toneOpacity("fixedNominal")}
              />
            )}
            {modelVisibility.cagr && (
              <path
                d={toPath(cagrBaseNominalPts)}
                fill="none"
                stroke="var(--chart-cagr-nominal)"
                strokeWidth={toneStrokeWidth("cagrNominal", 2.5)}
                opacity={toneOpacity("cagrNominal")}
              />
            )}
            {modelVisibility.s2f && (
              <path
                d={toPath(s2fNominalPts)}
                fill="none"
                stroke="var(--chart-s2f-nominal)"
                strokeWidth={toneStrokeWidth("s2fNominal", 2.2)}
                opacity={toneOpacity("s2fNominal")}
              />
            )}
            {modelVisibility.powerLaw && (
              <path
                d={toPath(powerNominalPts)}
                fill="none"
                stroke="var(--chart-power-nominal)"
                strokeWidth={toneStrokeWidth("powerNominal", 2.2)}
                opacity={toneOpacity("powerNominal")}
              />
            )}
            {modelVisibility.halving && (
              <path
                d={toPath(halvingNominalPts)}
                fill="none"
                stroke="var(--chart-halving-nominal)"
                strokeWidth={toneStrokeWidth("halvingNominal", 2.2)}
                opacity={toneOpacity("halvingNominal")}
              />
            )}
            {modelVisibility.monteCarlo && (
              <path
                d={toPath(mcMedianNominalPts)}
                fill="none"
                stroke="var(--chart-mc-nominal)"
                strokeWidth={toneStrokeWidth("mcMedianNominal", 2.2)}
                opacity={toneOpacity("mcMedianNominal")}
              />
            )}
          </>
        )}

        {(valueView === "both" || valueView === "real") && (
          <>
            {modelVisibility.cagr && (
              <path
                d={bandPath(cagrRealTop, cagrRealBottom)}
                fill="url(#bandCagrReal)"
                opacity={toneOpacity("bandCagrReal")}
              />
            )}
            {modelVisibility.monteCarlo && (
              <path
                d={bandPath(mcRealTop, mcRealBottom)}
                fill="url(#bandMcReal)"
                opacity={toneOpacity("bandMcReal")}
              />
            )}
            {modelVisibility.fixed && (
              <path
                d={toPath(fixedRealPts)}
                fill="none"
                stroke="var(--chart-fixed-real)"
                strokeWidth={toneStrokeWidth("fixedReal", 2)}
                strokeDasharray="8 6"
                opacity={toneOpacity("fixedReal")}
              />
            )}
            {modelVisibility.cagr && (
              <path
                d={toPath(cagrBaseRealPts)}
                fill="none"
                stroke="var(--chart-cagr-real)"
                strokeWidth={toneStrokeWidth("cagrReal", 2)}
                strokeDasharray="8 6"
                opacity={toneOpacity("cagrReal")}
              />
            )}
            {modelVisibility.s2f && (
              <path
                d={toPath(s2fRealPts)}
                fill="none"
                stroke="var(--chart-s2f-real)"
                strokeWidth={toneStrokeWidth("s2fReal", 1.8)}
                strokeDasharray="8 6"
                opacity={toneOpacity("s2fReal")}
              />
            )}
            {modelVisibility.powerLaw && (
              <path
                d={toPath(powerRealPts)}
                fill="none"
                stroke="var(--chart-power-real)"
                strokeWidth={toneStrokeWidth("powerReal", 1.8)}
                strokeDasharray="8 6"
                opacity={toneOpacity("powerReal")}
              />
            )}
            {modelVisibility.halving && (
              <path
                d={toPath(halvingRealPts)}
                fill="none"
                stroke="var(--chart-halving-real)"
                strokeWidth={toneStrokeWidth("halvingReal", 1.8)}
                strokeDasharray="8 6"
                opacity={toneOpacity("halvingReal")}
              />
            )}
            {modelVisibility.monteCarlo && (
              <path
                d={toPath(mcMedianRealPts)}
                fill="none"
                stroke="var(--chart-mc-real)"
                strokeWidth={toneStrokeWidth("mcMedianReal", 1.8)}
                strokeDasharray="8 6"
                opacity={toneOpacity("mcMedianReal")}
              />
            )}
          </>
        )}

        {hoverPoint && (
          <line
            x1={xToPx(hoverPoint.year)}
            y1={PAD.top}
            x2={xToPx(hoverPoint.year)}
            y2={H - PAD.bottom}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="1"
          />
        )}
        </svg>

        {hoverPoint && (
          <div className="chart-tooltip">
            <strong>Year {hoverPoint.year}</strong>
            <div>Fixed: {fmtUsd(hoverPoint.fixedNominal)} (real {fmtUsd(hoverPoint.fixedReal)})</div>
            <div>CAGR base: {fmtUsd(hoverPoint.cagrBaseNominal)} (real {fmtUsd(hoverPoint.cagrBaseReal)})</div>
            <div>S2F style: {fmtUsd(hoverPoint.s2fNominal)} (real {fmtUsd(hoverPoint.s2fReal)})</div>
            <div>Power-law: {fmtUsd(hoverPoint.powerLawNominal)} (real {fmtUsd(hoverPoint.powerLawReal)})</div>
            <div>Halving-cycle: {fmtUsd(hoverPoint.halvingNominal)} (real {fmtUsd(hoverPoint.halvingReal)})</div>
            <div>MC p50: {fmtUsd(hoverPoint.mcP50Nominal)} (real {fmtUsd(hoverPoint.mcP50Real)})</div>
            <div>
              MC p10-p90: {fmtUsd(hoverPoint.mcP10Nominal)} - {fmtUsd(hoverPoint.mcP90Nominal)}
            </div>
          </div>
        )}
      </div>

      <div className="chart-legend" aria-label="Chart legend">
        {legendItems.map((item) => (
          <div
            key={item.label}
            className={`chart-legend-item ${hoverLegendTone === item.tone ? "active" : ""}`}
            onMouseEnter={() => setHoverLegendTone(item.tone)}
            onMouseLeave={() => setHoverLegendTone(null)}
          >
            <span className={`legend-swatch legend-${item.tone}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
