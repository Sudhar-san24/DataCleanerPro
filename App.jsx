import { useState, useCallback, useRef, useEffect } from "react";

const API = "http://localhost:5000/api";

// ── Utility ──────────────────────────────────────────────────────────────────
const fmt = (n, d = 1) => (n == null ? "—" : Number(n).toFixed(d));
const fmtN = (n) => (n == null ? "—" : Number(n).toLocaleString());
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function scoreColor(v) {
  if (v >= 80) return "#22c55e";
  if (v >= 60) return "#f59e0b";
  return "#ef4444";
}

// ── Components ────────────────────────────────────────────────────────────────
function Gauge({ value, label, size = 80 }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const pct = clamp(value, 0, 100) / 100;
  const color = scoreColor(value);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="40" y="44" textAnchor="middle" fontSize="15" fontWeight="600" fill={color}>{Math.round(value)}</text>
      </svg>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center" }}>{label}</span>
    </div>
  );
}

function Badge({ children, color = "blue" }) {
  const map = {
    blue: { bg: "#dbeafe", color: "#1d4ed8" },
    green: { bg: "#dcfce7", color: "#16a34a" },
    amber: { bg: "#fef3c7", color: "#b45309" },
    red: { bg: "#fee2e2", color: "#dc2626" },
    gray: { bg: "#f3f4f6", color: "#374151" },
  };
  const s = map[color] || map.gray;
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 500, padding: "2px 8px",
      borderRadius: 4, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "var(--color-background-secondary)", borderRadius: 10,
      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 600, color: accent || "var(--color-text-primary)", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{sub}</span>}
    </div>
  );
}

function MiniBar({ pct, color = "#6366f1" }) {
  return (
    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${clamp(pct, 0, 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s" }} />
    </div>
  );
}

function CorrelationHeatmap({ data }) {
  if (!data || !data.columns || data.columns.length < 2) return null;
  const { columns, matrix } = data;
  const colorVal = (v) => {
    const abs = Math.abs(v);
    const alpha = clamp(abs, 0, 1);
    return v > 0 ? `rgba(99,102,241,${alpha})` : `rgba(239,68,68,${alpha})`;
  };
  const cols = columns.slice(0, 10);
  const mat = matrix.slice(0, 10).map(r => r.slice(0, 10));
  const cell = Math.min(52, Math.floor(560 / cols.length));
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "inline-block" }}>
        <div style={{ display: "flex", marginBottom: 2, marginLeft: cell + 4 }}>
          {cols.map(c => (
            <div key={c} style={{ width: cell, fontSize: 10, color: "var(--color-text-secondary)", textAlign: "center",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 2px" }}>{c}</div>
          ))}
        </div>
        {mat.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
            <div style={{ width: cell, fontSize: 10, color: "var(--color-text-secondary)", textAlign: "right",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 4 }}>{cols[i]}</div>
            {row.map((v, j) => (
              <div key={j} title={`${cols[i]} × ${cols[j]}: ${fmt(v, 3)}`}
                style={{ width: cell - 2, height: cell - 2, background: colorVal(v ?? 0), borderRadius: 3,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: Math.abs(v) > 0.5 ? "white" : "var(--color-text-secondary)" }}>
                {fmt(v, 2)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionChart({ data }) {
  if (!data || data.length === 0) return null;
  const [selected, setSelected] = useState(0);
  const item = data[selected];
  if (!item) return null;
  const max = Math.max(...item.hist);
  const H = 120;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {data.map((d, i) => (
          <button key={d.column} onClick={() => setSelected(i)}
            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
              background: i === selected ? "#6366f1" : "var(--color-background-secondary)",
              color: i === selected ? "white" : "var(--color-text-primary)" }}>
            {d.column}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: H, padding: "0 4px" }}>
        {item.hist.map((v, i) => {
          const h = max > 0 ? (v / max) * H : 0;
          return (
            <div key={i} title={`${fmt(item.bin_edges[i], 2)} — ${fmt(item.bin_edges[i + 1], 2)}: ${v}`}
              style={{ flex: 1, height: h, background: "#6366f1", borderRadius: "3px 3px 0 0",
                opacity: 0.8, transition: "height 0.3s", minWidth: 2 }} />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10,
        color: "var(--color-text-secondary)", marginTop: 4 }}>
        <span>{fmt(item.bin_edges[0], 2)}</span>
        <span>mean: {fmt(item.mean, 2)} | median: {fmt(item.median, 2)}</span>
        <span>{fmt(item.bin_edges[item.bin_edges.length - 1], 2)}</span>
      </div>
    </div>
  );
}

function BarChart({ items }) {
  if (!items || items.length === 0) return null;
  const [sel, setSel] = useState(0);
  const d = items[sel];
  const max = Math.max(...(d?.values || [1]));
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {items.map((it, i) => (
          <button key={it.column} onClick={() => setSel(i)}
            style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "none",
              background: i === sel ? "#06b6d4" : "var(--color-background-secondary)",
              color: i === sel ? "white" : "var(--color-text-primary)" }}>
            {it.column}
          </button>
        ))}
      </div>
      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {d.labels.slice(0, 10).map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 110, fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(label)}</div>
              <div style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 4, height: 20, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(d.values[i] / max) * 100}%`,
                  background: "rgba(6,182,212,0.7)", borderRadius: 4, transition: "width 0.4s" }} />
              </div>
              <div style={{ width: 40, fontSize: 11, color: "var(--color-text-secondary)" }}>{fmtN(d.values[i])}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataTable({ tableData, title }) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  if (!tableData) return null;
  const { columns, data, total_rows } = tableData;

  let rows = [...data];
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(r => Object.values(r).some(v => String(v ?? "").toLowerCase().includes(q)));
  }
  if (sortCol) {
    rows.sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      const n = v => (v === null ? -Infinity : isNaN(Number(v)) ? v : Number(v));
      const res = n(av) > n(bv) ? 1 : n(av) < n(bv) ? -1 : 0;
      return sortDir === "asc" ? res : -res;
    });
  }
  const pageRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  const toggleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          {fmtN(total_rows)} total rows · {columns.length} columns
        </span>
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search..." style={{ padding: "5px 10px", fontSize: 13, borderRadius: 6,
            border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-primary)",
            color: "var(--color-text-primary)", width: 180 }}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--color-background-secondary)" }}>
              {columns.map(col => (
                <th key={col} onClick={() => toggleSort(col)}
                  style={{ padding: "8px 10px", textAlign: "left", cursor: "pointer", userSelect: "none",
                    borderBottom: "1px solid var(--color-border-tertiary)", fontWeight: 500, fontSize: 12,
                    color: sortCol === col ? "#6366f1" : "var(--color-text-primary)", whiteSpace: "nowrap" }}>
                  {col} {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)",
                background: i % 2 === 0 ? "transparent" : "var(--color-background-secondary)" }}>
                {columns.map(col => (
                  <td key={col} style={{ padding: "6px 10px", maxWidth: 200, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: row[col] === null ? "var(--color-text-secondary)" : "var(--color-text-primary)" }}>
                    {row[col] === null ? <span style={{ fontStyle: "italic", color: "#ef4444" }}>null</span> : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
              border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-primary)",
              color: "var(--color-text-primary)" }}>← Prev</button>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            Page {page + 1} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
              border: "1px solid var(--color-border-tertiary)", background: "var(--color-background-primary)",
              color: "var(--color-text-primary)" }}>Next →</button>
        </div>
      )}
    </div>
  );
}

function ColumnProfile({ cols }) {
  const [open, setOpen] = useState(null);
  if (!cols) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {cols.map((c, i) => (
        <div key={c.name} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8,
          background: "var(--color-background-primary)", overflow: "hidden" }}>
          <div onClick={() => setOpen(open === i ? null : i)}
            style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 500, fontSize: 13, flex: 1, minWidth: 80 }}>{c.name}</span>
            <Badge color={c.inferred_type === "numeric" ? "blue" : c.inferred_type === "datetime" ? "green" : "gray"}>
              {c.inferred_type}
            </Badge>
            {c.missing_pct > 0 && <Badge color={c.missing_pct > 30 ? "red" : "amber"}>{fmt(c.missing_pct)}% null</Badge>}
            {c.outlier_count > 0 && <Badge color="amber">{c.outlier_count} outliers</Badge>}
            {c.has_mixed_case && <Badge color="gray">mixed case</Badge>}
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
              {fmtN(c.unique_count)} unique
            </span>
            <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{open === i ? "▲" : "▼"}</span>
          </div>
          {open === i && (
            <div style={{ padding: "0 14px 12px", borderTop: "0.5px solid var(--color-border-tertiary)" }}>
              <div style={{ marginTop: 10 }}>
                <MiniBar pct={c.missing_pct} color={c.missing_pct > 30 ? "#ef4444" : "#f59e0b"} />
                <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                  {fmtN(c.missing_count)} missing ({fmt(c.missing_pct)}%)
                </span>
              </div>
              {c.mean != null && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px,1fr))", gap: 8, marginTop: 10 }}>
                  {[["min", c.min], ["mean", c.mean], ["median", c.median], ["max", c.max], ["std", c.std], ["skew", c.skewness]].map(([k, v]) => (
                    <div key={k} style={{ background: "var(--color-background-secondary)", borderRadius: 6, padding: "6px 8px" }}>
                      <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{fmt(v, 3)}</div>
                    </div>
                  ))}
                </div>
              )}
              {c.most_common && Object.keys(c.most_common).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Top values: </span>
                  {Object.entries(c.most_common).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 11, background: "var(--color-background-secondary)",
                      borderRadius: 4, padding: "2px 6px", marginRight: 4, marginBottom: 4, display: "inline-block" }}>
                      {k} ({v})
                    </span>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Samples: </span>
                {c.sample_values?.map((v, i) => (
                  <span key={i} style={{ fontSize: 11, background: "var(--color-background-secondary)",
                    borderRadius: 4, padding: "2px 6px", marginRight: 4, display: "inline-block" }}>{v}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CleaningPanel({ sessionId, onCleaned, columns }) {
  const [cfg, setCfg] = useState({
    remove_duplicates: false,
    missing_strategy: "none",
    missing_fill_value: "",
    missing_threshold: "",
    fix_dtypes: false,
    standardize_strings: false,
    string_case: "title",
    handle_outliers: "none",
    outlier_method: "iqr",
  });
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState(null);

  const toggle = (k) => setCfg(c => ({ ...c, [k]: !c[k] }));
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const run = async () => {
    setLoading(true);
    try {
      const payload = { ...cfg };
      if (payload.missing_threshold) payload.missing_threshold = parseFloat(payload.missing_threshold);
      const r = await fetch(`${API}/clean/${sessionId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setLog(data.log);
      onCleaned(data);
    } catch (e) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const label = (text) => (
    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>{text}</span>
  );

  const Opt = ({ k, children }) => (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0" }}>
      <input type="checkbox" checked={cfg[k]} onChange={() => toggle(k)} style={{ cursor: "pointer" }} />
      <span style={{ fontSize: 13 }}>{children}</span>
    </label>
  );

  const section = (title, children) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
        color: "var(--color-text-secondary)", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      {section("Duplicates & Structure",
        <Opt k="remove_duplicates">Remove duplicate rows</Opt>
      )}
      {section("Missing Values",
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["none","drop_rows","mean","median","mode","ffill","bfill","constant"].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                <input type="radio" name="ms" value={s} checked={cfg.missing_strategy === s}
                  onChange={() => set("missing_strategy", s)} />
                {s.replace("_", " ")}
              </label>
            ))}
          </div>
          {cfg.missing_strategy === "constant" && (
            <input placeholder="Fill value" value={cfg.missing_fill_value}
              onChange={e => set("missing_fill_value", e.target.value)}
              style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 12, width: 140 }}
            />
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Drop cols with &gt;</span>
            <input type="number" placeholder="e.g. 50" value={cfg.missing_threshold}
              onChange={e => set("missing_threshold", e.target.value)}
              style={{ width: 70, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border-tertiary)",
                background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>% missing</span>
          </div>
        </div>
      )}
      {section("Data Types & Strings",
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Opt k="fix_dtypes">Auto-fix data types (numeric, datetime)</Opt>
          <Opt k="standardize_strings">Standardize strings</Opt>
          {cfg.standardize_strings && (
            <div style={{ display: "flex", gap: 8, marginLeft: 22 }}>
              {["lower","upper","title"].map(c => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                  <input type="radio" name="sc" value={c} checked={cfg.string_case === c}
                    onChange={() => set("string_case", c)} />
                  {c}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {section("Outliers",
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["none","remove","cap"].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 12 }}>
                <input type="radio" name="oa" value={s} checked={cfg.handle_outliers === s}
                  onChange={() => set("handle_outliers", s)} />
                {s}
              </label>
            ))}
          </div>
          {cfg.handle_outliers !== "none" && (
            <div style={{ display: "flex", gap: 8 }}>
              {["iqr","zscore"].map(m => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                  <input type="radio" name="om" value={m} checked={cfg.outlier_method === m}
                    onChange={() => set("outlier_method", m)} />
                  {m.toUpperCase()}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={run} disabled={loading}
        style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#9ca3af" : "#6366f1", color: "white", fontWeight: 600, fontSize: 14, marginTop: 4 }}>
        {loading ? "Cleaning…" : "▶ Run Cleaning"}
      </button>

      {log && log.length > 0 && (
        <div style={{ marginTop: 14, border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", background: "var(--color-background-secondary)", fontSize: 11,
            fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-secondary)" }}>
            Cleaning Log
          </div>
          {log.map((entry, i) => (
            <div key={i} style={{ padding: "8px 12px", borderTop: i > 0 ? "0.5px solid var(--color-border-tertiary)" : "none",
              display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: "#22c55e", fontSize: 13, marginTop: 1 }}>✓</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{entry.action}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{entry.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");

  // Data states
  const [analysis, setAnalysis] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cleanResult, setCleanResult] = useState(null);
  const [qualityScore, setQualityScore] = useState(null);
  const [insights, setInsights] = useState(null);
  const [vizData, setVizData] = useState(null);
  const [apiConnected, setApiConnected] = useState(null);

  const fileRef = useRef();

  useEffect(() => {
    fetch(`${API}/health`).then(() => setApiConnected(true)).catch(() => setApiConnected(false));
  }, []);

  const onUpload = useCallback(async (file) => {
    if (!file) return;
    setLoading(true); setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`${API}/upload`, { method: "POST", body: fd });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setSessionId(data.session_id);
      setFileName(data.filename);
      setAnalysis(data.analysis);
      setPreview(data.preview);
      setCleanResult(null);
      setTab("overview");
      // Fetch quality score
      const qs = await fetch(`${API}/quality-score/${data.session_id}`).then(r => r.json());
      setQualityScore(qs);
      // Fetch insights
      const ins = await fetch(`${API}/insights/${data.session_id}`).then(r => r.json());
      setInsights(ins);
      // Fetch viz data
      const vd = await fetch(`${API}/visualize/${data.session_id}`).then(r => r.json());
      setVizData(vd);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  const onCleaned = async (result) => {
    setCleanResult(result);
    setPreview(result.preview);
    // Refresh quality score & insights
    const qs = await fetch(`${API}/quality-score/${sessionId}`).then(r => r.json());
    setQualityScore(qs);
    const ins = await fetch(`${API}/insights/${sessionId}`).then(r => r.json());
    setInsights(ins);
    const vd = await fetch(`${API}/visualize/${sessionId}`).then(r => r.json());
    setVizData(vd);
    // Refresh analysis
    const an = await fetch(`${API}/analyze/${sessionId}`).then(r => r.json());
    setAnalysis(an);
    setTab("metrics");
  };

  const handleUndo = async () => {
    const r = await fetch(`${API}/undo/${sessionId}`, { method: "POST" }).then(r => r.json());
    if (r.success) { setPreview(r.preview); setCleanResult(null); }
  };

  const handleReset = async () => {
    if (!confirm("Reset all cleaning steps?")) return;
    const r = await fetch(`${API}/reset/${sessionId}`, { method: "POST" }).then(r => r.json());
    if (r.success) { setPreview(r.preview); setCleanResult(null);
      const an = await fetch(`${API}/analyze/${sessionId}`).then(r => r.json());
      setAnalysis(an);
    }
  };

  const download = (fmt) => window.open(`${API}/download/${sessionId}?format=${fmt}`, "_blank");

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "profile", label: "Column Profile" },
    { id: "clean", label: "Clean" },
    { id: "metrics", label: "Metrics" },
    { id: "insights", label: "Insights" },
    { id: "visualize", label: "Visualize" },
    { id: "data", label: "Data View" },
  ];

  const sm = analysis?.summary;
  const isDemoMode = apiConnected === false;

  return (
    <div style={{ fontFamily: "'Inter', 'system-ui', sans-serif", minHeight: "100vh",
      background: "var(--color-background-tertiary)", color: "var(--color-text-primary)" }}>

      {/* Header */}
      <div style={{ background: "var(--color-background-primary)",
        borderBottom: "1px solid var(--color-border-tertiary)", padding: "12px 24px",
        display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#6366f1",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 16 }}>
            ◈
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1 }}>DataCleaner Pro</div>
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>Automated Data Cleaning & Analysis</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {fileName && <Badge color="blue">{fileName}</Badge>}
        {apiConnected === false && <Badge color="red">Backend offline — demo mode</Badge>}
        {apiConnected === true && <Badge color="green">API connected</Badge>}
        {sessionId && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleUndo} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6,
              border: "1px solid var(--color-border-tertiary)", background: "transparent", cursor: "pointer",
              color: "var(--color-text-primary)" }}>↩ Undo</button>
            <button onClick={handleReset} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6,
              border: "1px solid var(--color-border-tertiary)", background: "transparent", cursor: "pointer",
              color: "var(--color-text-primary)" }}>↺ Reset</button>
            <button onClick={() => download("csv")} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6,
              border: "none", background: "#6366f1", color: "white", cursor: "pointer" }}>⬇ CSV</button>
            <button onClick={() => download("xlsx")} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6,
              border: "none", background: "#06b6d4", color: "white", cursor: "pointer" }}>⬇ Excel</button>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>

        {/* Upload Zone */}
        {!sessionId && (
          <div style={{ marginBottom: 24 }}>
            <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed var(--color-border-secondary)", borderRadius: 16,
                padding: "48px 24px", textAlign: "center", cursor: "pointer",
                background: "var(--color-background-primary)", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                Drop your CSV or Excel file here
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
                or click to browse · Supports .csv, .xlsx, .xls
              </div>
              <button style={{ padding: "8px 20px", borderRadius: 8, border: "none",
                background: "#6366f1", color: "white", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                Browse File
              </button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
                onChange={e => onUpload(e.target.files[0])} />
            </div>
            {isDemoMode && (
              <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 8,
                background: "var(--color-background-secondary)", border: "1px solid var(--color-border-tertiary)",
                fontSize: 13, color: "var(--color-text-secondary)" }}>
                <strong>👋 Demo mode:</strong> The Flask backend isn't running. Start it with <code>python app.py</code> to use the full tool.
                The architecture, code, and all components are fully functional — just needs the backend running.
              </div>
            )}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1s linear infinite" }}>⟳</div>
            <div style={{ color: "var(--color-text-secondary)" }}>Analyzing dataset…</div>
          </div>
        )}

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: 8, background: "#fee2e2",
            color: "#dc2626", marginBottom: 16, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* Tabs */}
        {sessionId && !loading && (
          <>
            <div style={{ display: "flex", gap: 2, marginBottom: 20, flexWrap: "wrap",
              borderBottom: "1px solid var(--color-border-tertiary)", paddingBottom: 0 }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ padding: "8px 16px", border: "none", borderRadius: "6px 6px 0 0",
                    cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                    background: tab === t.id ? "var(--color-background-primary)" : "transparent",
                    color: tab === t.id ? "#6366f1" : "var(--color-text-secondary)",
                    borderBottom: tab === t.id ? "2px solid #6366f1" : "2px solid transparent",
                    marginBottom: -1 }}>
                  {t.label}
                  {t.id === "insights" && insights?.observations?.length > 0 &&
                    <span style={{ marginLeft: 5, background: "#ef4444", color: "white",
                      borderRadius: 8, padding: "1px 5px", fontSize: 10 }}>
                      {insights.observations.length}
                    </span>}
                </button>
              ))}
            </div>

            {/* OVERVIEW TAB */}
            {tab === "overview" && sm && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 20 }}>
                  <StatCard label="Rows" value={fmtN(sm.rows)} />
                  <StatCard label="Columns" value={fmtN(sm.columns)} />
                  <StatCard label="Missing Cells" value={fmtN(sm.missing_cells)}
                    sub={`${fmt(sm.missing_pct)}%`} accent={sm.missing_pct > 10 ? "#ef4444" : undefined} />
                  <StatCard label="Duplicates" value={fmtN(sm.duplicate_rows)}
                    sub={`${fmt(sm.duplicate_pct)}%`} accent={sm.duplicate_rows > 0 ? "#f59e0b" : undefined} />
                  <StatCard label="Numeric Cols" value={sm.numeric_columns} />
                  <StatCard label="Text Cols" value={sm.categorical_columns} />
                </div>

                {qualityScore && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Data Quality Score</div>
                    <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
                      <Gauge value={qualityScore.current_score?.total || 0} label="Overall" size={90} />
                      <Gauge value={qualityScore.current_score?.completeness || 0} label="Completeness" size={90} />
                      <Gauge value={qualityScore.current_score?.uniqueness || 0} label="Uniqueness" size={90} />
                      <Gauge value={qualityScore.current_score?.consistency || 0} label="Consistency" size={90} />
                      <Gauge value={qualityScore.current_score?.cleanliness || 0} label="Cleanliness" size={90} />
                    </div>
                  </div>
                )}

                {analysis?.outliers?.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Outlier Summary</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {analysis.outliers.map(o => (
                        <div key={o.column} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, width: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{o.column}</span>
                          <div style={{ flex: 1 }}>
                            <MiniBar pct={o.iqr_pct} color="#f59e0b" />
                          </div>
                          <Badge color="amber">{o.iqr_outliers} IQR</Badge>
                          <Badge color="gray">{o.zscore_outliers} Z</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PROFILE TAB */}
            {tab === "profile" && (
              <ColumnProfile cols={analysis?.columns} />
            )}

            {/* CLEAN TAB */}
            {tab === "clean" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                  border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Manual Cleaning Options</div>
                  <CleaningPanel sessionId={sessionId} onCleaned={onCleaned}
                    columns={analysis?.columns?.map(c => c.name)} />
                </div>
                {insights?.auto_clean_suggestions?.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>🤖 AI-Suggested Cleanings</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {insights.auto_clean_suggestions.map((s, i) => (
                        <div key={i} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8,
                          padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12 }}>{s.label}</span>
                          <button onClick={async () => {
                            const r = await fetch(`${API}/clean/${sessionId}`, {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(s.config)
                            }).then(r => r.json());
                            if (!r.error) onCleaned(r);
                          }} style={{ padding: "4px 12px", borderRadius: 6, border: "none",
                            background: "#6366f1", color: "white", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* METRICS TAB */}
            {tab === "metrics" && (
              <div>
                {cleanResult ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                      border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#ef4444" }}>Before Cleaning</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <StatCard label="Rows" value={fmtN(cleanResult.before.rows)} />
                        <StatCard label="Missing" value={fmtN(cleanResult.before.missing_cells)} sub={`${fmt(cleanResult.before.missing_pct)}%`} />
                        <StatCard label="Duplicates" value={fmtN(cleanResult.before.duplicate_rows)} />
                        <StatCard label="Missing %" value={`${fmt(cleanResult.before.missing_pct)}%`} />
                      </div>
                    </div>
                    <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                      border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#22c55e" }}>After Cleaning</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <StatCard label="Rows" value={fmtN(cleanResult.after.rows)} />
                        <StatCard label="Missing" value={fmtN(cleanResult.after.missing_cells)} sub={`${fmt(cleanResult.after.missing_pct)}%`} accent="#22c55e" />
                        <StatCard label="Duplicates" value={fmtN(cleanResult.after.duplicate_rows)} accent="#22c55e" />
                        <StatCard label="Missing %" value={`${fmt(cleanResult.after.missing_pct)}%`} accent="#22c55e" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 32, textAlign: "center", color: "var(--color-text-secondary)" }}>
                    Run a cleaning operation first to see before/after metrics.
                  </div>
                )}
                {qualityScore && cleanResult && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Quality Score Improvement</div>
                    <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>Original</div>
                        <Gauge value={qualityScore.original_score?.total || 0} label={`${qualityScore.original_score?.total || 0}`} size={80} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", padding: "0 16px" }}>
                        <div style={{ fontSize: 24, color: "#22c55e" }}>→</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>Current</div>
                        <Gauge value={qualityScore.current_score?.total || 0} label={`${qualityScore.current_score?.total || 0}`} size={80} />
                      </div>
                      {qualityScore.improvement !== 0 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 700,
                            color: qualityScore.improvement > 0 ? "#22c55e" : "#ef4444" }}>
                            {qualityScore.improvement > 0 ? "+" : ""}{qualityScore.improvement} pts
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INSIGHTS TAB */}
            {tab === "insights" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {insights?.observations?.map((obs, i) => {
                  const colors = { warning: { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" },
                    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
                    success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" } };
                  const c = colors[obs.type] || colors.info;
                  return (
                    <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`,
                      borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{obs.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: c.text, marginBottom: 2 }}>{obs.title}</div>
                        <div style={{ fontSize: 12, color: c.text, opacity: 0.85 }}>{obs.text}</div>
                      </div>
                    </div>
                  );
                })}
                {insights?.recommendations?.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px", marginTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📋 Recommendations for Next Steps</div>
                    {insights.recommendations.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13 }}>
                        <span style={{ color: "#6366f1", flexShrink: 0 }}>→</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VISUALIZE TAB */}
            {tab === "visualize" && vizData && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {vizData.distributions?.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Distribution Plots</div>
                    <DistributionChart data={vizData.distributions} />
                  </div>
                )}
                {vizData.correlation && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Correlation Heatmap</div>
                    <CorrelationHeatmap data={vizData.correlation} />
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)" }}>
                      <span style={{ color: "#6366f1" }}>■</span> Positive &nbsp;
                      <span style={{ color: "#ef4444" }}>■</span> Negative &nbsp; Darker = stronger
                    </div>
                  </div>
                )}
                {vizData.missing_heatmap?.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Missing Values by Column</div>
                    {vizData.missing_heatmap.map(m => (
                      <div key={m.column} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ width: 130, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" }}>{m.column}</span>
                        <div style={{ flex: 1 }}><MiniBar pct={m.pct} color={m.pct > 30 ? "#ef4444" : "#f59e0b"} /></div>
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", width: 50, textAlign: "right" }}>
                          {fmt(m.pct)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {vizData.top_categoricals?.length > 0 && (
                  <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                    border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Top Categorical Values</div>
                    <BarChart items={vizData.top_categoricals} />
                  </div>
                )}
              </div>
            )}

            {/* DATA VIEW TAB */}
            {tab === "data" && (
              <div style={{ background: "var(--color-background-primary)", borderRadius: 12,
                border: "0.5px solid var(--color-border-tertiary)", padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
                  {cleanResult ? "Cleaned Dataset" : "Raw Dataset Preview"}
                </div>
                <DataTable tableData={preview} />
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        button:hover { opacity: 0.88; }
        input[type=checkbox] { width: 14px; height: 14px; accent-color: #6366f1; }
        input[type=radio] { accent-color: #6366f1; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
