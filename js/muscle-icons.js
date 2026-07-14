// ============================================================
// MDGym - iconos anatomicos en SVG (silueta + musculo resaltado)
// Reemplaza fotos por dibujos simples, al estilo de las apps de
// referencia: figura neutra con la zona trabajada en rojo.
// ============================================================

const MDGYM_ICON_HIGHLIGHT = "#ef4444";

const MDGYM_MUSCLE_ICON_CONFIG = {
  pecho:       { view: "front", parts: ["chest"] },
  abdominales: { view: "front", parts: ["abs"] },
  hombros:     { view: "front", parts: ["shoulder_l", "shoulder_r"] },
  biceps:      { view: "front", parts: ["arm_upper_l", "arm_upper_r"] },
  antebrazos:  { view: "front", parts: ["arm_lower_l", "arm_lower_r"] },
  piernas:     { view: "front", parts: ["leg_l", "leg_r"] },
  espalda:     { view: "back", parts: ["chest", "abs", "shoulder_l", "shoulder_r"] },
  triceps:     { view: "back", parts: ["arm_upper_l", "arm_upper_r"] },
};

function mdgymMuscleIconSVG(muscleGroup, size) {
  size = size || 64;
  const cfg = MDGYM_MUSCLE_ICON_CONFIG[muscleGroup] || MDGYM_MUSCLE_ICON_CONFIG.pecho;
  const isBack = cfg.view === "back";
  const c = (part) => (cfg.parts.indexOf(part) >= 0 ? MDGYM_ICON_HIGHLIGHT : "var(--text-muted)");

  return `
    <svg viewBox="0 0 120 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="60" cy="18" r="13" fill="var(--text-muted)" />
      <rect x="54" y="29" width="12" height="8" rx="2" fill="var(--text-muted)" />
      <rect x="26" y="38" width="20" height="15" rx="7" fill="${c("shoulder_l")}" />
      <rect x="74" y="38" width="20" height="15" rx="7" fill="${c("shoulder_r")}" />
      <path d="M40,38 L80,38 L78,68 L42,68 Z" fill="${c("chest")}" />
      <path d="M42,68 L78,68 L74,100 L46,100 Z" fill="${c("abs")}" />
      <rect x="16" y="40" width="14" height="38" rx="7" fill="${c("arm_upper_l")}" />
      <rect x="90" y="40" width="14" height="38" rx="7" fill="${c("arm_upper_r")}" />
      <rect x="14" y="80" width="13" height="36" rx="6" fill="${c("arm_lower_l")}" />
      <rect x="93" y="80" width="13" height="36" rx="6" fill="${c("arm_lower_r")}" />
      <circle cx="20" cy="120" r="7" fill="var(--text-muted)" />
      <circle cx="100" cy="120" r="7" fill="var(--text-muted)" />
      <rect x="42" y="102" width="17" height="80" rx="8" fill="${c("leg_l")}" />
      <rect x="61" y="102" width="17" height="80" rx="8" fill="${c("leg_r")}" />
      <ellipse cx="50" cy="190" rx="10" ry="6" fill="var(--text-muted)" />
      <ellipse cx="70" cy="190" rx="10" ry="6" fill="var(--text-muted)" />
      ${isBack ? '<line x1="60" y1="40" x2="60" y2="100" stroke="var(--bg-elevated)" stroke-width="2" opacity="0.6" />' : ""}
    </svg>
  `;
}

window.mdgymMuscleIconSVG = mdgymMuscleIconSVG;
