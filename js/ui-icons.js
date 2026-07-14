// ============================================================
// MDGym - iconos de interfaz (lineales, SVG, sin emojis)
// ============================================================
const MDGYM_UI_ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9h5v-5h2v5h5v-9" />',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /><circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="17.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/>',
  chart: '<path d="M4 19h16" /><path d="M7 19v-6M12 19V7M17 19v-10" />',
  gear: '<circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7 16 16M8 8 6.3 6.3" />',
  check: '<path d="M5 13l4.5 4.5L19 8" />',
  refresh: '<path d="M4 12a8 8 0 0 1 13.5-5.7M20 12a8 8 0 0 1-13.5 5.7" /><path d="M17 3v4h-4M7 21v-4h4" />',
  close: '<path d="M6 6l12 12M18 6L6 18" />',
  body: '<circle cx="12" cy="5" r="2.4" /><path d="M12 8v7M8 11l4-1.5 4 1.5M9 21l3-6 3 6" />',
  dumbbell: '<path d="M4 10v4M7 8v8M17 8v8M20 10v4" /><path d="M7 12h10" stroke-width="3" />',
  barbell: '<path d="M2 12h4M18 12h4" /><rect x="4" y="9.5" width="2.4" height="5" rx="0.6" /><rect x="17.6" y="9.5" width="2.4" height="5" rx="0.6" /><path d="M6.4 12h11.2" />',
  kettlebell: '<circle cx="12" cy="14" r="6" /><path d="M9.5 8a2.5 3 0 0 1 5 0v2h-5V8Z" />',
  machine: '<rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8M8 13h5M8 17h3" />',
  cable: '<path d="M6 3v9a4 4 0 0 0 4 4h4M6 3H4M6 3h2" /><circle cx="16" cy="18" r="2.4" />',
  band: '<path d="M4 8c4 6 12 6 16 0M4 16c4-6 12-6 16 0" />',
  ball: '<circle cx="12" cy="12" r="8" /><path d="M12 4v16M4 12h16" />',
  bag: '<path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />',
  shuffle: '<path d="M4 7h3.5L15 17h4.5" /><path d="M16.5 4.5 20.5 7l-4 2.5" /><path d="M4 17h3.5l2-3" /><path d="M11 10l1.3-2" /><path d="M16.5 19.5 20.5 17l-4-2.5" />',
  box: '<path d="M3.5 8 12 4l8.5 4-8.5 4-8.5-4Z" /><path d="M3.5 8v8L12 20l8.5-4V8" /><path d="M12 12v8" />',
  tip: '<path d="M9 18.5h6" /><path d="M10 21.5h4" /><path d="M12 3a6.3 6.3 0 0 0-3.6 11.4c.7.5 1.1 1.3 1.1 2.1h5c0-.8.4-1.6 1.1-2.1A6.3 6.3 0 0 0 12 3Z" />',
};

// ------------------------------------------------------------
// Personalizacion de iconos por tema. Los 4 temas originales
// (oscuro/claro/sepia/mar) usan el set de arriba tal cual, solo
// recoloreado via currentColor+CSS. Para los 4 temas nuevos cada
// uno tiene su propio "tratamiento": grosor y terminacion de
// trazo, redondeo de las esquinas (rx de los rectangulos), y un
// pequeño detalle decorativo propio en la esquina superior
// derecha (no es un redibujado libre icono por icono: es una
// transformacion sistematica aplicada a los 19 iconos, para que
// el set completo se sienta propio de cada tema y a la vez siga
// siendo un conjunto coherente).
// ------------------------------------------------------------
const MDGYM_ICON_THEME_STYLE = {
  rosa: { strokeWidth: 1.5, linecap: "round", linejoin: "round", rxScale: 1.6, accent: "rosa" },
  rojoblanco: { strokeWidth: 2.3, linecap: "square", linejoin: "miter", rxScale: 0.35, accent: "rojoblanco" },
  violeta: { strokeWidth: 1.3, linecap: "round", linejoin: "round", rxScale: 1.3, accent: "violeta" },
  bosque: { strokeWidth: 2, linecap: "round", linejoin: "round", rxScale: 1.4, accent: "bosque" },
};

const MDGYM_ICON_ACCENTS = {
  rosa: '<circle cx="20.2" cy="3.8" r="1.1" fill="currentColor" stroke="none"/>',
  rojoblanco: '<path d="M19 2.8h2.4M20.2 1.6v2.4" stroke-width="1.6" stroke-linecap="square"/>',
  violeta: '<path d="M20.2 2.4v2.6M18.9 3.7h2.6" stroke-width="1.1"/>',
  bosque: '<path d="M19.3 2c1 .9 1 2.5 0 3.4-1 .9-2.5.9-3.4 0" stroke-width="1.3"/>',
};

function mdgymScaleIconRx(svgInner, scale) {
  return svgInner.replace(/rx="([\d.]+)"/g, (m, v) => `rx="${Math.min(parseFloat(v) * scale, 8).toFixed(2)}"`);
}

function mdgymIcon(name, size, strokeWidth) {
  size = size || 20;
  const theme =
    (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")) || "oscuro";
  const style = MDGYM_ICON_THEME_STYLE[theme];
  let inner = MDGYM_UI_ICONS[name] || MDGYM_UI_ICONS.gear;
  let sw = strokeWidth || 1.8;
  let cap = "round";
  let join = "round";
  if (style) {
    inner = mdgymScaleIconRx(inner, style.rxScale) + (MDGYM_ICON_ACCENTS[style.accent] || "");
    sw = style.strokeWidth;
    cap = style.linecap;
    join = style.linejoin;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="${cap}" stroke-linejoin="${join}" aria-hidden="true">${inner}</svg>`;
}

// ------------------------------------------------------------
// Logo: 5 variantes seleccionables (ver Configuracion). Se
// dibujan como una placa cuadrada con el color de acento del
// tema activo, siguiendo la misma estetica del favicon actual.
// ------------------------------------------------------------
const MDGYM_LOGOS = {
  barra:
    '<path d="M4 12h16M6 9v6M18 9v6"/><rect x="3" y="9.5" width="2.2" height="5" rx="0.6" fill="var(--accent-text)" stroke="none"/><rect x="18.8" y="9.5" width="2.2" height="5" rx="0.6" fill="var(--accent-text)" stroke="none"/>',
  monograma: '<path d="M4 18V6l4 6 4-6 4 6 4-6v12"/>',
  brazo:
    '<circle cx="12" cy="12" r="8.5" stroke-width="1.4"/><path d="M8 16c0-3 1-4.5 2.3-5.6"/><path d="M10.3 10.4c-.9-.9-.9-2.2-.1-3 .8-.8 2-.7 2.8.1l2.6 2.6c.8.8.9 2 .1 2.8-.8.8-2.1.8-3-.1"/><path d="M15.5 12.5 17 14"/>',
  pulso:
    '<rect x="3.5" y="10.5" width="2" height="3" rx="0.5" fill="var(--accent-text)" stroke="none"/><rect x="18.5" y="10.5" width="2" height="3" rx="0.5" fill="var(--accent-text)" stroke="none"/><path d="M5.5 12h2M16.5 12h2M7.5 12h1.5l1.2-3.2 2 6.4 1.2-3.2H15"/>',
  escudo:
    '<path d="M12 3.2 19 5.5v5.3c0 4.6-2.9 7.9-7 9-4.1-1.1-7-4.4-7-9V5.5Z" stroke-width="1.4"/><path d="M8.5 12h7M9.7 9.5v5M14.3 9.5v5"/>',
};

const MDGYM_LOGO_LABELS = {
  barra: "Barra minimal",
  monograma: "Monograma M",
  brazo: "Brazo en circulo",
  pulso: "Barra con pulso",
  escudo: "Escudo",
};

function mdgymLogo(id, size) {
  size = size || 26;
  const inner = MDGYM_LOGOS[id] || MDGYM_LOGOS.barra;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="7" fill="var(--accent)"/><g fill="none" stroke="var(--accent-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
}

window.mdgymIcon = mdgymIcon;
window.mdgymLogo = mdgymLogo;
window.MDGYM_LOGO_LABELS = MDGYM_LOGO_LABELS;
