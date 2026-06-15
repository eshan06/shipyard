/* App shell — router, command palette, mount. Requires all other scripts loaded. */
(function () {
  const { useState, useEffect, useCallback, useRef } = React;
  const Icon = window.Icon;
  const SY = window.SY;
  const { Sidebar, Topbar } = window;

  const PAGES = {
    overview: window.Overview, previews: window.Previews, deployments: window.Deployments,
    builds: window.Builds, costs: window.Costs, projects: window.Projects, settings: window.Settings,
  };
  const LABEL = Object.fromEntries(SY.nav.map((n) => [n.id, n.label]));

  /* ---------- command palette ---------- */
  function CommandPalette({ onClose, go }) {
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);

    const navItems = SY.nav.map((n) => ({ kind: "nav", id: n.id, name: n.label, icon: n.icon, desc: "Go to " + n.label }));
    const actions = [
      { kind: "action", id: "new-preview", name: "New preview", icon: "plus", desc: "Spin up a preview env", to: "previews" },
      { kind: "action", id: "retry", name: "Retry failed builds", icon: "refresh", desc: "Re-run failed container builds", to: "builds" },
      { kind: "action", id: "tokens", name: "Create API token", icon: "key", desc: "Programmatic access", to: "settings" },
      { kind: "action", id: "costs", name: "View this month's spend", icon: "coin", desc: "Billing overview", to: "costs" },
    ];
    const previews = SY.previews.slice(0, 6).map((p) => ({ kind: "preview", id: "pv" + p.pr, name: "PR #" + p.pr + " " + p.slug, icon: "cube", desc: SY.PROJECTS[p.proj].name + " · " + p.status, to: "previews" }));

    const all = [...navItems, ...actions, ...previews];
    const ql = q.trim().toLowerCase();
    const filtered = ql ? all.filter((i) => (i.name + i.desc).toLowerCase().includes(ql)) : all;
    const groups = [
      { label: "Navigation", items: filtered.filter((i) => i.kind === "nav") },
      { label: "Actions", items: filtered.filter((i) => i.kind === "action") },
      { label: "Previews", items: filtered.filter((i) => i.kind === "preview") },
    ].filter((g) => g.items.length);
    const flat = groups.flatMap((g) => g.items);

    useEffect(() => { setSel(0); }, [q]);
    const choose = useCallback((item) => { if (!item) return; go(item.to || item.id); onClose(); }, [go, onClose]);

    function onKey(e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); choose(flat[sel]); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }

    let idx = -1;
    return (
      <div className="overlay" onMouseDown={(e) => { if (e.target.classList.contains("overlay")) onClose(); }}>
        <div className="cmd" onKeyDown={onKey}>
          <div className="cmd-input">
            <Icon name="search" size={18} />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages, previews, actions…" />
            <span className="esc">ESC</span>
          </div>
          <div className="cmd-list">
            {flat.length === 0 && <div className="empty" style={{ padding: "36px 0" }}>No results for “{q}”.</div>}
            {groups.map((g) => (
              <div key={g.label}>
                <div className="cmd-grp">{g.label}</div>
                {g.items.map((item) => {
                  idx++; const myIdx = idx;
                  return (
                    <div key={item.id} className={"cmd-item" + (myIdx === sel ? " sel" : "")}
                         onMouseEnter={() => setSel(myIdx)} onClick={() => choose(item)}>
                      <span className="ci-ic"><Icon name={item.icon} size={15} /></span>
                      <div style={{ minWidth: 0 }}><div className="ci-name">{item.name}</div><div className="ci-desc">{item.desc}</div></div>
                      <span className="ci-key">{item.kind === "nav" ? "↵" : "→"}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- app ---------- */
  function App() {
    const [page, setPage] = useState(() => {
      const h = (location.hash || "").replace("#", "");
      if (PAGES[h]) return h;
      const saved = localStorage.getItem("sy_page");
      return PAGES[saved] ? saved : "overview";
    });
    const [cmdOpen, setCmdOpen] = useState(false);
    const contentRef = useRef(null);

    const go = useCallback((id) => {
      if (!PAGES[id]) return;
      setPage(id);
      localStorage.setItem("sy_page", id);
      location.hash = id;
      if (contentRef.current) contentRef.current.scrollTop = 0;
    }, []);

    useEffect(() => {
      function k(e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmdOpen((o) => !o); }
        else if (e.key === "Escape") { setCmdOpen(false); }
      }
      window.addEventListener("keydown", k);
      return () => window.removeEventListener("keydown", k);
    }, []);

    useEffect(() => {
      function onHash() { const h = location.hash.replace("#", ""); if (PAGES[h] && h !== page) setPage(h); }
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }, [page]);

    const Page = PAGES[page] || window.Overview;
    const counts = { previews: SY.previews.length, builds: SY.builds.length };

    return (
      <div className="app">
        <Sidebar active={page} go={go} counts={counts} />
        <div className="main">
          <Topbar page={LABEL[page] ? page : "overview"} openCmd={() => setCmdOpen(true)} />
          <div className="content" ref={contentRef}>
            <Page go={go} key={page} />
          </div>
        </div>
        {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} go={go} />}
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
