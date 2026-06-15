/* Shared components — exposed on window. Requires window.Icon, window.SY */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;
  const Icon = window.Icon;
  const SY = window.SY;

  /* ---------- status badge ---------- */
  function StatusBadge({ status, live, size }) {
    const meta = SY.STATUS[status] || { label: status, tone: "gray", live: false };
    const isLive = live !== undefined ? live : meta.live;
    return (
      <span className={"badge b-" + meta.tone + (isLive ? " live" : "")} style={size === "sm" ? { fontSize: 10, padding: "2px 7px 2px 6px" } : null}>
        <span className="bdot"></span>{meta.label}
      </span>
    );
  }

  /* ---------- click-outside hook ---------- */
  function useOutside(ref, onClose, active) {
    useEffect(() => {
      if (!active) return;
      function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
      function k(e) { if (e.key === "Escape") onClose(); }
      document.addEventListener("mousedown", h);
      document.addEventListener("keydown", k);
      return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
    }, [active]);
  }

  /* ---------- generic dropdown ---------- */
  function Dropdown({ trigger, children, align = "left", width }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useOutside(ref, () => setOpen(false), open);
    return (
      <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
        {trigger(open, () => setOpen(!open))}
        {open && (
          <div className="menu" style={{ top: "calc(100% + 6px)", [align]: 0, minWidth: width || 190 }}
               onClick={(e) => { if (e.target.closest(".menu-item")) setOpen(false); }}>
            {typeof children === "function" ? children(() => setOpen(false)) : children}
          </div>
        )}
      </div>
    );
  }

  /* ---------- select (filter) ---------- */
  function Select({ value, options, onChange, icon, width }) {
    const cur = options.find((o) => o.value === value);
    return (
      <Dropdown align="right" width={width || 190} trigger={(open, toggle) => (
        <button className="selectbtn" onClick={toggle}>
          {icon && <Icon name={icon} className="sel-ic" />}
          <span>{cur ? cur.label : value}</span>
          <Icon name="chevron-down" className="cv" />
        </button>
      )}>
        {options.map((o) => (
          <div key={o.value} className={"menu-item" + (o.value === value ? " active" : "")} onClick={() => onChange(o.value)}>
            <span>{o.label}</span>
            {o.value === value && <Icon name="check" size={15} className="chk" />}
          </div>
        ))}
      </Dropdown>
    );
  }

  /* ---------- copy button ---------- */
  function CopyBtn({ text }) {
    const [done, setDone] = useState(false);
    return (
      <button className={"copybtn" + (done ? " done" : "")} onClick={() => {
        try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (e) {}
        setDone(true); setTimeout(() => setDone(false), 1300);
      }}>
        <Icon name={done ? "check" : "copy"} size={13} />
      </button>
    );
  }

  /* ---------- toggle ---------- */
  function Toggle({ on, onChange, label }) {
    return (
      <div className={"toggle" + (on ? " on" : "")} onClick={() => onChange(!on)}>
        <span className="tk"></span>{label && <span>{label}</span>}
      </div>
    );
  }

  /* ---------- sparkline ---------- */
  function Sparkline({ data, color = "var(--acc)", w = 78, h = 26, fill = true }) {
    const max = Math.max(...data), min = Math.min(...data);
    const rng = max - min || 1;
    const pts = data.map((v, i) => [ (i / (data.length - 1)) * w, h - 2 - ((v - min) / rng) * (h - 4) ]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = line + ` L${w} ${h} L0 ${h} Z`;
    const id = "sg" + Math.random().toString(36).slice(2, 7);
    return (
      <svg className="stat-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient></defs>
        {fill && <path d={area} fill={`url(#${id})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }

  /* ---------- area chart (costs) ---------- */
  function AreaChart({ series, color = "var(--acc)", height = 230 }) {
    const W = 640, H = height, padL = 40, padR = 14, padT = 16, padB = 28;
    const vals = series.map((s) => s.v);
    const max = Math.ceil(Math.max(...vals, 1));
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const x = (i) => padL + (i / (series.length - 1)) * innerW;
    const y = (v) => padT + innerH - (v / max) * innerH;
    // smooth path
    const pts = series.map((s, i) => [x(i), y(s.v)]);
    function smooth(p) {
      let d = `M${p[0][0]} ${p[0][1]}`;
      for (let i = 1; i < p.length; i++) {
        const x0 = p[i - 1][0], y0 = p[i - 1][1], x1 = p[i][0], y1 = p[i][1];
        const cx = (x0 + x1) / 2;
        d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
      }
      return d;
    }
    const line = smooth(pts);
    const area = line + ` L${x(series.length - 1)} ${padT + innerH} L${padL} ${padT + innerH} Z`;
    const ticks = [0, max / 2, max];
    return (
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.32" /><stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient></defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
            <text className="axis-lbl" x={padL - 8} y={y(t) + 3} textAnchor="end">${t.toFixed(0)}</text>
          </g>
        ))}
        <path d={area} fill="url(#areaGrad)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="var(--bg)" stroke={color} strokeWidth="1.6" />)}
        {series.map((s, i) => <text key={i} className="axis-lbl" x={x(i)} y={H - 9} textAnchor="middle">{s.d.replace("Jun ", "")}</text>)}
      </svg>
    );
  }

  /* ---------- horizontal bars ---------- */
  function HBars({ data, max }) {
    const mx = max || Math.max(...data.map((d) => d.v)) * 1.15;
    return (
      <div>
        {data.map((d) => (
          <div key={d.name} className="hbar-row">
            <div className="hbar-name">{d.name}</div>
            <div className="hbar-track"><div className="hbar-fill" style={{ width: (d.v / mx) * 100 + "%", background: d.color }} /></div>
            <div className="hbar-val">${d.v.toFixed(2)}</div>
          </div>
        ))}
      </div>
    );
  }

  /* ---------- sidebar ---------- */
  function Sidebar({ active, go, counts }) {
    return (
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Icon name="anchor" size={20} strokeWidth={1.9} /></div>
          <div className="brand-text">
            <span className="brand-name">Shipyard</span>
            <span className="brand-sub">Preview Envs</span>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">Workspace</div>
          {SY.nav.map((n) => (
            <div key={n.id} className={"nav-item" + (active === n.id ? " active" : "")} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={17} />
              <span>{n.label}</span>
              {counts[n.id] != null && <span className="nav-count tnum">{counts[n.id]}</span>}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sysline"><span className="bdot pulse-dot" style={{ background: "var(--green)", color: "var(--green)", width: 7, height: 7, borderRadius: "50%", display: "inline-block" }}></span>All systems operational</div>
          <div className="sysline-sub">region · iad1 · v2.8.0</div>
        </div>
      </aside>
    );
  }

  /* ---------- topbar ---------- */
  function Topbar({ page, openCmd }) {
    const [notifOpen, setNotifOpen] = useState(false);
    const [dim, setDim] = useState(false);
    const nref = useRef(null);
    useOutside(nref, () => setNotifOpen(false), notifOpen);
    return (
      <header className="topbar">
        <div className="crumb">
          <span className="tilde">~/</span><span className="seg">{page}</span><span className="caret"></span>
        </div>
        <div className="topbar-right">
          <button className="kbar" onClick={openCmd}>
            <Icon name="search" size={15} />
            <span>Search or jump to…</span>
            <span className="kbar-hint"><span className="kbd">⌘K</span></span>
          </button>
          <Dropdown align="right" width={210} trigger={(open, toggle) => (
            <button className="teamswitch" onClick={toggle}>
              <span className="ts-avatar">AC</span><span className="ts-name">Acme</span>
              <Icon name="chevrons-up-down" size={14} />
            </button>
          )}>
            <div className="menu-label">Teams</div>
            <div className="menu-item active"><span className="ts-avatar" style={{ width: 20, height: 20 }}>AC</span><span>Acme</span><Icon name="check" size={15} className="chk" /></div>
            <div className="menu-item"><span className="ts-avatar" style={{ width: 20, height: 20, background: "linear-gradient(150deg,#4c9dff,#7c6cff)" }}>LB</span><span>Labs</span></div>
            <div className="menu-sep"></div>
            <div className="menu-item"><Icon name="plus" size={15} /><span>Create team</span></div>
          </Dropdown>
          <div ref={nref} style={{ position: "relative" }}>
            <button className="iconbtn" onClick={() => setNotifOpen(!notifOpen)}>
              <Icon name="bell" size={16} /><span className="ind"></span>
            </button>
            {notifOpen && (
              <div className="menu notif">
                <div className="menu-label" style={{ display: "flex", justifyContent: "space-between" }}><span>Notifications</span></div>
                {SY.notifications.map((n, i) => (
                  <div key={i} className="notif-item">
                    <div className="notif-ic" style={{ background: `var(--${n.tone}-soft)`, color: `var(--${n.tone})`, border: `1px solid var(--${n.tone}-line)` }}><Icon name={n.icon} size={15} /></div>
                    <div><div className="notif-tx" dangerouslySetInnerHTML={{ __html: n.html }} /><div className="notif-time">{n.time}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className="iconbtn" onClick={() => setDim(!dim)} title="Theme"><Icon name="moon" size={16} /></button>
          <div className="avatar">NC</div>
        </div>
      </header>
    );
  }

  Object.assign(window, { StatusBadge, Dropdown, Select, CopyBtn, Toggle, Sparkline, AreaChart, HBars, Sidebar, Topbar, useOutside });
})();
