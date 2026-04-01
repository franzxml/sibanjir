"use client";

import { useState } from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

type RisikoLevel = "rendah" | "sedang" | "tinggi";

interface FormState {
  kerawanan_banjir: string;
  tipe_dataran: string;
  kedekatan_sungai: string;
  tingkat_sampah: string;
  tandus_tanah: string;
}

interface HimpunanItem { nama: string; derajat: number }
interface FuzzifikasiVar {
  label: string;
  nilai: string;
  nilai_label: string;
  himpunan: HimpunanItem[];
}
interface ConditionDetail { var_label: string; val_label: string; mu: number }
interface RuleItem { id: string; kondisi: string; output: RisikoLevel; alpha: number; conditions_detail: ConditionDetail[] }
interface FormulaPart { kategori: RisikoLevel; alpha: number; z: number; product: number }
interface DetailData {
  fuzzifikasi: Record<string, FuzzifikasiVar>;
  inferensi: { rules: RuleItem[]; agregasi: Record<RisikoLevel, number> };
  defuzzifikasi: {
    metode: string;
    midpoints: Record<RisikoLevel, number>;
    formula_parts: FormulaPart[];
    numerator: number;
    denominator: number;
    nilai: number;
  };
}
interface PredictionResult {
  risiko: RisikoLevel;
  nilai: number;
  keterangan: string;
  detail: DetailData;
}

// ── Form config ────────────────────────────────────────────────────────────

const FIELDS = [
  { name: "kerawanan_banjir" as const, label: "Kerawanan Banjir",
    options: [{ value: "rawan", label: "Rawan" }, { value: "tidak_rawan", label: "Tidak Rawan" }] },
  { name: "tipe_dataran" as const, label: "Tipe Dataran",
    options: [{ value: "rendah", label: "Dataran Rendah" }, { value: "sedang", label: "Dataran Sedang" }, { value: "tinggi", label: "Dataran Tinggi" }] },
  { name: "kedekatan_sungai" as const, label: "Kedekatan dengan Sungai / Laut",
    options: [{ value: "dekat", label: "Dekat" }, { value: "tidak_dekat", label: "Tidak Dekat" }] },
  { name: "tingkat_sampah" as const, label: "Tingkat Buang Sampah Sembarangan",
    options: [{ value: "tinggi", label: "Tinggi" }, { value: "rendah", label: "Rendah" }] },
  { name: "tandus_tanah" as const, label: "Kondisi Tanah",
    options: [{ value: "tandus", label: "Tandus" }, { value: "tidak_tandus", label: "Tidak Tandus" }] },
];

// ── Style maps ─────────────────────────────────────────────────────────────

const RISIKO_CFG: Record<RisikoLevel, { bg: string; text: string; badge: string; bar: string }> = {
  rendah: { bg: "bg-[#f0fdf4]", text: "text-[#166534]", badge: "bg-[#dcfce7] text-[#166534]", bar: "bg-[#22c55e]" },
  sedang: { bg: "bg-[#fffbeb]", text: "text-[#92400e]", badge: "bg-[#fef3c7] text-[#92400e]", bar: "bg-[#f59e0b]" },
  tinggi: { bg: "bg-[#fff1f2]", text: "text-[#881337]", badge: "bg-[#ffe4e6] text-[#881337]", bar: "bg-[#f43f5e]" },
};

const OUTPUT_CHIP: Record<RisikoLevel, string> = {
  rendah: "bg-[#dcfce7] text-[#166534]",
  sedang: "bg-[#fef3c7] text-[#92400e]",
  tinggi: "bg-[#ffe4e6] text-[#881337]",
};

const LABEL: Record<RisikoLevel, string> = { rendah: "Rendah", sedang: "Sedang", tinggi: "Tinggi" };

// ── MF math ────────────────────────────────────────────────────────────────

function trapMF(x: number, a: number, b: number, c: number, d: number): number {
  if (x < a || x > d) return 0;
  if (x >= b && x <= c) return 1;
  if (b > a && x < b) return (x - a) / (b - a);
  if (d > c && x > c) return (d - x) / (d - c);
  return 1;
}

function pts(
  domain: [number, number],
  n: number,
  fns: Record<string, (x: number) => number>
): Record<string, number>[] {
  const [lo, hi] = domain;
  const step = (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, i) => {
    const x = parseFloat((lo + i * step).toFixed(4));
    const p: Record<string, number> = { x };
    for (const [k, fn] of Object.entries(fns)) p[k] = parseFloat(fn(x).toFixed(4));
    return p;
  });
}

// ── Input MF definitions (pre-computed, static) ────────────────────────────

const INPUT_CFG: Record<string, {
  title: string;
  domain: [number, number];
  lines: { key: string; color: string }[];
  fns: Record<string, (x: number) => number>;
  valPos: Record<string, number>;
  xTicks: number[];
}> = {
  kerawanan_banjir: {
    title: "Kerawanan Banjir",
    domain: [0, 1],
    lines: [
      { key: "Tidak Rawan", color: "#0071e3" },
      { key: "Rawan",       color: "#ff3b30" },
    ],
    fns: {
      "Tidak Rawan": (x) => trapMF(x, 0,   0,   0,   0.5),
      "Rawan":       (x) => trapMF(x, 0.5, 1,   1,   1),
    },
    valPos: { tidak_rawan: 0, rawan: 1 },
    xTicks: [0, 0.5, 1],
  },
  tipe_dataran: {
    title: "Tipe Dataran",
    domain: [0, 2],
    lines: [
      { key: "Rendah", color: "#0071e3" },
      { key: "Sedang", color: "#ff9f0a" },
      { key: "Tinggi", color: "#34c759" },
    ],
    fns: {
      "Rendah": (x) => trapMF(x, 0, 0, 0, 1),
      "Sedang": (x) => trapMF(x, 0, 1, 1, 2),
      "Tinggi": (x) => trapMF(x, 1, 2, 2, 2),
    },
    valPos: { rendah: 0, sedang: 1, tinggi: 2 },
    xTicks: [0, 1, 2],
  },
  kedekatan_sungai: {
    title: "Kedekatan Sungai / Laut",
    domain: [0, 1],
    lines: [
      { key: "Tidak Dekat", color: "#0071e3" },
      { key: "Dekat",       color: "#ff3b30" },
    ],
    fns: {
      "Tidak Dekat": (x) => trapMF(x, 0,   0,   0,   0.5),
      "Dekat":       (x) => trapMF(x, 0.5, 1,   1,   1),
    },
    valPos: { tidak_dekat: 0, dekat: 1 },
    xTicks: [0, 0.5, 1],
  },
  tingkat_sampah: {
    title: "Tingkat Sampah Sembarangan",
    domain: [0, 1],
    lines: [
      { key: "Rendah", color: "#34c759" },
      { key: "Tinggi", color: "#ff3b30" },
    ],
    fns: {
      "Rendah": (x) => trapMF(x, 0,   0,   0,   0.5),
      "Tinggi": (x) => trapMF(x, 0.5, 1,   1,   1),
    },
    valPos: { rendah: 0, tinggi: 1 },
    xTicks: [0, 0.5, 1],
  },
  tandus_tanah: {
    title: "Kondisi Tanah",
    domain: [0, 1],
    lines: [
      { key: "Tidak Tandus", color: "#34c759" },
      { key: "Tandus",       color: "#ff9f0a" },
    ],
    fns: {
      "Tidak Tandus": (x) => trapMF(x, 0,   0,   0,   0.5),
      "Tandus":       (x) => trapMF(x, 0.5, 1,   1,   1),
    },
    valPos: { tidak_tandus: 0, tandus: 1 },
    xTicks: [0, 0.5, 1],
  },
};

// Pre-compute static input chart data
const INPUT_DATA: Record<string, Record<string, number>[]> = Object.fromEntries(
  Object.entries(INPUT_CFG).map(([k, cfg]) => [k, pts(cfg.domain, 200, cfg.fns)])
);

// Output MF functions
const OUT_FNS = {
  Rendah: (x: number) => trapMF(x, 0,  0,  25, 45),
  Sedang: (x: number) => trapMF(x, 25, 50, 50, 75),
  Tinggi: (x: number) => trapMF(x, 55, 75, 100, 100),
};
const OUT_COLORS = { Rendah: "#34c759", Sedang: "#ff9f0a", Tinggi: "#ff3b30" };

function buildOutputData(aggregasi: Record<RisikoLevel, number>) {
  return Array.from({ length: 201 }, (_, i) => {
    const x = i * 0.5;
    return {
      x,
      Rendah: OUT_FNS.Rendah(x),
      Sedang: OUT_FNS.Sedang(x),
      Tinggi: OUT_FNS.Tinggi(x),
      RendahClip: Math.min(OUT_FNS.Rendah(x), aggregasi.rendah),
      SedangClip: Math.min(OUT_FNS.Sedang(x), aggregasi.sedang),
      TinggiClip: Math.min(OUT_FNS.Tinggi(x), aggregasi.tinggi),
    };
  });
}

// ── Shared UI ──────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ step, title, sub }: { step: string; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <span className="text-[11px] font-bold tracking-widest text-[#0071e3] uppercase">{step}</span>
      <h2 className="text-[15px] font-semibold text-[#1d1d1f] mt-0.5">{title}</h2>
      {sub && <p className="text-[11px] text-[#86868b] mt-0.5">{sub}</p>}
    </div>
  );
}

const chartTooltipStyle = {
  contentStyle: { fontSize: 11, borderRadius: 10, border: "1px solid #e5e5ea", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
  itemStyle: { padding: "1px 0" },
};

// ── Input MF chart ─────────────────────────────────────────────────────────

function InputMFChart({ varKey, selectedVal }: { varKey: string; selectedVal: string }) {
  const cfg = INPUT_CFG[varKey];
  const data = INPUT_DATA[varKey];
  const refX = cfg.valPos[selectedVal];
  const refLabel = cfg.lines.find((l) =>
    l.key.toLowerCase().replace(/ /g, "_") === selectedVal ||
    cfg.valPos[selectedVal] === refX
  )?.key ?? selectedVal;

  return (
    <div className="rounded-xl bg-[#f5f5f7] p-3 pb-1">
      <p className="text-[11px] font-semibold text-[#3a3a3c] mb-2 text-center">{cfg.title}</p>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[cfg.domain[0], cfg.domain[1]]}
            ticks={cfg.xTicks}
            tick={{ fontSize: 9, fill: "#86868b" }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.5, 1]}
            tick={{ fontSize: 9, fill: "#86868b" }}
          />
          <Tooltip {...chartTooltipStyle} formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
          <Legend
            wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
            iconType="plainline"
            iconSize={12}
          />
          {cfg.lines.map((l) => (
            <Line
              key={l.key}
              type="linear"
              dataKey={l.key}
              stroke={l.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
          {refX !== undefined && (
            <ReferenceLine
              x={refX}
              stroke="#1d1d1f"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              label={{ value: `μ=1`, position: "top", fontSize: 9, fill: "#1d1d1f", fontWeight: 700 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Output MF chart ────────────────────────────────────────────────────────

function OutputMFChart({
  aggregasi,
  nilaiZ,
}: {
  aggregasi: Record<RisikoLevel, number>;
  nilaiZ: number;
}) {
  const data = buildOutputData(aggregasi);

  return (
    <div className="rounded-xl bg-[#f5f5f7] p-3 pb-1">
      <p className="text-[11px] font-semibold text-[#3a3a3c] mb-2 text-center">
        Fungsi Keanggotaan Output — Risiko Banjir
      </p>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5ea" />
          <XAxis
            dataKey="x"
            type="number"
            domain={[0, 100]}
            ticks={[0, 18, 25, 50, 75, 82, 100]}
            tick={{ fontSize: 9, fill: "#86868b" }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.5, 1]}
            tick={{ fontSize: 9, fill: "#86868b" }}
          />
          <Tooltip {...chartTooltipStyle} formatter={(v) => typeof v === "number" ? v.toFixed(3) : v} />
          <Legend
            wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
            iconType="plainline"
            iconSize={12}
          />

          {/* Clipped / activated areas */}
          <Area type="linear" dataKey="RendahClip" fill="#34c75926" stroke="none" name="Rendah (aktif)" legendType="none" />
          <Area type="linear" dataKey="SedangClip" fill="#ff9f0a26" stroke="none" name="Sedang (aktif)" legendType="none" />
          <Area type="linear" dataKey="TinggiClip" fill="#ff3b3026" stroke="none" name="Tinggi (aktif)" legendType="none" />

          {/* Full MF lines */}
          <Line type="linear" dataKey="Rendah" stroke={OUT_COLORS.Rendah} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line type="linear" dataKey="Sedang" stroke={OUT_COLORS.Sedang} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line type="linear" dataKey="Tinggi" stroke={OUT_COLORS.Tinggi} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />

          {/* Defuzzified value */}
          <ReferenceLine
            x={nilaiZ}
            stroke="#1d1d1f"
            strokeWidth={2}
            label={{ value: `Z = ${nilaiZ}`, position: "top", fontSize: 10, fill: "#1d1d1f", fontWeight: 700 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Manual Fuzzification Calculation ──────────────────────────────────────

interface MFHimpunan { nama: string; params: [number, number, number, number] }
interface VarManualCfg {
  label: string;
  himpunan: MFHimpunan[];
  valPos: Record<string, number>;
  valLabel: Record<string, string>;
}

const MF_MANUAL: Record<string, VarManualCfg> = {
  kerawanan_banjir: {
    label: "Kerawanan Banjir",
    himpunan: [
      { nama: "Tidak Rawan", params: [0, 0, 0, 0.5] },
      { nama: "Rawan",       params: [0.5, 1, 1, 1] },
    ],
    valPos:   { tidak_rawan: 0, rawan: 1 },
    valLabel: { tidak_rawan: "Tidak Rawan", rawan: "Rawan" },
  },
  tipe_dataran: {
    label: "Tipe Dataran",
    himpunan: [
      { nama: "Rendah", params: [0, 0, 0, 1] },
      { nama: "Sedang", params: [0, 1, 1, 2] },
      { nama: "Tinggi", params: [1, 2, 2, 2] },
    ],
    valPos:   { rendah: 0, sedang: 1, tinggi: 2 },
    valLabel: { rendah: "Rendah", sedang: "Sedang", tinggi: "Tinggi" },
  },
  kedekatan_sungai: {
    label: "Kedekatan Sungai / Laut",
    himpunan: [
      { nama: "Tidak Dekat", params: [0, 0, 0, 0.5] },
      { nama: "Dekat",       params: [0.5, 1, 1, 1] },
    ],
    valPos:   { tidak_dekat: 0, dekat: 1 },
    valLabel: { tidak_dekat: "Tidak Dekat", dekat: "Dekat" },
  },
  tingkat_sampah: {
    label: "Tingkat Sampah Sembarangan",
    himpunan: [
      { nama: "Rendah", params: [0, 0, 0, 0.5] },
      { nama: "Tinggi", params: [0.5, 1, 1, 1] },
    ],
    valPos:   { rendah: 0, tinggi: 1 },
    valLabel: { rendah: "Rendah", tinggi: "Tinggi" },
  },
  tandus_tanah: {
    label: "Kondisi Tanah",
    himpunan: [
      { nama: "Tidak Tandus", params: [0, 0, 0, 0.5] },
      { nama: "Tandus",       params: [0.5, 1, 1, 1] },
    ],
    valPos:   { tidak_tandus: 0, tandus: 1 },
    valLabel: { tidak_tandus: "Tidak Tandus", tandus: "Tandus" },
  },
};

interface StepResult { lines: string[]; mu: number }

function computeMFStep(params: [number, number, number, number], x: number, nama: string): StepResult {
  const [a, b, c, d] = params;
  const fmt = (n: number) => parseFloat(n.toFixed(4));

  if (x < a) return {
    lines: [`x = ${x} < ${a} (di luar domain kiri)`, `μ (${nama}) = 0`],
    mu: 0,
  };
  if (x > d) return {
    lines: [`x = ${x} > ${d} (di luar domain kanan)`, `μ (${nama}) = 0`],
    mu: 0,
  };
  if (x >= b && x <= c) return {
    lines: [`x = ${x} berada pada zona puncak [${b}, ${c}]`, `μ (${nama}) = 1`],
    mu: 1,
  };
  if (x < b) {
    const num = fmt(x - a);
    const den = fmt(d - a);
    const mu  = fmt(den === 0 ? 1 : num / den);
    return {
      lines: [
        `x = ${x} berada pada zona naik [${a}, ${d}]`,
        `μ = (x − ${a}) / (${d} − ${a})`,
        `μ = (${x} − ${a}) / (${d} − ${a}) = ${num} / ${den} = ${mu}`,
      ],
      mu,
    };
  }
  // falling
  const num = fmt(d - x);
  const den = fmt(d - a);
  const mu  = fmt(den === 0 ? 1 : num / den);
  return {
    lines: [
      `x = ${x} berada pada zona turun [${a}, ${d}]`,
      `μ = (${d} − x) / (${d} − ${a})`,
      `μ = (${d} − ${x}) / (${d} − ${a}) = ${num} / ${den} = ${mu}`,
    ],
    mu,
  };
}

function ManualCalcCard({ varKey, selectedVal }: { varKey: string; selectedVal: string }) {
  const cfg = MF_MANUAL[varKey];
  if (!cfg || !selectedVal) return null;
  const x = cfg.valPos[selectedVal];

  return (
    <div className="rounded-xl bg-[#f5f5f7] p-4">
      <p className="text-[11px] font-semibold text-[#86868b] mb-0.5">{cfg.label}</p>
      <p className="text-[12px] font-semibold text-[#1d1d1f] mb-3">
        {cfg.label} ={" "}
        <span className="text-[#0071e3]">{cfg.valLabel[selectedVal]}</span>
        {"  "}
        <span className="font-mono text-[#86868b]">(x = {x})</span>
      </p>

      <div className="space-y-2">
        {cfg.himpunan.map((h) => {
          const step = computeMFStep(h.params, x, h.nama);
          const isActive = step.mu > 0;
          return (
            <div
              key={h.nama}
              className={`rounded-lg border p-3 ${isActive ? "border-[#0071e3]/20 bg-white" : "border-[#e5e5ea] bg-white/60"}`}
            >
              <p className={`text-[11px] font-semibold mb-1.5 ${isActive ? "text-[#0071e3]" : "text-[#86868b]"}`}>
                {h.nama}{"  "}
                <span className="font-mono font-normal text-[#86868b]">
                  ({h.params[0]} – {h.params[3]})
                </span>
              </p>
              <div className="space-y-0.5">
                {step.lines.map((line, i) => {
                  const isResult = i === step.lines.length - 1;
                  return (
                    <p
                      key={i}
                      className={`font-mono text-[11px] ${
                        isResult
                          ? isActive
                            ? "font-bold text-[#0071e3]"
                            : "font-bold text-[#86868b]"
                          : "text-[#3a3a3c]"
                      }`}
                    >
                      {isResult ? "Maka " : ""}{line}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section components ─────────────────────────────────────────────────────

function FuzzifikasiSection({
  data,
  form,
}: {
  data: Record<string, FuzzifikasiVar>;
  form: FormState;
}) {
  const varKeys = Object.keys(data);
  return (
    <Card className="p-6">
      <SectionTitle step="01" title="Fuzzifikasi" />

      {/* Membership degree tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {Object.values(data).map((v) => (
          <div key={v.label} className="rounded-xl bg-[#f5f5f7] p-3.5">
            <p className="text-[11px] font-medium text-[#86868b]">{v.label}</p>
            <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2.5">{v.nilai_label}</p>
            <div className="space-y-1.5">
              {v.himpunan.map((h) => (
                <div key={h.nama} className="flex items-center justify-between">
                  <span className="text-[11px] text-[#3a3a3c]">{h.nama}</span>
                  <span className={`text-[11px] font-mono font-bold tabular-nums ${h.derajat > 0 ? "text-[#0071e3]" : "text-[#c7c7cc]"}`}>
                    {h.derajat.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* MF Charts */}
      <p className="text-[11px] font-semibold tracking-widest text-[#86868b] uppercase mb-3">
        Grafik Fungsi Keanggotaan
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {varKeys.map((key) => (
          <InputMFChart key={key} varKey={key} selectedVal={form[key as keyof FormState]} />
        ))}
      </div>

      {/* Manual calculation */}
      <div className="pt-5 border-t border-[#f2f2f7]">
        <p className="text-[11px] font-semibold tracking-widest text-[#86868b] uppercase mb-3">
          Perhitungan Manual
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {varKeys.map((key) => (
            <ManualCalcCard key={key} varKey={key} selectedVal={form[key as keyof FormState]} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function InferensiSection({ data }: { data: DetailData["inferensi"] }) {
  const { rules, agregasi } = data;
  return (
    <Card className="p-6">
      <SectionTitle
        step="02"
        title="Inferensi Rule Base"
        sub="Operator AND: MIN  •  Agregasi: MAX"
      />

      {/* Formula header */}
      <div className="rounded-xl bg-[#1d1d1f] px-4 py-3 font-mono text-[11px] text-[#86868b] mb-4">
        μ<span className="text-[#a1a1aa]">A∩B</span>(x) = min(μ<span className="text-[#a1a1aa]">A</span>(x), μ<span className="text-[#a1a1aa]">B</span>(x))
      </div>

      {/* Rule cards */}
      <div className="space-y-2.5 mb-5">
        {rules.map((r) => {
          const active = r.alpha > 0;
          const muList = r.conditions_detail.map((c) => c.mu);
          return (
            <div
              key={r.id}
              className={`rounded-xl border p-3.5 ${active ? "border-[#0071e3]/20 bg-white" : "border-[#e5e5ea] bg-[#fafafa]"}`}
            >
              {/* Rule header */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold font-mono ${active ? "text-[#1d1d1f]" : "text-[#c7c7cc]"}`}>
                    {r.id}
                  </span>
                  <span className={`text-[11px] ${active ? "text-[#3a3a3c]" : "text-[#c7c7cc]"}`}>
                    IF {r.kondisi} THEN
                  </span>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? OUTPUT_CHIP[r.output] : "bg-[#f2f2f7] text-[#c7c7cc]"}`}>
                    {LABEL[r.output]}
                  </span>
                </div>
              </div>

              {/* Per-condition μ values */}
              <div className="space-y-0.5 mb-2">
                {r.conditions_detail.map((c, idx) => (
                  <p key={idx} className={`font-mono text-[11px] ${c.mu > 0 ? "text-[#3a3a3c]" : "text-[#c7c7cc]"}`}>
                    μ<span className={c.mu > 0 ? "text-[#0071e3]" : "text-[#c7c7cc]"}>{c.val_label}</span> = {c.mu}
                  </p>
                ))}
              </div>

              {/* Min formula */}
              <div className={`border-t pt-2 mt-2 space-y-0.5 ${active ? "border-[#e5e5ea]" : "border-[#f2f2f7]"}`}>
                <p className={`font-mono text-[11px] ${active ? "text-[#3a3a3c]" : "text-[#c7c7cc]"}`}>
                  α<sub>{r.id.replace("R", "")}</sub> = min({muList.join(", ")})
                </p>
                <p className={`font-mono text-[11px] font-bold ${active ? "text-[#0071e3]" : "text-[#c7c7cc]"}`}>
                  Maka α<sub>{r.id.replace("R", "")}</sub> = {r.alpha}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agregasi MAX */}
      <div className="pt-4 border-t border-[#f2f2f7]">
        <p className="text-[11px] font-semibold tracking-widest text-[#86868b] uppercase mb-2.5">Agregasi (MAX)</p>
        <div className="flex flex-wrap gap-2">
          {(["rendah", "sedang", "tinggi"] as RisikoLevel[]).map((cat) => (
            <span key={cat} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${agregasi[cat] > 0 ? OUTPUT_CHIP[cat] : "bg-[#f2f2f7] text-[#c7c7cc]"}`}>
              {LABEL[cat]} = {agregasi[cat]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DefuzzifikasiSection({ data }: { data: DetailData["defuzzifikasi"] }) {
  const { metode, midpoints, formula_parts, numerator, denominator, nilai } = data;
  return (
    <Card className="p-6">
      <SectionTitle step="03" title="Defuzzifikasi" sub={`Metode: ${metode}`} />

      <div className="mb-5">
        <p className="text-[11px] font-semibold tracking-widest text-[#86868b] uppercase mb-2.5">Titik Tengah Domain</p>
        <div className="flex flex-wrap gap-2">
          {(["rendah", "sedang", "tinggi"] as RisikoLevel[]).map((cat) => (
            <span key={cat} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${OUTPUT_CHIP[cat]}`}>
              {LABEL[cat]} = {midpoints[cat]}
            </span>
          ))}
        </div>
      </div>

      {/* Output MF Chart */}
      <div className="mb-5">
        <OutputMFChart
          aggregasi={(data as any)._aggregasi ?? { rendah: 0, sedang: 0, tinggi: 0 }}
          nilaiZ={nilai}
        />
      </div>

      {/* Formula */}
      <div className="rounded-xl bg-[#1d1d1f] px-5 py-4 font-mono text-[12px] space-y-1.5">
        <p className="text-[#86868b]">Z = Σ(αi × zi) / Σ(αi)</p>
        <p className="text-[#d1d1d6]">{"  "}= ({formula_parts.map((p) => `${p.alpha} × ${p.z}`).join(" + ")})</p>
        <p className="text-[#d1d1d6]">{"    "}/ ({formula_parts.map((p) => p.alpha).join(" + ")})</p>
        <p className="text-[#d1d1d6]">{"  "}= {formula_parts.map((p) => p.product).join(" + ")} / {denominator}</p>
        <p className="text-[#d1d1d6]">{"  "}= {numerator} / {denominator}</p>
        <div className="pt-2 border-t border-[#3a3a3c]">
          <p className="text-[#0a84ff] font-bold text-[15px]">Z = {nilai}</p>
        </div>
      </div>
    </Card>
  );
}

// ── Fuzzy Parameter Table ──────────────────────────────────────────────────

const FUZZY_PARAMS = {
  input: [
    {
      nama: "Kerawanan Banjir",
      semesta: "0 – 1",
      himpunan: [
        { label: "Tidak Rawan", domain: "0 – 0.5" },
        { label: "Rawan",       domain: "0.5 – 1" },
      ],
    },
    {
      nama: "Tipe Dataran",
      semesta: "0 – 2",
      himpunan: [
        { label: "Rendah", domain: "0 – 1" },
        { label: "Sedang", domain: "0 – 2" },
        { label: "Tinggi", domain: "1 – 2" },
      ],
    },
    {
      nama: "Kedekatan Sungai / Laut",
      semesta: "0 – 1",
      himpunan: [
        { label: "Tidak Dekat", domain: "0 – 0.5" },
        { label: "Dekat",       domain: "0.5 – 1" },
      ],
    },
    {
      nama: "Tingkat Sampah Sembarangan",
      semesta: "0 – 1",
      himpunan: [
        { label: "Rendah", domain: "0 – 0.5" },
        { label: "Tinggi", domain: "0.5 – 1" },
      ],
    },
    {
      nama: "Kondisi Tanah",
      semesta: "0 – 1",
      himpunan: [
        { label: "Tidak Tandus", domain: "0 – 0.5" },
        { label: "Tandus",       domain: "0.5 – 1" },
      ],
    },
  ],
  output: [
    {
      nama: "Risiko Banjir",
      semesta: "0 – 100",
      himpunan: [
        { label: "Rendah", domain: "0 – 45"   },
        { label: "Sedang", domain: "25 – 75"  },
        { label: "Tinggi", domain: "55 – 100" },
      ],
    },
  ],
};

function FuzzyParameterTable() {
  const totalInputRows = FUZZY_PARAMS.input.reduce((s, v) => s + v.himpunan.length, 0);
  const totalOutputRows = FUZZY_PARAMS.output.reduce((s, v) => s + v.himpunan.length, 0);

  type Row = {
    showFungsi: boolean; fungsiLabel: string; fungsiSpan: number;
    showVar: boolean; varLabel: string; varSpan: number; varSemesta: string;
    himpunan: string; domain: string;
  };

  const rows: Row[] = [];

  let firstFungsi = true;
  for (const [fungsiLabel, vars, fungsiSpan] of [
    ["Input",  FUZZY_PARAMS.input,  totalInputRows],
    ["Output", FUZZY_PARAMS.output, totalOutputRows],
  ] as [string, typeof FUZZY_PARAMS.input, number][]) {
    let firstInFungsi = true;
    for (const v of vars) {
      let firstInVar = true;
      for (const h of v.himpunan) {
        rows.push({
          showFungsi: firstInFungsi,
          fungsiLabel,
          fungsiSpan,
          showVar: firstInVar,
          varLabel: v.nama,
          varSpan: v.himpunan.length,
          varSemesta: v.semesta,
          himpunan: h.label,
          domain: h.domain,
        });
        firstInFungsi = false;
        firstInVar = false;
      }
    }
    firstFungsi = false;
  }
  void firstFungsi;

  return (
    <Card className="p-6">
      <SectionTitle step="" title="Parameter Variabel Fuzzy" sub="Himpunan dan domain fungsi keanggotaan yang digunakan sistem" />
      <div className="rounded-xl overflow-hidden border border-[#e5e5ea]">
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr className="bg-[#f5f5f7] border-b border-[#e5e5ea]">
              <th className="px-3 py-2.5 text-center font-semibold text-[#86868b] border-r border-[#e5e5ea] w-16">Fungsi</th>
              <th className="px-3 py-2.5 text-center font-semibold text-[#86868b] border-r border-[#e5e5ea]">Nama Variabel</th>
              <th className="px-3 py-2.5 text-center font-semibold text-[#86868b] border-r border-[#e5e5ea]">Himpunan Fuzzy</th>
              <th className="px-3 py-2.5 text-center font-semibold text-[#86868b] border-r border-[#e5e5ea] w-28">Semesta Pembicara</th>
              <th className="px-3 py-2.5 text-center font-semibold text-[#86868b] w-24">Domain</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#f2f2f7] last:border-0 bg-white">
                {r.showFungsi && (
                  <td
                    rowSpan={r.fungsiSpan}
                    className="px-3 py-2 text-center font-semibold text-[#1d1d1f] border-r border-[#e5e5ea] align-middle"
                  >
                    {r.fungsiLabel}
                  </td>
                )}
                {r.showVar && (
                  <td
                    rowSpan={r.varSpan}
                    className="px-3 py-2 text-center text-[#3a3a3c] border-r border-[#e5e5ea] align-middle"
                  >
                    <div className="font-medium">{r.varLabel}</div>
                  </td>
                )}
                <td className="px-3 py-2 text-center text-[#3a3a3c] border-r border-[#e5e5ea]">{r.himpunan}</td>
                {r.showVar && (
                  <td
                    rowSpan={r.varSpan}
                    className="px-3 py-2 text-center font-mono text-[#86868b] border-r border-[#e5e5ea] align-middle"
                  >
                    {r.varSemesta}
                  </td>
                )}
                <td className="px-3 py-2 text-center font-mono text-[#0071e3]">{r.domain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function KesimpulanSection({ result }: { result: PredictionResult }) {
  const cfg = RISIKO_CFG[result.risiko];
  return (
    <Card className={`p-6 ${cfg.bg}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-[#86868b] uppercase mb-1">Kesimpulan</p>
          <h3 className={`text-[15px] font-semibold ${cfg.text}`}>Risiko Banjir</h3>
        </div>
        <span className={`rounded-full px-3.5 py-1 text-[12px] font-bold uppercase tracking-wide ${cfg.badge}`}>
          {LABEL[result.risiko]}
        </span>
      </div>
      <div className="flex items-end gap-1.5 mb-3">
        <span className={`text-5xl font-bold tabular-nums ${cfg.text}`}>{result.nilai}</span>
        <span className="text-[13px] text-[#86868b] mb-1.5">/ 100</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-black/10 mb-4 overflow-hidden">
        <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${result.nilai}%` }} />
      </div>
      <p className={`text-[13px] leading-relaxed ${cfg.text} opacity-80`}>{result.keterangan}</p>
    </Card>
  );
}

// ── Excel Export ──────────────────────────────────────────────────────────

async function exportToExcel(result: PredictionResult, form: FormState) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Input ─────────────────────────────────────────────────────
  const inputRows: (string | number)[][] = [
    ["Variabel Input", "Pilihan"],
    ...FIELDS.map((f) => {
      const opt = f.options.find((o) => o.value === form[f.name as keyof FormState]);
      return [f.label, opt?.label ?? form[f.name as keyof FormState]];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inputRows), "Input");

  // ── Sheet 2: Parameter Fuzzy ────────────────────────────────────────────
  const paramRows: (string | number)[][] = [
    ["Fungsi", "Nama Variabel", "Himpunan Fuzzy", "Semesta Pembicara", "Domain"],
  ];
  for (const [fungsi, vars] of [
    ["Input",  FUZZY_PARAMS.input],
    ["Output", FUZZY_PARAMS.output],
  ] as [string, typeof FUZZY_PARAMS.input][]) {
    for (const v of vars) {
      for (const h of v.himpunan) {
        paramRows.push([fungsi, v.nama, h.label, v.semesta, h.domain]);
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(paramRows), "Parameter Fuzzy");

  // ── Sheet 3: Fuzzifikasi ────────────────────────────────────────────────
  const fuzzRows: (string | number)[][] = [
    ["Variabel", "Nilai Input (x)", "Himpunan", "Parameter Trapesium (a, b, c, d)", "Langkah Perhitungan", "Derajat Keanggotaan (μ)"],
  ];
  for (const [varKey, varCfg] of Object.entries(MF_MANUAL)) {
    const selectedVal = form[varKey as keyof FormState];
    const x = varCfg.valPos[selectedVal];
    for (const h of varCfg.himpunan) {
      const step = computeMFStep(h.params, x, h.nama);
      fuzzRows.push([
        varCfg.label,
        `${varCfg.valLabel[selectedVal]} (x = ${x})`,
        h.nama,
        `(${h.params.join(", ")})`,
        step.lines.join(" → "),
        step.mu,
      ]);
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fuzzRows), "Fuzzifikasi");

  // ── Sheet 4: Inferensi ──────────────────────────────────────────────────
  const { rules, agregasi } = result.detail.inferensi;
  const infRows: (string | number)[][] = [
    ["Rule", "Kondisi", "Output", "Detail μ per Kondisi", "Perhitungan MIN", "α (Fire Strength)"],
  ];
  for (const r of rules) {
    const muDetail = r.conditions_detail.map((c) => `μ(${c.val_label}) = ${c.mu}`).join("  |  ");
    const minExpr  = `min(${r.conditions_detail.map((c) => c.mu).join(", ")})`;
    infRows.push([r.id, `IF ${r.kondisi}`, `THEN ${LABEL[r.output]}`, muDetail, minExpr, r.alpha]);
  }
  infRows.push([], ["=== Agregasi MAX ==="], ["Kategori", "Nilai Agregasi MAX"]);
  for (const cat of ["rendah", "sedang", "tinggi"] as RisikoLevel[]) {
    infRows.push([LABEL[cat], agregasi[cat]]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(infRows), "Inferensi");

  // ── Sheet 5: Defuzzifikasi ──────────────────────────────────────────────
  const { metode, midpoints, formula_parts, numerator, denominator, nilai } = result.detail.defuzzifikasi;
  const defRows: (string | number)[][] = [
    [`Metode: ${metode}`],
    [],
    ["=== Titik Tengah Domain ==="],
    ["Kategori", "Titik Tengah (z)"],
    ["Rendah",  midpoints.rendah],
    ["Sedang",  midpoints.sedang],
    ["Tinggi",  midpoints.tinggi],
    [],
    ["=== Formula Bagian (Weighted Average) ==="],
    ["Kategori", "α (Alpha)", "z (Titik Tengah)", "α × z"],
    ...formula_parts.map((p) => [LABEL[p.kategori], p.alpha, p.z, p.product]),
    [],
    ["Numerator   Σ(α × z)", "", "", numerator],
    ["Denominator Σ(α)",     "", "", denominator],
    [],
    ["Rumus", `Z = Σ(αi × zi) / Σ(αi)`],
    ["Substitusi", `Z = ${numerator} / ${denominator}`],
    ["Nilai Z", nilai],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(defRows), "Defuzzifikasi");

  // ── Sheet 6: Kesimpulan ─────────────────────────────────────────────────
  const kesRows: (string | number)[][] = [
    ["=== Hasil Prediksi Risiko Banjir ==="],
    [],
    ["Tingkat Risiko", LABEL[result.risiko].toUpperCase()],
    ["Nilai (0 – 100)", result.nilai],
    ["Keterangan", result.keterangan],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kesRows), "Kesimpulan");

  XLSX.writeFile(wb, `prediksi-banjir-${Date.now()}.xlsx`);
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function PredictionForm() {
  const [form, setForm] = useState<FormState>({
    kerawanan_banjir: "", tipe_dataran: "", kedekatan_sungai: "",
    tingkat_sampah: "", tandus_tanah: "",
  });
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = Object.values(form).every((v) => v !== "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8000/api/v1/prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PredictionResult = await res.json();
      // Inject aggregasi into defuzzifikasi for chart use
      (data.detail.defuzzifikasi as any)._aggregasi = data.detail.inferensi.agregasi;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl space-y-4">
      {/* Header */}
      <div className="text-center pb-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">Prediksi Risiko Banjir</h1>
        <p className="text-[15px] text-[#86868b] mt-1">Fuzzy Mamdani</p>
      </div>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label className="block text-[13px] font-medium text-[#3a3a3c] mb-1.5">{field.label}</label>
              <select
                value={form[field.name]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.name]: e.target.value }))}
                className="w-full appearance-none rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3.5 py-2.5 text-[14px] text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:border-transparent transition-all cursor-pointer"
              >
                <option value="">Pilih opsi</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="submit"
            disabled={!isComplete || loading}
            className="mt-2 w-full rounded-xl bg-[#0071e3] px-4 py-3 text-[14px] font-semibold text-white transition-all hover:bg-[#0077ed] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Memproses…" : "Prediksi Sekarang"}
          </button>
        </form>
      </Card>

      {error && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-[13px] text-[#be123c]">
          {error}
        </div>
      )}

      {result && (
        <>
          <KesimpulanSection result={result} />
          <FuzzyParameterTable />
          <FuzzifikasiSection data={result.detail.fuzzifikasi} form={form} />
          <InferensiSection data={result.detail.inferensi} />
          <DefuzzifikasiSection data={result.detail.defuzzifikasi} />
          <button
            onClick={() => exportToExcel(result, form)}
            className="w-full rounded-xl border border-[#34c759]/40 bg-[#f0fdf4] px-4 py-3 text-[14px] font-semibold text-[#166534] transition-all hover:bg-[#dcfce7] active:scale-[0.98]"
          >
            Export ke Excel
          </button>
        </>
      )}
    </div>
  );
}
