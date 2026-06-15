/* Pages B — Builds, Costs, Projects, Settings. Requires window globals. */
(function () {
  const { useState, useMemo } = React;
  const Icon = window.Icon;
  const SY = window.SY;
  const { Select, Toggle, CopyBtn, AreaChart, HBars } = window;
  const StatCard = window.StatCard;
  const PRJ = SY.PROJECTS;

  /* ============== BUILDS ============== */
  function BuildRow({ b, open, onToggle }) {
    const proj = PRJ[b.proj];
    return (
      <div className="card" style={{ overflow: "hidden", borderColor: open ? "var(--line-strong)" : undefined }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,1fr) 120px minmax(0,2.4fr) 90px 120px auto", alignItems: "center", gap: 14, padding: "15px 16px", cursor: "pointer" }} onClick={onToggle}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 13.5 }}>
              <Icon name="chevron-right" size={14} style={{ color: "var(--tx-faint)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              PR #{b.pr} {b.slug || ""}<span className="mono" style={{ color: "var(--tx-dim)", fontSize: 11.5, fontWeight: 400 }}>{proj.name}</span>
            </div>
            <div className="meta" style={{ marginTop: 5, paddingLeft: 22 }}><Icon name="git-branch" />{b.branch}</div>
          </div>
          <span className="mono" style={{ fontSize: 12, color: "var(--tx-mid)" }}><Icon name="git-commit" size={12} style={{ verticalAlign: "-2px", marginRight: 5, color: "var(--tx-faint)" }} />{b.commit}</span>
          <div className="errline"><Icon name="chevron-right" size={13} className="chev" /><span className="etext">{b.error}</span></div>
          <span className="mono" style={{ fontSize: 12, color: "var(--tx-dim)" }}>{b.dur}</span>
          <span className="mono" style={{ fontSize: 12, color: "var(--tx-faint)" }}>{b.time}</span>
          <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); }}><Icon name="refresh" size={13} />Retry</button>
        </div>
        {open && (
          <div style={{ padding: "0 16px 16px" }}>
            <div className="term">
              <div className="term-bar"><div className="term-dots"><i style={{ background: "#ff5f57" }}></i><i style={{ background: "#febc2e" }}></i><i style={{ background: "#28c840" }}></i></div><span className="term-title">build log · {b.commit} · exit 1</span><span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--red)" }}>FAILED</span></div>
              <div className="term-body">
                {b.log.map((l, i) => <div key={i} className="term-line"><span className="term-ln">{i + 1}</span><span className={l[0]}>{l[1]}</span></div>)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
              <button className="btn btn-primary btn-sm"><Icon name="refresh" size={13} />Retry build</button>
              <button className="btn btn-ghost btn-sm"><Icon name="github" size={13} />Open PR</button>
              <button className="btn btn-outline btn-sm"><Icon name="copy" size={13} />Copy log</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function Builds() {
    const [q, setQ] = useState("");
    const [all, setAll] = useState(false);
    const [open, setOpen] = useState(0);
    const list = useMemo(() => SY.builds.filter((b) =>
      !q || (b.commit + b.branch + b.error + PRJ[b.proj].name).toLowerCase().includes(q.toLowerCase())
    ), [q]);
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Builds</h1>
            <p className="psub">Triage failed container builds and re-run them in one click.</p>
          </div>
          <div className="phead-r">
            <div className="search"><Icon name="search" /><input placeholder="Filter preview or commit…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Toggle on={all} onChange={setAll} label="Show all builds" />
          </div>
        </div>

        <div className="grid cols-4" style={{ marginBottom: 18 }}>
          <StatCard label="Failed builds" value="2" foot="last 100 deploys" icon="alert-circle" />
          <StatCard label="Build success" value="98%" foot="rolling 30 days" icon="check-circle" iconTone="green" delta={{ dir: "up", txt: "+1.2" }} />
          <StatCard label="Avg build time" value="1m 09s" foot="across previews" icon="clock" />
          <StatCard label="Retries today" value="3" foot="2 recovered" icon="refresh" iconTone="blue" />
        </div>

        <div className="panel" style={{ padding: "13px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 11 }}>
          <span className="stat-ic" style={{ color: "var(--red)", background: "var(--red-soft)", borderColor: "var(--red-line)" }}><Icon name="x-octagon" size={15} /></span>
          <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>2 failed builds in the last 100 deployments</div>
          <div style={{ color: "var(--tx-dim)", fontSize: 12, marginTop: 2 }}>Both are type errors caught before image export — no compute wasted on deploy.</div></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.length ? list.map((b, i) => <BuildRow key={i} b={b} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />)
            : <div className="empty">No builds match “{q}”.</div>}
        </div>
      </div>
    );
  }

  /* ============== COSTS ============== */
  function Costs() {
    const t = SY.team;
    const pct = Math.min(100, (t.spend / t.budget) * 100);
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Costs</h1>
            <p className="psub">Estimated compute spend for the current billing month.</p>
          </div>
          <div className="phead-r"><span className="daterange">May 31, 2026 → Jun 30, 2026</span></div>
        </div>

        <div className="grid cols-3" style={{ marginBottom: 18 }}>
          <StatCard label="Total spend" value="$13.85" foot="month to date" icon="coin" iconTone="acc"
            spark={[3,2.4,2,2.3,2.1,1.2,0.9]} sparkColor="var(--acc)" delta={{ dir: "down", txt: "-18%" }} />
          <StatCard label="Projects with spend" value="2" foot="of 2 active" icon="folder" />
          <StatCard label="Teams over budget" value="0" foot="1 team total" icon="users" iconTone="green" delta={{ dir: "flat", txt: "ok" }} />
        </div>

        <div className="two-col" style={{ gridTemplateColumns: "1.25fr 1fr", marginBottom: 18 }}>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Icon name="trending-up" size={16} />Spend over time</span><span className="panel-act mono" style={{ fontSize: 11, color: "var(--tx-dim)" }}>USD / day</span></div>
            <div style={{ padding: "18px 18px 12px" }}><AreaChart series={SY.spendSeries} color="var(--acc)" height={230} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Icon name="activity" size={16} />Spend by project</span><span className="panel-act mono" style={{ fontSize: 11, color: "var(--tx-dim)" }}>top this month</span></div>
            <div style={{ padding: "26px 20px" }}>
              <HBars data={SY.spendByProject} max={12} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ color: "var(--tx-dim)", fontSize: 12 }}>Total across projects</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>$13.85</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 18 }}>
          <div className="panel-head"><span className="panel-title"><Icon name="users" size={16} />Team budgets</span><span className="panel-act mono" style={{ fontSize: 11, color: "var(--tx-dim)" }}>monthly</span></div>
          <div style={{ padding: "18px 20px" }}>
            <div className="bud">
              <div className="bud-head"><span className="bud-name">Acme</span><span className="bud-val"><b>${t.spend.toFixed(2)}</b> / ${t.budget.toFixed(2)}</span></div>
              <div className="bud-track"><div className="bud-fill" style={{ width: pct + "%" }}></div></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--green)" }}>{pct.toFixed(1)}% used · healthy</span>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--tx-faint)" }}>${(t.budget - t.spend).toFixed(2)} remaining</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title"><Icon name="folder" size={16} />By project</span></div>
          <table className="dtable">
            <thead><tr><th>Project</th><th>Active previews</th><th>Builds</th><th style={{ textAlign: "right" }}>Estimated</th></tr></thead>
            <tbody>
              {SY.projectCostRows.map((r) => (
                <tr key={r.name} style={{ cursor: "default" }}>
                  <td><span style={{ fontWeight: 600 }}>{r.name}</span></td>
                  <td><span className="c-mono">{r.previews}</span></td>
                  <td><span className="c-mono">{r.builds}</span></td>
                  <td style={{ textAlign: "right" }}><span className="mono" style={{ fontWeight: 600 }}>${r.est.toFixed(2)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* ============== PROJECTS ============== */
  function ProjectCard({ p }) {
    const counts = SY.previews.filter((x) => x.proj === p.id);
    const active = counts.filter((x) => ["running", "building", "deploying"].includes(x.status)).length;
    return (
      <div className="card proj-card">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--panel-3)", border: "1px solid var(--line)", color: "var(--tx-mid)", flex: "none" }}>
            <Icon name="cube" size={18} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</span>
              <span className="tag"><Icon name="github" size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />Github</span>
            </div>
            <div className="meta" style={{ marginTop: 5 }}><Icon name="github" />{p.repo}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="pill"><Icon name="git-branch" size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{p.branch}</span>
          <span className="pill"><Icon name="box" size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{p.framework}</span>
        </div>
        <div style={{ display: "flex", gap: 26, padding: "12px 0", borderTop: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }}>
          <div className="proj-stat"><span className="n">{active}</span><span className="l">active previews</span></div>
          <div className="proj-stat"><span className="n">{counts.length}</span><span className="l">total previews</span></div>
          <div className="proj-stat"><span className="n" style={{ color: "var(--green)" }}>●</span><span className="l">last deploy ok</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="pv-time">Updated 1 day ago</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}><Icon name="sliders" size={13} />Manage</button>
        </div>
      </div>
    );
  }

  function Projects() {
    const [q, setQ] = useState("");
    const [sort, setSort] = useState("active");
    const list = Object.values(PRJ).filter((p) => !q || (p.name + p.repo).toLowerCase().includes(q.toLowerCase()));
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Projects</h1>
            <p className="psub">Connected repositories and their preview-environment settings.</p>
          </div>
          <div className="phead-r">
            <div className="search"><Icon name="search" /><input placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <Select value={sort} options={[{ value: "active", label: "Active" }, { value: "name", label: "Name" }, { value: "updated", label: "Last updated" }]} onChange={setSort} icon="filter" width={170} />
            <button className="btn btn-primary"><Icon name="plus" size={15} />Connect repo</button>
          </div>
        </div>
        <div className="grid cols-3">
          {list.map((p) => <ProjectCard key={p.id} p={p} />)}
          <div className="card proj-new">
            <div style={{ textAlign: "center", color: "var(--tx-dim)" }}>
              <Icon name="plus" size={22} style={{ color: "var(--acc-bright)" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-mid)", marginTop: 8 }}>Connect a repository</div>
              <div style={{ fontSize: 11.5, marginTop: 3 }} className="mono">github · gitlab · bitbucket</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============== SETTINGS ============== */
  function Settings() {
    const t = SY.team;
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Team settings</h1>
            <p className="psub">Manage your team, members, and API access.</p>
          </div>
        </div>

        <div className="two-col" style={{ marginBottom: 18, alignItems: "start" }}>
          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Icon name="users" size={16} />Acme</span><span className="panel-act"><span className="role owner">OWNER</span></span></div>
            <div style={{ padding: "6px 18px 16px" }}>
              <div className="kv"><span className="kv-k">Slug</span><span className="kv-v mono">{t.slug}</span></div>
              <div className="kv"><span className="kv-k">Monthly budget</span><span className="kv-v mono">${t.budget.toFixed(2)}</span></div>
              <div className="kv"><span className="kv-k">Members</span><span className="kv-v mono">{SY.members.length}</span></div>
              <div className="kv"><span className="kv-k">Created</span><span className="kv-v mono">{t.created}</span></div>
              <div className="kv"><span className="kv-k">Team ID</span><span className="kv-v"><span className="mono">{t.id}</span><CopyBtn text={t.id} /></span></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><span className="panel-title"><Icon name="users" size={16} />Members</span><span className="panel-act"><button className="btn btn-ghost btn-sm"><Icon name="plus" size={13} />Invite</button></span></div>
            <div style={{ padding: "8px 14px 12px" }}>
              {SY.members.map((m) => (
                <div key={m.handle} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 4px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="avatar-sm" style={{ background: m.grad }}>{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
                  <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div><div className="mono" style={{ fontSize: 11, color: "var(--tx-dim)" }}>@{m.handle}</div></div>
                  <span className={"role " + (m.role === "OWNER" ? "owner" : "member")}>{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title"><Icon name="key" size={16} />API tokens</span>
            <span className="panel-act"><button className="btn btn-primary btn-sm"><Icon name="plus" size={13} />Create token</button></span>
          </div>
          <table className="dtable">
            <thead><tr><th>Name</th><th>Prefix</th><th>Last used</th><th>Expires</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
            <tbody>
              {SY.tokens.map((tk) => (
                <tr key={tk.name} style={{ cursor: "default" }}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Icon name="key" size={14} style={{ color: "var(--tx-dim)" }} /><span style={{ fontWeight: 600 }}>{tk.name}</span></div></td>
                  <td><span className="c-mono">{tk.prefix}</span></td>
                  <td><span className="c-mono" style={{ color: "var(--tx-dim)" }}>{tk.used}</span></td>
                  <td><span className="c-mono" style={{ color: "var(--tx-dim)" }}>{tk.expires}</span></td>
                  <td style={{ textAlign: "right" }}><button className="copybtn" style={{ marginLeft: "auto" }}><Icon name="trash" size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "13px 16px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 9, color: "var(--tx-dim)" }}>
            <Icon name="shield" size={14} /><span style={{ fontSize: 12 }} className="mono">Tokens are shown once at creation. Store them securely.</span>
          </div>
        </div>
      </div>
    );
  }

  Object.assign(window, { Builds, Costs, Projects, Settings });
})();
