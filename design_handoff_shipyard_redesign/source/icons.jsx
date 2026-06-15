/* Icon set — clean stroke icons, exposed via window.Icon (React component).
   Inner markup per icon; svg wrapper sets stroke=currentColor, fill=none. */
(function () {
  const P = {
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4"/>',
    layers: '<path d="M12 3 21 7.7 12 12.4 3 7.7 12 3Z"/><path d="M3.3 12.2 12 16.7l8.7-4.5"/><path d="M3.3 16.4 12 20.9l8.7-4.5"/>',
    rocket: '<path d="M12 3.2c2.6 1.7 4.1 4.4 4.1 7.7 0 1.7-.4 3.2-1.1 4.6H8.9C8.2 14.1 7.9 12.6 7.9 11c0-3.3 1.5-6 4.1-7.8Z"/><circle cx="12" cy="10" r="1.7"/><path d="M9 15.5l-2.2 1.8c-.3.3-.4.7-.2 1.1l.9 1.8M15 15.5l2.2 1.8c.3.3.4.7.2 1.1l-.9 1.8"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 9.5l3 2.8-3 2.8"/><path d="M12.5 15h4.5"/>',
    coin: '<circle cx="12" cy="12" r="8.6"/><path d="M14.6 9.3c-.6-.9-1.6-1.4-2.7-1.4-1.5 0-2.6.9-2.6 2.1 0 1.2 1 1.8 2.6 2.1 1.6.3 2.7.9 2.7 2.1 0 1.2-1.2 2.1-2.7 2.1-1.1 0-2.2-.5-2.8-1.4M12 6.4v11.2"/>',
    folder: '<path d="M3 7.2A2 2 0 0 1 5 5.2h3.7a2 2 0 0 1 1.5.7l1 1.1H19a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.2Z"/>',
    sliders: '<path d="M4 8h9M17.5 8H20M4 16h2.5M11 16h9"/><circle cx="15" cy="8" r="2.3"/><circle cx="8.5" cy="16" r="2.3"/>',
    bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 4.4 1.6 5.5 2 5.8H4c.4-.3 2-1.4 2-5.8Z"/><path d="M10.2 18.8a2 2 0 0 0 3.6 0"/>',
    moon: '<path d="M20.5 14.6A8.2 8.2 0 1 1 9.4 3.5 6.6 6.6 0 0 0 20.5 14.6Z"/>',
    search: '<circle cx="11" cy="11" r="6.6"/><path d="M20 20l-4.3-4.3"/>',
    "external-link": '<path d="M14 4h6v6"/><path d="M20 4 11.5 12.5"/><path d="M18 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H11"/>',
    "arrow-up-right": '<path d="M7.5 16.5 16.5 7.5M8.5 7.5h8v8"/>',
    "chevron-down": '<path d="M6 9.5l6 6 6-6"/>',
    "chevron-right": '<path d="M9 6l6 6-6 6"/>',
    "chevrons-up-down": '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
    "git-commit": '<circle cx="12" cy="12" r="3.4"/><path d="M3 12h5.3M15.7 12H21"/>',
    "git-branch": '<circle cx="6.5" cy="6" r="2.4"/><circle cx="6.5" cy="18" r="2.4"/><circle cx="17.5" cy="8" r="2.4"/><path d="M6.5 8.4v7.2"/><path d="M17.5 10.4c0 4-3.6 3.6-6 5"/>',
    "git-pull-request": '<circle cx="6.5" cy="6" r="2.4"/><circle cx="6.5" cy="18" r="2.4"/><circle cx="17.5" cy="18" r="2.4"/><path d="M6.5 8.4v7.2"/><path d="M17.5 15.6V11a3.5 3.5 0 0 0-3.5-3.5h-2.2"/><path d="M13.4 5.4 11.5 7.5l1.9 2.1"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.2"/><path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h8.5A1.5 1.5 0 0 1 15 5v.5"/>',
    trash: '<path d="M4 7h16M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.3 7l.9 12.2a1.5 1.5 0 0 0 1.5 1.4h6.6a1.5 1.5 0 0 0 1.5-1.4L18.7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.4-5.9"/><path d="M20.5 4.5v4.2h-4.2"/>',
    check: '<path d="M5 12.5l4.5 4.5L19.5 6.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    activity: '<path d="M3 12h4l2.5 7L14 5l2.5 7H21"/>',
    filter: '<path d="M4 5.5h16l-6.2 8v5.2l-3.6-1.8v-3.4L4 5.5Z"/>',
    anchor: '<circle cx="12" cy="5" r="2.1"/><path d="M12 7.1V21"/><path d="M8.4 10.6h7.2"/><path d="M4.6 13a7.4 7.4 0 0 0 14.8 0"/><path d="M4.6 13 2.9 14.1M19.4 13l1.7 1.1"/>',
    users: '<circle cx="9" cy="8" r="3.1"/><path d="M3.4 19.2a5.6 5.6 0 0 1 11.2 0"/><path d="M16 5.3a3 3 0 0 1 0 5.5M17.4 19.2a5.6 5.6 0 0 0-2.4-4.6"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2v5l3.4 2"/>',
    key: '<circle cx="8" cy="14.5" r="3.6"/><path d="M10.6 11.9 19 3.5l1.8 1.8-1.6 1.6 1.6 1.6-2.2 2.2-1.6-1.6-2.3 2.3"/>',
    shield: '<path d="M12 3.2l7 2.6v5.1c0 4.4-3 7.4-7 9.1-4-1.7-7-4.7-7-9.1V5.8L12 3.2Z"/>',
    "trending-up": '<path d="M3 16.5 9.5 10l3.5 3.5L21 6"/><path d="M15 6h6v6"/>',
    "trending-down": '<path d="M3 7.5 9.5 14l3.5-3.5L21 18"/><path d="M15 18h6v-6"/>',
    zap: '<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/>',
    play: '<path d="M8 5.2v13.6L19 12 8 5.2Z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
    pause: '<rect x="7" y="5.5" width="3.3" height="13" rx="1.2"/><rect x="13.7" y="5.5" width="3.3" height="13" rx="1.2"/>',
    "more-h": '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    "x-octagon": '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8l5-5Z"/><path d="M9 9l6 6M15 9l-6 6"/>',
    "check-circle": '<circle cx="12" cy="12" r="8.6"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
    "alert-circle": '<circle cx="12" cy="12" r="8.6"/><path d="M12 8v4.6M12 15.8v.2"/>',
    dollar: '<path d="M12 3v18M16.5 6.8C15.6 5.7 13.9 5 12 5 9.2 5 7 6.6 7 8.7c0 2 1.6 2.8 5 3.5 3.4.7 5 1.6 5 3.6 0 2.1-2.2 3.7-5 3.7-1.9 0-3.6-.7-4.5-1.8"/>',
    box: '<path d="M12 3 20 7v10l-8 4-8-4V7l8-4Z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
    github: '<path d="M9 19c-4 1.2-4-2.1-5.6-2.5M14 21v-3.1a2.6 2.6 0 0 0-.8-2.1c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.3 1.2a11.5 11.5 0 0 0-6 0C5.4 2.9 4.4 3.2 4.4 3.2a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3 9.6c0 4.6 2.8 5.7 5.5 6a2.6 2.6 0 0 0-.8 2v3.4"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.3 3.6 5.4 3.6 8.6S14.4 18.3 12 20.6c-2.4-2.3-3.6-5.4-3.6-8.6S9.6 5.7 12 3.4Z"/>',
    cube: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    command: '<path d="M9 7.5a2.25 2.25 0 1 0-2.25 2.25H17.25A2.25 2.25 0 1 0 15 7.5v9a2.25 2.25 0 1 0 2.25-2.25H6.75A2.25 2.25 0 1 0 9 16.5Z"/>',
  };

  function Icon({ name, size = 18, className, style, strokeWidth = 1.75 }) {
    const inner = P[name] || P.box;
    return React.createElement("svg", {
      className, style, width: size, height: size, viewBox: "0 0 24 24",
      fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
      dangerouslySetInnerHTML: { __html: inner },
    });
  }
  window.Icon = Icon;
})();
