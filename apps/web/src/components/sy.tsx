"use client";

/**
 * Shared "engineering terminal" design primitives — TSX ports of the design
 * handoff's `components.jsx`, wired to lucide icons and the ported design-system
 * CSS (`app/shipyard.css`). These are presentational building blocks the
 * redesigned pages compose: stat cards, the SVG charts, the filter select,
 * copy button, toggle, and terminal log block.
 *
 * @module
 */

import {
  Check,
  ChevronDown,
  Copy,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";

/* ---------------------------------------------------------------- Sparkline */

/** A tiny inline sparkline (used bottom-right of a {@link StatCard}). */
export function Sparkline({
  data,
  color = "var(--acc)",
  w = 78,
  h = 26,
  fill = true,
}: {
  data: number[];
  color?: string;
  w?: number;
  h?: number;
  fill?: boolean;
}): React.JSX.Element | null {
  // Guard empty/degenerate input: `Math.max(...[])` is `-Infinity`, which would
  // poison every coordinate. A single point can't form a line either.
  const id = React.useId().replace(/:/g, "");
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const rng = max - min || 1;
  const pts: Array<[number, number]> = data.map((v, i) => [
    (i / (data.length - 1 || 1)) * w,
    h - 2 - ((v - min) / rng) * (h - 4),
  ]);
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return (
    <svg
      className="stat-spark"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#${id})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ----------------------------------------------------------------- StatCard */

/** The trend direction of a {@link StatCard} delta chip. */
export type DeltaDir = "up" | "down" | "flat";

/** A single dashboard metric card (label, big value, delta chip, sparkline). */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  iconTone,
  delta,
  sub,
  spark,
  sparkColor = "var(--acc)",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon: LucideIcon;
  iconTone?: "acc" | "green" | "blue";
  delta?: { dir: DeltaDir; text: string };
  sub?: string;
  spark?: number[];
  sparkColor?: string;
}): React.JSX.Element {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-ic${iconTone ? ` ${iconTone}` : ""}`}>
          <Icon size={15} />
        </span>
      </div>
      <div className="stat-val tnum">
        {value}
        {unit ? <span className="unit"> {unit}</span> : null}
      </div>
      <div className="stat-foot">
        {delta ? (
          <span className={`delta ${delta.dir}`}>
            {delta.dir === "up" ? <TrendingUp /> : null}
            {delta.dir === "down" ? <TrendingDown /> : null}
            {delta.text}
          </span>
        ) : null}
        {sub ? <span className="mono">{sub}</span> : null}
      </div>
      {spark && spark.length > 1 ? (
        <Sparkline data={spark} color={sparkColor} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Select */

/** An option for {@link Select}. */
export interface SelectOption {
  value: string;
  label: string;
}

/** A design-system filter select (button + dropdown menu with a checkmark). */
export function Select({
  value,
  options,
  onChange,
  icon: Icon,
  width = 190,
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  width?: number;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function k(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [open]);

  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button className="selectbtn" onClick={() => setOpen((o) => !o)}>
        {Icon ? <Icon className="sel-ic" /> : null}
        <span>{cur ? cur.label : value}</span>
        <ChevronDown className="cv" />
      </button>
      {open ? (
        <div className="menu" style={{ top: "calc(100% + 6px)", right: 0, minWidth: width }}>
          {options.map((o) => (
            <div
              key={o.value}
              className={`menu-item${o.value === value ? " active" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.value === value ? <Check size={15} className="chk" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ CopyBtn */

/** A copy-to-clipboard button that flips to a green check for ~1.3s. */
export function CopyBtn({ text }: { text: string }): React.JSX.Element {
  const [done, setDone] = React.useState(false);
  return (
    <button
      className={`copybtn${done ? " done" : ""}`}
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(text);
        } catch {
          /* clipboard unavailable */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1300);
      }}
      aria-label="Copy"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

/* ------------------------------------------------------------------- Toggle */

/** A small pill toggle switch with an optional label. */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label?: string;
}): React.JSX.Element {
  return (
    <div className={`toggle${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <span className="tk" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- AreaChart */

/** A smoothed area chart with `$` axis labels (Costs · spend over time). */
export function AreaChart({
  series,
  color = "var(--acc)",
  height = 230,
}: {
  series: { d: string; v: number }[];
  color?: string;
  height?: number;
}): React.JSX.Element {
  const W = 640;
  const H = height;
  const padL = 40;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const vals = series.map((s) => s.v);
  const max = Math.ceil(Math.max(...vals, 1));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number): number => padL + (i / (series.length - 1 || 1)) * innerW;
  const y = (v: number): number => padT + innerH - (v / max) * innerH;
  const pts: Array<[number, number]> = series.map((s, i) => [x(i), y(s.v)]);
  const first = pts[0];
  let line = first ? `M${first[0]} ${first[1]}` : "";
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const cx = (a[0] + b[0]) / 2;
    line += ` C${cx} ${a[1]} ${cx} ${b[1]} ${b[0]} ${b[1]}`;
  }
  const area = `${line} L${x(series.length - 1)} ${padT + innerH} L${padL} ${padT + innerH} Z`;
  const ticks = [0, max / 2, max];
  const gradId = React.useId().replace(/:/g, "");
  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text className="axis-lbl" x={padL - 8} y={y(t) + 3} textAnchor="end">
            ${t.toFixed(0)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="2.6"
          fill="var(--bg)"
          stroke={color}
          strokeWidth="1.6"
        />
      ))}
      {series.map((s, i) => (
        <text
          key={s.d}
          className="axis-lbl"
          x={x(i)}
          y={H - 9}
          textAnchor="middle"
        >
          {s.d.replace("Jun ", "")}
        </text>
      ))}
    </svg>
  );
}

/* --------------------------------------------------------------------- HBars */

/** Horizontal value bars (Costs · spend by project). */
export function HBars({
  data,
  max,
}: {
  data: { name: string; v: number; color: string }[];
  max?: number;
}): React.JSX.Element {
  const mx = max || Math.max(...data.map((d) => d.v), 1) * 1.15;
  return (
    <div>
      {data.map((d) => (
        <div key={d.name} className="hbar-row">
          <div className="hbar-name">{d.name}</div>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{ width: `${(d.v / mx) * 100}%`, background: d.color }}
            />
          </div>
          <div className="hbar-val">${d.v.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- Term */

/** A single color-coded terminal log line (`tone` maps to a `t-*` class). */
export interface TermLine {
  text: string;
  tone?: "dim" | "red" | "green" | "blue" | "amber" | "mag" | "tx";
}

/** A terminal log block: traffic-light bar + title + numbered, tinted lines. */
export function Term({
  title,
  tag,
  tagTone = "red",
  lines,
}: {
  title: string;
  tag?: string;
  tagTone?: "red" | "green";
  lines: TermLine[];
}): React.JSX.Element {
  return (
    <div className="term">
      <div className="term-bar">
        <span className="term-dots">
          <i style={{ background: "#ff5f57" }} />
          <i style={{ background: "#febc2e" }} />
          <i style={{ background: "#28c840" }} />
        </span>
        <span className="term-title">{title}</span>
        {tag ? (
          <span
            className="term-title"
            style={{
              marginLeft: "auto",
              color: tagTone === "red" ? "var(--red)" : "var(--green)",
            }}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <div className="term-body">
        {lines.map((ln, i) => (
          <div key={i} className="term-line">
            <span className="term-ln">{i + 1}</span>
            <span className={ln.tone ? `t-${ln.tone}` : "t-tx"}>{ln.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
