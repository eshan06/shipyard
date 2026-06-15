/* Pages A — Overview, Previews, Deployments. Requires window globals. */
(function () {
  const { useState, useMemo } = React;
  const Icon = window.Icon;
  const SY = window.SY;
  const { StatusBadge, Select, Sparkline, Dropdown } = window;
  const PRJ = SY.PROJECTS;

  /* ============== OVERVIEW ============== */
  function StatCard({ label, value, unit, foot, icon, iconTone, spark, sparkColor, delta }) {
    return (
      <div className="stat">
        <div className="stat-top">
          <span className="stat-label">{label}</span>
          <span className={"stat-ic " + (iconTone || "")}><Icon name={icon} size={15} /></span>
        </div>
        <div className="stat-val tnum">{value}{unit && <span className="unit"> {unit}</span>}</div>
        <div className="stat-foot">
          {delta && <span className={"delta " + delta.dir}><Icon name={delta.dir === "up" ? "trending-up" : delta.dir === "down" ? "trending-down" : "activity"} />{delta.txt}</span>}
          <span className="mono">{foot}</span>
        </div>
        {spark && <Sparkline data={spark} color={sparkColor || "var(--acc)"} />}
      </div>
    );
  }

  function Overview({ go }) {
    const recent = SY.deployments.slice(0, 8);
    const active = SY.previews.filter((p) => ["deploying", "building", "running"].includes(p.status));
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Overview</h1>
            <p className="psub">A live snapshot of your preview environments and recent activity.</p>
          </div>
          <div className="phead-r">
            <button className="btn btn-ghost" onClick={() => go("previews")}><Icon name="layers" size={15} />View previews</button>
            <button className="btn btn-primary"><Icon name="plus" size={15} />New preview</button>
          </div>
        </div>

        <div className="grid cols-4">
          <StatCard label="Active previews" value="3" foot="9 total" icon="cube" iconTone="acc"
            spark={[2,3,2,4,3,5,3]} sparkColor="var(--acc)" delta={{ dir: "up", txt: "+2" }} />
          <StatCard label="Running" value="1" foot="2 building" icon="activity" iconTone="green"
            spark={[1,2,1,1,2,1,1]} sparkColor="var(--green)" delta={{ dir: "flat", txt: "live" }} />
          <StatCard label="Deploys today" value="5" foot="1 failed" icon="rocket" iconTone="blue"
            spark={[3,5,4,6,5,7,5]} sparkColor="var(--blue)" delta={{ dir: "up", txt: "+3" }} />
          <StatCard label="Est. monthly cost" value="$13.85" foot="current period" icon="coin"
            spark={[3,2.4,2,2.3,2.1,1.2,0.9]} sparkColor="var(--teal)" delta={{ dir: "down", txt: "-18%" }} />
        </div>

        <div className="two-col section-gap">
          {/* recent deployments timeline */}
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title"><Icon name="rocket" size={16} />Recent deployments</span>
              <span className="panel-act"><span className="link" onClick={() => go("deployments")}>View all<Icon name="arrow-up-right" /></span></span>
            </div>
            <div style={{ padding: "8px 18px 14px" }}>
              {recent.map((d, i) => {
                const meta = SY.STATUS[d.status];
                return (
                  <div key={i} className="tl-row" style={{ display: "flex", gap: 14, padding: "11px 0", borderBottom: i < recent.length - 1 ? "1px solid var(--line-soft)" : "none", alignItems: "center", cursor: "pointer" }}
                       onClick={() => go("deployments")}>
                    <div style={{ position: "relative", width: 10, flex: "none", alignSelf: "stretch", display: "flex", justifyContent: "center" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", marginTop: 4, background: `var(--${meta.tone === "gray" ? "gray" : meta.tone})`, boxShadow: `0 0 0 3px var(--${meta.tone}-soft)` }}
                            className={meta.live ? "pulse-dot" : ""}></span>
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <StatusBadge status={d.status} size="sm" />
                        <span style={{ fontWeight: 600, fontSize: 13 }}>PR #{d.pr}</span>
                        <span className="mono" style={{ color: "var(--tx-dim)", fontSize: 12 }}>{PRJ[d.proj].name}</span>
                      </div>
                      <div className="meta" style={{ marginTop: 5 }}>
                        <Icon name="git-commit" /><span>{d.commit}</span><span className="dot-sep"></span>
                        <span className="trigpill">{d.trigger}</span><span className="dot-sep"></span>
                        <span style={{ color: "var(--tx-faint)" }}>{d.time}</span>
                      </div>
                    </div>
                    <span className="mono" style={{ color: "var(--tx-dim)", fontSize: 11.5 }}>{d.dur || "—"}</span>
                    <Icon name="arrow-up-right" size={15} style={{ color: "var(--tx-faint)" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* active previews */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <div className="panel-head">
              <span className="panel-title"><Icon name="cube" size={16} />Active previews</span>
              <span className="panel-act"><span className="link" onClick={() => go("previews")}>View all<Icon name="arrow-up-right" /></span></span>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
              {active.map((p) => (
                <div key={p.pr} className="card" style={{ padding: 14, cursor: "pointer" }} onClick={() => go("previews")}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="pv-id"><span className="pr">PR #{p.pr}</span><span className="nm">{p.slug}</span></div>
                      <div className="pv-proj">{PRJ[p.proj].name} · {p.branch}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {(p.status === "building" || p.status === "deploying") && (
                    <div className="bprog" style={{ marginTop: 12 }}><i style={{ "--p": p.progress + "%", width: p.progress + "%" }}></i></div>
                  )}
                  {p.status === "running" && p.url && (
                    <div className="pv-url" style={{ marginTop: 12 }}><Icon name="globe" /><span className="u">{p.url}</span></div>
                  )}
                </div>
              ))}
              <div className="card" style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 10, color: "var(--tx-dim)" }}>
                <Icon name="check-circle" size={16} style={{ color: "var(--green)" }} />
                <span style={{ fontSize: 12.5 }}>6 idle previews · <span className="mono">$0.00/hr</span> while stopped</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ============== PREVIEWS ============== */
  function PreviewCard({ p }) {
    const proj = PRJ[p.proj];
    const meta = SY.STATUS[p.status];
    const live = p.status === "running";
    const building = p.status === "building" || p.status === "deploying";
    return (
      <div className="pvcard" style={{ "--statc": `var(--${meta.tone === "gray" ? "gray" : meta.tone})` }}>
        <div className="pv-top">
          <div style={{ minWidth: 0 }}>
            <div className="pv-id">
              {p.pinned && <Icon name="zap" size={13} className="pv-star" />}
              <span className="pr">PR #{p.pr}</span><span className="nm">{p.slug}</span>
            </div>
            <div className="pv-proj">{proj.name}</div>
          </div>
          <span className="pv-badge"><StatusBadge status={p.status} /></span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div className="meta"><Icon name="git-branch" /><span className="truncate">{p.branch}</span></div>
          <div className="meta"><Icon name="git-pull-request" /><span className="truncate" style={{ color: "var(--tx-mid)" }}>#{p.pr} {p.msg}</span></div>
        </div>

        {building && <div className="bprog indet"><i></i></div>}
        {live && p.url && <div className="pv-url"><Icon name="globe" /><span className="u">{p.url}</span></div>}

        <div className="pv-foot">
          <span className="pv-time">{p.time}</span>
          <div className="pv-actions">
            {(live || p.status === "stopped") && p.url && <button className="btn btn-ghost btn-sm">Open<Icon name="external-link" size={13} /></button>}
            <button className="btn btn-outline btn-sm">Details</button>
            <Dropdown align="right" width={180} trigger={(open, toggle) => (
              <button className="iconbtn" style={{ width: 30, height: 30 }} onClick={toggle}><Icon name="more-h" size={16} /></button>
            )}>
              {live ? <div className="menu-item"><Icon name="stop" size={15} />Stop preview</div> : <div className="menu-item"><Icon name="play" size={15} />Start preview</div>}
              <div className="menu-item"><Icon name="refresh" size={15} />Redeploy</div>
              <div className="menu-item"><Icon name="github" size={15} />Open PR</div>
              <div className="menu-sep"></div>
              <div className="menu-item danger"><Icon name="trash" size={15} />Destroy</div>
            </Dropdown>
          </div>
        </div>
      </div>
    );
  }

  function Previews() {
    const [proj, setProj] = useState("all");
    const [status, setStatus] = useState("all");
    const list = useMemo(() => SY.previews.filter((p) =>
      (proj === "all" || p.proj === proj) && (status === "all" || p.status === status)
    ), [proj, status]);
    const projOpts = [{ value: "all", label: "All projects" }, ...Object.values(PRJ).map((p) => ({ value: p.id, label: p.name }))];
    const statusOpts = [{ value: "all", label: "All statuses" }, ...["running", "deploying", "building", "stopped", "failed", "destroyed"].map((s) => ({ value: s, label: SY.STATUS[s].label }))];
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Previews</h1>
            <p className="psub">Every live preview environment across your projects.</p>
          </div>
          <div className="phead-r">
            <Select value={proj} options={projOpts} onChange={setProj} icon="folder" width={180} />
            <Select value={status} options={statusOpts} onChange={setStatus} icon="filter" width={180} />
            <button className="btn btn-primary"><Icon name="plus" size={15} />New preview</button>
          </div>
        </div>
        {list.length ? (
          <div className="pv-grid">{list.map((p) => <PreviewCard key={p.pr} p={p} />)}</div>
        ) : <div className="empty">No previews match these filters.</div>}
      </div>
    );
  }

  /* ============== DEPLOYMENTS ============== */
  function ExpandRow({ d }) {
    const proj = PRJ[d.proj];
    const lines = d.status === "failed"
      ? [["t-dim", "$ docker build -t preview ."], ["t-blue", "=> [build 6/8] RUN pnpm build"], ["t-red", "error: build step failed — see Builds for full log"], ["t-red", "ERROR  exit code 1"]]
      : d.status === "succeeded"
      ? [["t-dim", "$ docker build -t preview ."], ["t-green", "=> exported image sha256:9af3…c21 in 4.2s"], ["t-blue", "=> deploying container · iad1"], ["t-green", "✓ preview live in " + (d.dur || "—")]]
      : [["t-dim", "$ docker build -t preview ."], ["t-blue", "=> [build 4/8] RUN pnpm install"], ["t-amber", "… still building"]];
    return (
      <div className="expbox">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="pill"><Icon name="folder" size={11} style={{ marginRight: 4, verticalAlign: "-2px" }} />{proj.name}</span>
          <span className="pill">{proj.repo}</span>
          <span className="pill">PR #{d.pr}</span>
          <span className="pill">{d.trigger}</span>
        </div>
        <div className="term">
          <div className="term-bar"><div className="term-dots"><i style={{ background: "#ff5f57" }}></i><i style={{ background: "#febc2e" }}></i><i style={{ background: "#28c840" }}></i></div><span className="term-title">build · {d.commit}</span></div>
          <div className="term-body">
            {lines.map((l, i) => <div key={i} className="term-line"><span className="term-ln">{i + 1}</span><span className={l[0]}>{l[1]}</span></div>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
          <button className="btn btn-ghost btn-sm">Open preview<Icon name="external-link" size={13} /></button>
          <button className="btn btn-outline btn-sm"><Icon name="refresh" size={13} />Redeploy</button>
          {d.status === "failed" && <button className="btn btn-outline btn-sm"><Icon name="terminal" size={13} />View build</button>}
        </div>
      </div>
    );
  }

  function Deployments() {
    const [status, setStatus] = useState("all");
    const [open, setOpen] = useState(null);
    const list = SY.deployments.filter((d) => status === "all" || d.status === status);
    const statusOpts = [{ value: "all", label: "All statuses" }, ...["building", "deploying", "succeeded", "failed"].map((s) => ({ value: s, label: SY.STATUS[s].label }))];
    const succ = SY.deployments.filter((d) => d.status === "succeeded").length;
    const rate = Math.round((succ / SY.deployments.filter((d) => ["succeeded", "failed"].includes(d.status)).length) * 100);
    const maxDur = Math.max(...SY.deployments.map((d) => d.durs));
    return (
      <div className="page fade-in">
        <div className="phead">
          <div className="phead-l">
            <h1 className="ptitle">Deployments</h1>
            <p className="psub">Build-and-start runs across all your previews.</p>
          </div>
          <div className="phead-r"><Select value={status} options={statusOpts} onChange={setStatus} icon="filter" width={180} /></div>
        </div>

        <div className="grid cols-4" style={{ marginBottom: 18 }}>
          <StatCard label="Success rate" value={rate + "%"} foot="last 11 runs" icon="check-circle" iconTone="green" delta={{ dir: "up", txt: "73→82" }} />
          <StatCard label="Avg duration" value="1m 18s" foot="build + deploy" icon="clock" />
          <StatCard label="Running now" value="2" foot="1 building · 1 deploying" icon="activity" iconTone="blue" />
          <StatCard label="Failed" value="2" foot="needs triage" icon="alert-circle" />
        </div>

        <div className="tablewrap">
          <table className="dtable">
            <thead><tr>
              <th style={{ width: 130 }}>Status</th><th>Preview</th><th>Commit</th><th>Trigger</th><th>Duration</th><th style={{ textAlign: "right" }}>Queued</th>
            </tr></thead>
            <tbody>
              {list.map((d, i) => {
                const isOpen = open === i;
                return [
                  <tr key={i} className={isOpen ? "expanded" : ""} onClick={() => setOpen(isOpen ? null : i)}>
                    <td><StatusBadge status={d.status} /></td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Icon name="chevron-right" size={14} style={{ color: "var(--tx-faint)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                      <span style={{ fontWeight: 600 }}>PR #{d.pr}</span><span className="c-mono" style={{ color: "var(--tx-dim)" }}>{PRJ[d.proj].name}</span>
                    </div></td>
                    <td><span className="c-mono"><Icon name="git-commit" size={12} style={{ verticalAlign: "-2px", marginRight: 5, color: "var(--tx-faint)" }} />{d.commit}</span></td>
                    <td><span className="trigpill">{d.trigger}</span></td>
                    <td>
                      {d.dur ? <><span className="durbar"><i style={{ width: (d.durs / maxDur) * 100 + "%", background: d.status === "failed" ? "var(--red)" : "var(--tx-dim)" }}></i></span><span className="c-mono">{d.dur}</span></>
                             : <span className="c-mono" style={{ color: "var(--blue)" }}>running…</span>}
                    </td>
                    <td style={{ textAlign: "right" }}><span className="c-mono" style={{ color: "var(--tx-dim)" }}>{d.time}</span></td>
                  </tr>,
                  isOpen && <tr key={i + "e"} className="exprow"><td colSpan={6}><ExpandRow d={d} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  Object.assign(window, { Overview, Previews, Deployments, StatCard });
})();
