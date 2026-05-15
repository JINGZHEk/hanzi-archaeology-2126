export const applyTheme = (theme) => {
  const root = document.documentElement;
  const a = theme?.a || "#fbbf24";
  const b = theme?.b || "#22d3ee";
  const toRgb = (hex) => {
    const s = String(hex || "").replace("#", "").trim();
    const h = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 251, g: 191, b: 36 };
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgba = (rgb, a01) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a01})`;
  const ra = toRgb(a);
  const rb = toRgb(b);
  root.style.setProperty("--amber", a);
  root.style.setProperty("--cyan", b);
  root.style.setProperty("--amber95", rgba(ra, 0.95));
  root.style.setProperty("--amber92", rgba(ra, 0.92));
  root.style.setProperty("--amber55", rgba(ra, 0.55));
  root.style.setProperty("--amber32", rgba(ra, 0.32));
  root.style.setProperty("--amber22", rgba(ra, 0.22));
  root.style.setProperty("--amber18", rgba(ra, 0.18));
  root.style.setProperty("--amber16", rgba(ra, 0.16));
  root.style.setProperty("--amber14", rgba(ra, 0.14));
  root.style.setProperty("--cyan85", rgba(rb, 0.85));
  root.style.setProperty("--cyan55", rgba(rb, 0.55));
  root.style.setProperty("--cyan35", rgba(rb, 0.35));
  root.style.setProperty("--cyan32", rgba(rb, 0.32));
  root.style.setProperty("--cyan16", rgba(rb, 0.16));
  root.style.setProperty("--cyan10", rgba(rb, 0.1));
  root.style.setProperty("--cyan08", rgba(rb, 0.08));
};

export const applyPhase2Fx = (el, theme) => {
  const fx = theme?.fx || "";
  el.dataset.fx = fx || "";
  el.style.setProperty("--fx", "0.8");
  el.style.setProperty("--fxBlur", "0px");
  el.style.setProperty("--fxRot", "0deg");
  if (fx === "sand") {
    el.style.setProperty("--fxBlur", "6px");
    el.style.setProperty("--fxRot", "15deg");
    el.style.setProperty("--fx", "0.95");
  } else if (fx === "heat") {
    el.style.setProperty("--fxBlur", "10px");
    el.style.setProperty("--fxRot", "-8deg");
    el.style.setProperty("--fx", "0.9");
  } else if (fx === "aurora") {
    el.style.setProperty("--fxBlur", "14px");
    el.style.setProperty("--fxRot", "22deg");
    el.style.setProperty("--fx", "1");
  } else if (fx === "ripple") {
    el.style.setProperty("--fxBlur", "8px");
    el.style.setProperty("--fxRot", "0deg");
    el.style.setProperty("--fx", "0.88");
  } else if (fx === "prism") {
    el.style.setProperty("--fxBlur", "0px");
    el.style.setProperty("--fxRot", "45deg");
    el.style.setProperty("--fx", "0.78");
  } else if (fx === "mist") {
    el.style.setProperty("--fxBlur", "16px");
    el.style.setProperty("--fxRot", "-12deg");
    el.style.setProperty("--fx", "0.7");
  } else if (fx === "leaf") {
    el.style.setProperty("--fxBlur", "7px");
    el.style.setProperty("--fxRot", "8deg");
    el.style.setProperty("--fx", "0.85");
  } else if (fx === "flare") {
    el.style.setProperty("--fxBlur", "2px");
    el.style.setProperty("--fxRot", "0deg");
    el.style.setProperty("--fx", "0.95");
  } else if (fx === "ink") {
    el.style.setProperty("--fxBlur", "18px");
    el.style.setProperty("--fxRot", "0deg");
    el.style.setProperty("--fx", "0.65");
  } else if (fx === "grid") {
    el.style.setProperty("--fxBlur", "0px");
    el.style.setProperty("--fxRot", "0deg");
    el.style.setProperty("--fx", "0.62");
  } else if (fx === "bloom") {
    el.style.setProperty("--fxBlur", "9px");
    el.style.setProperty("--fxRot", "12deg");
    el.style.setProperty("--fx", "0.9");
  } else if (fx === "petal") {
    el.style.setProperty("--fxBlur", "8px");
    el.style.setProperty("--fxRot", "-18deg");
    el.style.setProperty("--fx", "0.86");
  } else if (fx === "blink") {
    el.style.setProperty("--fxBlur", "0px");
    el.style.setProperty("--fxRot", "0deg");
    el.style.setProperty("--fx", "0.74");
  } else if (fx === "wave") {
    el.style.setProperty("--fxBlur", "12px");
    el.style.setProperty("--fxRot", "0deg");
    el.style.setProperty("--fx", "0.9");
  } else if (fx === "silk") {
    el.style.setProperty("--fxBlur", "4px");
    el.style.setProperty("--fxRot", "30deg");
    el.style.setProperty("--fx", "0.76");
  }
};
