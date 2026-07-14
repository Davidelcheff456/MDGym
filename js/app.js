// ============================================================
// MDGym - logica principal de la app (router + vistas)
// ============================================================

// ------------------------------------------------------------
// Si algo falla (error de JS, localStorage bloqueado, etc.),
// mostramos un aviso visible en vez de dejar la pagina "sin
// hacer nada" en silencio. Esto ayuda a diagnosticar en el momento.
// ------------------------------------------------------------
function mdgymShowFatalError(msg) {
  let banner = document.getElementById("mdgym-fatal-error");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "mdgym-fatal-error";
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#ef4444;color:#fff;" +
      "padding:12px 16px;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;";
    document.body.insertBefore(banner, document.body.firstChild);
  }
  banner.textContent =
    "MDGym encontro un error y algo no esta funcionando (" + msg + "). " +
    "Si abriste el archivo con doble clic, proba abrirlo con un servidor local (ver README) " +
    "y si sigue fallando apreta F12 para ver el detalle en la consola.";
}

window.addEventListener("error", (e) => {
  mdgymShowFatalError(e.message || "error desconocido");
});
window.addEventListener("unhandledrejection", (e) => {
  mdgymShowFatalError((e.reason && e.reason.message) || "promesa rechazada");
});

const STATE = {
  onboardStep: "mode",
  onboardData: { name: "", age: "", weightKg: "", heightCm: "", sex: "M", mode: null, location: null, goals: [], equipment: [], daysPerWeek: 3 },
  previewRoutine: null, // rutina propuesta por el asistente, pendiente de confirmar/ajustar
  onboardAdjustMode: false, // dentro del paso "review": false = viendo la propuesta, true = tildando que sacar
  adjustRemoved: {}, // claves "dayIdx-exIdx" tildadas para sacar en el ajuste post-generacion
  manualBuild: null, // { dayIdx, days: [{exercises:[...]}, ...] } mientras se arma una rutina manual
  viewingDayIndex: null, // dia que se esta mostrando en Rutina (por defecto = nextDayIndex)
  editingDayIdx: null, // != null mientras se estan editando (sacando) ejercicios de ese dia en Rutina
  homeSuggestion: null, // { dayIdx, suggestion } sugerencia de reemplazo tras sacar un ejercicio en Rutina
  monthViewOffset: 0, // 0 = mes actual, -1 = mes anterior, 1 = mes siguiente, etc. (vista Mes)
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateEs(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

// Semanas completas transcurridas desde una fecha (0 si es hoy o si no hay fecha).
function mdgymPickRandom(arr) {
  if (!arr || !arr.length) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

function mdgymMotivationText(pool, name) {
  const template = mdgymPickRandom(pool);
  if (!template) return "";
  const safeName = name && String(name).trim() ? String(name).trim() : "crack";
  return template.replace(/\{name\}/g, safeName);
}

function mdgymGetWeekRangeForDate(dateObj) {
  const weekday = (dateObj.getDay() + 6) % 7; // lunes=0
  const start = new Date(dateObj);
  start.setDate(dateObj.getDate() - weekday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// Una serie se considera "hecha" si tiene el flag explicito, o (para datos
// viejos que no tenian ese flag) si tiene un peso cargado.
function mdgymIsSetDone(set) {
  if (!set) return false;
  if (set.done === true) return true;
  if (set.done === false) return false;
  return set.weightKg != null && set.weightKg !== "";
}

function mdgymRoundWeight(w) {
  return Math.round(w * 2) / 2; // redondeo a 0.5kg
}

// Sugerencia simple de progresion de peso (regla fija, no IA): si la ULTIMA
// vez completaste todas las series de este ejercicio llegando a las
// repeticiones objetivo, sugiere subir un poco el peso (+1kg si venias con
// menos de 20kg, +2.5kg si venias con mas, redondeado a 0.5kg). Si no
// llegaste a completar todo, sugiere repetir el mismo peso. Es un punto de
// partida editable, no una obligacion.
function mdgymSuggestNextWeight(exerciseId, targetReps, beforeDate) {
  const last = MDGymStore.getLastSessionForExercise(exerciseId, beforeDate);
  if (!last) return null;
  const withWeight = last.sets.filter((s) => s.weightKg != null && s.weightKg !== "");
  if (!withWeight.length) return null;
  const lastMax = Math.max(...withWeight.map((s) => Number(s.weightKg)));
  const allDone = last.sets.every((s) => mdgymIsSetDone(s));
  const allMetReps = last.sets.every((s) => (Number(s.reps) || 0) >= targetReps);
  if (allDone && allMetReps) {
    const increment = lastMax < 20 ? 1 : 2.5;
    return { suggestedWeight: mdgymRoundWeight(lastMax + increment), lastWeight: lastMax, lastDate: last.date, bumped: true };
  }
  return { suggestedWeight: lastMax, lastWeight: lastMax, lastDate: last.date, bumped: false };
}

// ------------------------------------------------------------
// Timer de descanso entre series: cuenta regresiva simple que arranca al
// marcar una serie como hecha, usando el descanso sugerido del objetivo
// actual. Un solo timer activo a la vez (tiene sentido: descansas entre
// una serie y la siguiente, no en paralelo).
// ------------------------------------------------------------
let MDGYM_REST_TIMER_INTERVAL = null;

function mdgymFormatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mdgymStartRestTimer(seconds) {
  const bar = document.getElementById("rest-timer");
  const clock = document.getElementById("rest-timer-clock");
  if (!bar || !clock) return;
  if (MDGYM_REST_TIMER_INTERVAL) clearInterval(MDGYM_REST_TIMER_INTERVAL);
  let remaining = seconds;
  bar.style.display = "flex";
  clock.textContent = mdgymFormatClock(remaining);
  MDGYM_REST_TIMER_INTERVAL = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(MDGYM_REST_TIMER_INTERVAL);
      MDGYM_REST_TIMER_INTERVAL = null;
      bar.style.display = "none";
      return;
    }
    clock.textContent = mdgymFormatClock(remaining);
  }, 1000);
}

function mdgymStopRestTimer() {
  if (MDGYM_REST_TIMER_INTERVAL) {
    clearInterval(MDGYM_REST_TIMER_INTERVAL);
    MDGYM_REST_TIMER_INTERVAL = null;
  }
  const bar = document.getElementById("rest-timer");
  if (bar) bar.style.display = "none";
}

function mdgymWeeksSince(dateStr) {
  if (!dateStr) return 0;
  const ms = new Date(todayISO() + "T00:00:00") - new Date(dateStr + "T00:00:00");
  return Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById("view-" + name);
  if (target) target.classList.add("active");
  document.querySelectorAll(".navbtn").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === name);
  });
  const nav = document.getElementById("bottomnav");
  nav.style.display = name === "onboarding" || name === "settings" ? "none" : "flex";

  if (name === "home") renderHome();
  if (name === "month") renderMonthView();
  if (name === "history") renderHistory();
  if (name === "settings") renderSettings();
}

// Vuelve a dibujar los iconos de la barra superior y la nav inferior
// (estan fijos en index.html como placeholders) para que reflejen el
// tratamiento visual del tema activo y el logo elegido. Se llama al
// arrancar y cada vez que se cambia de tema o de logo en Configuracion.
function mdgymApplyChromeIcons() {
  const settings = MDGymStore.getSettings();
  const gear = document.getElementById("topbar-gear-icon");
  if (gear) gear.innerHTML = window.mdgymIcon("gear", 19);
  const navHome = document.getElementById("navicon-home");
  if (navHome) navHome.innerHTML = window.mdgymIcon("home", 19);
  const navMonth = document.getElementById("navicon-month");
  if (navMonth) navMonth.innerHTML = window.mdgymIcon("calendar", 19);
  const navHistory = document.getElementById("navicon-history");
  if (navHistory) navHistory.innerHTML = window.mdgymIcon("chart", 19);
  const logoSlot = document.getElementById("topbar-logo");
  if (logoSlot) logoSlot.innerHTML = window.mdgymLogo(settings.logo || "barra", 24);
}

document.addEventListener("DOMContentLoaded", () => {
  const settings = MDGymStore.getSettings();
  document.documentElement.setAttribute("data-theme", settings.theme || "oscuro");
  mdgymApplyChromeIcons();

  document.getElementById("btn-settings").addEventListener("click", () => showView("settings"));
  document.querySelectorAll(".navbtn").forEach((b) => {
    b.addEventListener("click", () => showView(b.dataset.nav));
  });

  const profile = MDGymStore.getProfile();
  if (!profile) {
    showView("onboarding");
    renderOnboarding();
  } else {
    showView("home");
  }
});

// ============================================================
// EXPLICACION DE LA RUTINA (por que estos ejercicios)
// ============================================================
function mdgymBuildRoutineExplanationHtml(profile) {
  if (!profile) return "";
  const splitText = (window.MDGYM_SPLIT_RATIONALE && window.MDGYM_SPLIT_RATIONALE[profile.daysPerWeek]) || "";
  const goalInfo = window.MDGYM_GOAL_INFO || {};
  const goalCatalog = window.MDGYM_GOALS || [];

  const goalsHtml = (profile.goals || [])
    .map((gid) => {
      const label = (goalCatalog.find((g) => g.id === gid) || {}).label || gid;
      const info = goalInfo[gid];
      if (!info) return "";
      return `<div class="goal-info-row"><div class="goal-info-title">${label}</div><p>${info.beneficio}</p></div>`;
    })
    .join("");

  const tiemposHtml = (profile.goals || [])
    .map((gid) => {
      const label = (goalCatalog.find((g) => g.id === gid) || {}).label || gid;
      const info = goalInfo[gid];
      if (!info) return "";
      return `<p style="margin:0 0 10px;"><b>${label}:</b> ${info.tiempo}</p>`;
    })
    .join("");

  return `
    <div class="section-title" style="margin-top:4px;">Por que esta rutina</div>
    <div class="card">
      <p style="margin:0;">${splitText}</p>
    </div>

    <div class="section-title">En que nos basamos</div>
    <div class="card">
      <p style="margin:0;">Para elegir los ejercicios de cada dia priorizamos primero los movimientos compuestos (los que trabajan varios musculos a la vez, como sentadillas, remos o press) por sobre los de aislamiento, filtramos solo los que se pueden hacer con el equipo que marcaste, y ajustamos series, repeticiones y descanso segun tu objetivo (ahora mismo ${profile.goalScheme.sets}x${profile.goalScheme.reps}, descanso ~${profile.goalScheme.restSec}s). La cantidad de rutinas posibles es finita: combinamos plantillas fijas de entrenamiento con tu equipo disponible, no es generacion aleatoria ni con IA.</p>
    </div>

    <div class="section-title">Beneficios esperados</div>
    <div class="card">
      ${goalsHtml || "<p style='margin:0;'>Segun el objetivo que elegiste.</p>"}
    </div>

    <div class="section-title">Cuando esperar resultados</div>
    <div class="card">
      ${tiemposHtml}
      <p class="note" style="margin-top:${tiemposHtml ? "2px" : "0"};">Estos tiempos son aproximados y de referencia general: varian mucho segun la persona, la alimentacion, el descanso y sobre todo la constancia. No son una promesa de resultados.</p>
    </div>
  `;
}

function openRoutineExplanationModal(profile) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">Por que esta rutina</div>
          <div class="modal-sub">Basado en tus respuestas del inicio</div>
        </div>
        <button class="icon-btn" id="btn-close-why" aria-label="Cerrar">${window.mdgymIcon("close", 18)}</button>
      </div>
      ${mdgymBuildRoutineExplanationHtml(profile)}
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#btn-close-why").addEventListener("click", close);
}

// ============================================================
// ONBOARDING
// ============================================================

// Secuencia de pasos segun el modo elegido. "mode" siempre es el primero
// (se resuelve con un click, no con el boton "Continuar"). Los pasos
// "explain"/"review" (asistente) y "build" (manual) tienen su propio
// contenido/footer especial dentro de renderOnboarding().
function mdgymOnboardSteps(mode) {
  if (mode === "manual") {
    return ["mode", "personal", "location", "equipment", "days", "build", "ready"];
  }
  return ["mode", "personal", "location", "equipment", "goals", "days", "explain", "review", "ready"];
}

// En "casa" no mostramos maquinas de gimnasio ni estaciones de polea: solo
// equipo que alguien podria tener realmente en su casa (peso corporal,
// pesas libres, bandas, etc.). El usuario igual tilda que tiene disponible.
function mdgymEquipmentForLocation(location) {
  if (location === "home") {
    return window.MDGYM_EQUIPMENT_CATALOG.filter((eq) => !eq.id.startsWith("machine_") && !eq.id.startsWith("cable_"));
  }
  return window.MDGYM_EQUIPMENT_CATALOG;
}

function renderOnboarding() {
  const root = document.getElementById("onboard-content");
  const step = STATE.onboardStep;
  const mode = STATE.onboardData.mode;

  // Paso "mode": eleccion inicial entre asistente y manual. No usa el
  // footer generico: elegir una tarjeta avanza directo al paso siguiente.
  if (step === "mode") {
    root.innerHTML = `
      <div class="onboard-title">¿Como queres armar tu rutina?</div>
      <div class="onboard-sub">Elegi la opcion que prefieras. Despues, desde Configuracion podes volver al inicio y cambiarla.</div>
      <div class="card" data-mode="assistant" style="cursor:pointer;">
        <div class="card-title" style="margin-bottom:6px; text-transform:none; letter-spacing:0; font-size:15px; color:var(--text);">Con el asistente</div>
        <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.5;">Te hacemos unas preguntas (objetivo, equipamiento, dias) y armamos la rutina por vos. Antes de confirmarla te explicamos en que se basa, y la podes ajustar si algo no te cierra.</p>
      </div>
      <div class="card" data-mode="manual" style="cursor:pointer;">
        <div class="card-title" style="margin-bottom:6px; text-transform:none; letter-spacing:0; font-size:15px; color:var(--text);">Manual (control total)</div>
        <p style="margin:0; font-size:13.5px; color:var(--text-muted); line-height:1.5;">Elegis vos mismo cada ejercicio, dia por dia, con tus propias series, repeticiones y descanso.</p>
      </div>
    `;
    root.querySelectorAll("[data-mode]").forEach((c) =>
      c.addEventListener("click", () => {
        STATE.onboardData.mode = c.dataset.mode;
        STATE.onboardStep = "personal";
        renderOnboarding();
      })
    );
    return;
  }

  // Paso "build": constructor manual, dia por dia. Footer propio.
  if (step === "build") {
    renderOnboardBuildStep(root);
    return;
  }

  // Paso "review": rutina propuesta por el asistente (o checklist de ajuste). Footer propio.
  if (step === "review") {
    renderOnboardReviewStep(root);
    return;
  }

  // Paso "ready": pantalla final antes de entrar a la app.
  if (step === "ready") {
    const profile = MDGymStore.getProfile();
    const isManual = profile && profile.mode === "manual";
    root.innerHTML = `
      <div class="onboard-title">Tu rutina esta lista</div>
      <div class="onboard-sub">${isManual ? "La armaste vos mismo, dia por dia." : "Antes de arrancar, esto es lo que armamos y por que."}</div>
      ${isManual ? "" : mdgymBuildRoutineExplanationHtml(profile)}
      <div class="btn-row" style="margin-top:18px;">
        <button class="btn btn-primary" id="ob-start">Empezar mi rutina</button>
      </div>
    `;
    document.getElementById("ob-start").addEventListener("click", () => showView("home"));
    return;
  }

  // Pasos con footer generico (Atras / Continuar): personal, location,
  // equipment, goals, days, explain.
  const steps = mdgymOnboardSteps(mode);
  const idx = steps.indexOf(step);
  const progressHtml = `<p class="note" style="text-align:center; margin-top:14px;">Paso ${idx + 1} de ${steps.length}</p>`;

  let body = "";
  if (step === "personal") {
    body = `
      <div class="onboard-title">Hola, arranquemos</div>
      <div class="onboard-sub">Con estos datos calculamos tu punto de partida (peso y masa magra estimada).</div>
      <div class="field">
        <label>Tu nombre</label>
        <input type="text" id="f-name" placeholder="Ej: David" value="${STATE.onboardData.name || ""}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>Edad</label>
          <input type="number" id="f-age" placeholder="Ej: 28" value="${STATE.onboardData.age}" />
        </div>
        <div class="field">
          <label>Sexo biologico</label>
          <select id="f-sex">
            <option value="M" ${STATE.onboardData.sex === "M" ? "selected" : ""}>Masculino</option>
            <option value="F" ${STATE.onboardData.sex === "F" ? "selected" : ""}>Femenino</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Peso actual (kg)</label>
          <input type="number" id="f-weight" placeholder="Ej: 78" value="${STATE.onboardData.weightKg}" />
        </div>
        <div class="field">
          <label>Altura (cm)</label>
          <input type="number" id="f-height" placeholder="Ej: 175" value="${STATE.onboardData.heightCm}" />
        </div>
      </div>
      <p class="note">El sexo biologico se usa solo para estimar tu masa magra (formula de Boer, 1984). Es una aproximacion, no una medicion real.</p>
    `;
  } else if (step === "location") {
    body = `
      <div class="onboard-title">¿Donde vas a entrenar?</div>
      <div class="onboard-sub">Esto define que equipamiento te vamos a mostrar en el paso siguiente.</div>
      <div class="chip-group" id="location-chips">
        <div class="chip chip-icon ${STATE.onboardData.location === "gym" ? "selected" : ""}" data-location="gym">${window.mdgymIcon("machine", 15)}<span>Gimnasio</span></div>
        <div class="chip chip-icon ${STATE.onboardData.location === "home" ? "selected" : ""}" data-location="home">${window.mdgymIcon("body", 15)}<span>Casa</span></div>
      </div>
      <p class="note">Si elegis "Casa", no te vamos a mostrar maquinas ni estaciones de polea de gimnasio: solo peso corporal, pesas libres, bandas y objetos que puedas tener ahi. Igual vas a poder tildar exactamente que tenes.</p>
    `;
  } else if (step === "equipment") {
    const catalog = mdgymEquipmentForLocation(STATE.onboardData.location);
    const groups = {};
    catalog.forEach((eq) => {
      groups[eq.group] = groups[eq.group] || [];
      groups[eq.group].push(eq);
    });
    body = `
      <div class="onboard-title">¿Que equipo tenes?</div>
      <div class="onboard-sub">${STATE.onboardData.location === "home" ? "Objetos que tengas en tu casa." : "En tu gym."} Tocá todo lo que tengas disponible.</div>
      ${Object.keys(groups)
        .map(
          (gname) => `
        <div class="equip-group-title">${gname}</div>
        <div class="chip-group">
          ${groups[gname]
            .map(
              (eq) =>
                `<div class="chip chip-icon ${STATE.onboardData.equipment.includes(eq.id) ? "selected" : ""}" data-equip="${eq.id}">${window.mdgymIcon(eq.icon, 15)}<span>${eq.label}</span></div>`
            )
            .join("")}
        </div>`
        )
        .join("")}
    `;
  } else if (step === "goals") {
    body = `
      <div class="onboard-title">¿Cual es tu objetivo?</div>
      <div class="onboard-sub">Podes elegir mas de uno. Definen series, repeticiones y descanso.</div>
      <div class="chip-group" id="goal-chips">
        ${window.MDGYM_GOALS.map(
          (g) => `<div class="chip ${STATE.onboardData.goals.includes(g.id) ? "selected" : ""}" data-goal="${g.id}">${g.label}</div>`
        ).join("")}
      </div>
    `;
  } else if (step === "days") {
    body = `
      <div class="onboard-title">¿Cuantos dias por semana?</div>
      <div class="onboard-sub">${mode === "manual" ? "Vas a armar los ejercicios de cada uno vos mismo." : "Con esto armamos tu split (rutina fija por dia)."}</div>
      <div class="chip-group" id="days-chips">
        ${[1, 2, 3, 4, 5, 6]
          .map(
            (n) =>
              `<div class="chip ${STATE.onboardData.daysPerWeek === n ? "selected" : ""}" data-days="${n}">${n} dia${n > 1 ? "s" : ""}</div>`
          )
          .join("")}
      </div>
      ${mode === "manual" ? "" : `<p class="note">La cantidad de rutinas posibles es finita: combinamos una plantilla de dia fija (full body, push/pull/legs, etc.) con tu equipo disponible.</p>`}
    `;
  } else if (step === "explain") {
    const tempScheme = window.mdgymCombineGoals(STATE.onboardData.goals);
    const fakeProfile = { goals: STATE.onboardData.goals, daysPerWeek: STATE.onboardData.daysPerWeek, goalScheme: tempScheme };
    body = `
      <div class="onboard-title">Antes de mostrarte la rutina...</div>
      <div class="onboard-sub">Esto es en que nos vamos a basar para armarla.</div>
      ${mdgymBuildRoutineExplanationHtml(fakeProfile)}
    `;
  }

  root.innerHTML = `
    ${body}
    ${progressHtml}
    <div class="btn-row" style="margin-top:10px;">
      ${idx > 0 ? `<button class="btn btn-secondary" id="ob-back">Atras</button>` : ""}
      <button class="btn btn-primary" id="ob-next">${step === "explain" ? "Generar mi rutina" : "Continuar"}</button>
    </div>
  `;

  if (step === "location") {
    root.querySelectorAll("[data-location]").forEach((c) =>
      c.addEventListener("click", () => {
        STATE.onboardData.location = c.dataset.location;
        root.querySelectorAll("[data-location]").forEach((x) => x.classList.remove("selected"));
        c.classList.add("selected");
      })
    );
  }
  if (step === "goals") {
    root.querySelectorAll("[data-goal]").forEach((c) =>
      c.addEventListener("click", () => {
        const id = c.dataset.goal;
        const i = STATE.onboardData.goals.indexOf(id);
        if (i >= 0) STATE.onboardData.goals.splice(i, 1);
        else STATE.onboardData.goals.push(id);
        c.classList.toggle("selected");
      })
    );
  }
  if (step === "equipment") {
    root.querySelectorAll("[data-equip]").forEach((c) =>
      c.addEventListener("click", () => {
        const id = c.dataset.equip;
        const i = STATE.onboardData.equipment.indexOf(id);
        if (i >= 0) STATE.onboardData.equipment.splice(i, 1);
        else STATE.onboardData.equipment.push(id);
        c.classList.toggle("selected");
      })
    );
  }
  if (step === "days") {
    root.querySelectorAll("[data-days]").forEach((c) =>
      c.addEventListener("click", () => {
        STATE.onboardData.daysPerWeek = Number(c.dataset.days);
        root.querySelectorAll("[data-days]").forEach((x) => x.classList.remove("selected"));
        c.classList.add("selected");
      })
    );
  }

  const backBtn = document.getElementById("ob-back");
  if (backBtn) backBtn.addEventListener("click", () => { STATE.onboardStep = steps[idx - 1]; renderOnboarding(); });

  document.getElementById("ob-next").addEventListener("click", () => onboardNext());
}

function onboardNext() {
  const step = STATE.onboardStep;
  const mode = STATE.onboardData.mode;

  if (step === "personal") {
    const name = document.getElementById("f-name").value.trim();
    const age = Number(document.getElementById("f-age").value);
    const sex = document.getElementById("f-sex").value;
    const weightKg = Number(document.getElementById("f-weight").value);
    const heightCm = Number(document.getElementById("f-height").value);
    if (!name || !age || !weightKg || !heightCm) {
      alert("Completa tu nombre, edad, peso y altura para continuar.");
      return;
    }
    Object.assign(STATE.onboardData, { name, age, sex, weightKg, heightCm });
  } else if (step === "location") {
    if (!STATE.onboardData.location) {
      alert("Elegi donde vas a entrenar.");
      return;
    }
  } else if (step === "equipment") {
    if (!STATE.onboardData.equipment.length) {
      alert("Marca al menos un equipo disponible (puede ser solo 'Peso corporal').");
      return;
    }
  } else if (step === "goals") {
    if (!STATE.onboardData.goals.length) {
      alert("Elegi al menos un objetivo.");
      return;
    }
  } else if (step === "days") {
    if (mode === "manual") {
      STATE.manualBuild = {
        dayIdx: 0,
        days: Array.from({ length: STATE.onboardData.daysPerWeek }, () => ({ exercises: [] })),
      };
      STATE.onboardStep = "build";
      renderOnboarding();
      return;
    }
  } else if (step === "explain") {
    STATE.previewRoutine = window.mdgymBuildRoutine(STATE.onboardData.daysPerWeek, STATE.onboardData.equipment, 0);
    STATE.onboardAdjustMode = false;
    STATE.adjustRemoved = {};
    STATE.onboardStep = "review";
    renderOnboarding();
    return;
  }

  const steps = mdgymOnboardSteps(mode);
  const idx = steps.indexOf(step);
  STATE.onboardStep = steps[idx + 1];
  renderOnboarding();
}

// ------------------------------------------------------------
// Paso "review" (asistente): muestra la rutina propuesta y pregunta si
// esta bien o si hay que ajustarla. Al ajustar, se tildan los ejercicios
// a sacar y se sugiere (regla fija, ver mdgymSuggestSimilar) un
// reemplazo para cada uno.
// ------------------------------------------------------------
function renderOnboardReviewStep(root) {
  if (!STATE.onboardAdjustMode) {
    const daysHtml = STATE.previewRoutine
      .map((day, i) => {
        const list = day.exercises
          .map((e) => `<div class="link-row" style="cursor:default;"><span>${e.name_es}</span><span class="badge">${e.equipment_es}</span></div>`)
          .join("");
        const missingNote = day.missing.length
          ? `<p class="note">Sin ejercicio disponible para: ${day.missing.join(", ")}.</p>`
          : "";
        return `
          <div class="card">
            <div class="card-title">Dia ${i + 1} &middot; ${day.label}</div>
            ${list}
            ${missingNote}
          </div>
        `;
      })
      .join("");
    root.innerHTML = `
      <div class="onboard-title">Tu rutina propuesta</div>
      <div class="onboard-sub">Revisala: la podes confirmar tal cual o sacar algun ejercicio.</div>
      ${daysHtml}
      <div class="btn-row" style="margin-top:10px; flex-direction:column; gap:10px;">
        <button class="btn btn-primary" id="ob-review-confirm">Esta perfecta, empezar</button>
        <button class="btn btn-secondary" id="ob-review-adjust">Quiero ajustar algo</button>
      </div>
    `;
    document.getElementById("ob-review-confirm").addEventListener("click", () => finishOnboardingAssistant());
    document.getElementById("ob-review-adjust").addEventListener("click", () => {
      STATE.onboardAdjustMode = true;
      STATE.adjustRemoved = {};
      renderOnboarding();
    });
    return;
  }

  // Modo ajuste: checklist de ejercicios a sacar, con sugerencia debajo.
  let rows = "";
  STATE.previewRoutine.forEach((day, dayIdx) => {
    rows += `<div class="equip-group-title">Dia ${dayIdx + 1} &middot; ${day.label}</div>`;
    const dayExcludeIds = new Set(day.exercises.map((e) => e.id));
    day.exercises.forEach((ex, exIdx) => {
      const key = `${dayIdx}-${exIdx}`;
      const marked = !!STATE.adjustRemoved[key];
      const suggestion = marked ? window.mdgymSuggestSimilar(ex.id, STATE.onboardData.equipment, dayExcludeIds) : null;
      rows += `
        <div class="link-row" style="cursor:default;">
          <span>${ex.name_es}</span>
          <button type="button" class="set-check adjust-check" data-key="${key}" data-done="${marked ? "true" : "false"}" aria-label="Sacar ${ex.name_es}">${marked ? window.mdgymIcon("check", 14) : ""}</button>
        </div>
      `;
      if (marked) {
        rows += suggestion
          ? `<p class="note" style="margin:-4px 0 12px;">Sugerencia para reemplazarlo: <b>${suggestion.name_es}</b><br/><label style="display:inline-flex; align-items:center; gap:6px; margin-top:4px;"><input type="checkbox" class="adjust-swap" data-key="${key}" data-subid="${suggestion.id}" checked /> Reemplazar con esta</label></p>`
          : `<p class="note" style="margin:-4px 0 12px;">No encontramos una alternativa con tu equipamiento actual para este musculo. Se va a sacar sin reemplazo.</p>`;
      }
    });
  });

  root.innerHTML = `
    <div class="onboard-title">¿Que ejercicio queres sacar?</div>
    <div class="onboard-sub">Tildá los que quieras sacar. Si encontramos una alternativa, te la sugerimos justo abajo.</div>
    ${rows}
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-secondary" id="ob-adjust-cancel">Cancelar</button>
      <button class="btn btn-primary" id="ob-adjust-apply">Aplicar cambios</button>
    </div>
  `;

  root.querySelectorAll(".adjust-check").forEach((btn) =>
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      STATE.adjustRemoved[key] = !STATE.adjustRemoved[key];
      renderOnboarding();
    })
  );
  document.getElementById("ob-adjust-cancel").addEventListener("click", () => {
    STATE.onboardAdjustMode = false;
    STATE.adjustRemoved = {};
    renderOnboarding();
  });
  document.getElementById("ob-adjust-apply").addEventListener("click", () => {
    const byDay = {};
    Object.keys(STATE.adjustRemoved).forEach((key) => {
      if (!STATE.adjustRemoved[key]) return;
      const [dayIdx, exIdx] = key.split("-").map(Number);
      byDay[dayIdx] = byDay[dayIdx] || [];
      byDay[dayIdx].push(exIdx);
    });
    Object.keys(byDay).forEach((dayIdxStr) => {
      const dayIdx = Number(dayIdxStr);
      const day = STATE.previewRoutine[dayIdx];
      // de mayor a menor indice: sacar/reemplazar sin correr los indices
      // de los que todavia faltan procesar en el mismo dia.
      byDay[dayIdx].sort((a, b) => b - a).forEach((exIdx) => {
        const key = `${dayIdx}-${exIdx}`;
        const swapCheckbox = document.querySelector(`.adjust-swap[data-key="${key}"]`);
        if (swapCheckbox && swapCheckbox.checked) {
          const subEx = window.MDGYM_EXERCISES.find((e) => e.id === swapCheckbox.dataset.subid);
          if (subEx) {
            day.exercises[exIdx] = subEx;
            return;
          }
        }
        day.exercises.splice(exIdx, 1);
      });
    });
    STATE.onboardAdjustMode = false;
    STATE.adjustRemoved = {};
    renderOnboarding();
  });
}

function finishOnboardingAssistant() {
  const d = STATE.onboardData;
  const goalScheme = window.mdgymCombineGoals(d.goals);
  const composition = MDGymCalc.estimateBodyComposition(d.weightKg, d.heightCm, d.sex);

  const profile = {
    name: d.name || "",
    age: d.age,
    sex: d.sex,
    weightKg: d.weightKg,
    heightCm: d.heightCm,
    mode: "assistant",
    location: d.location,
    goals: d.goals,
    equipment: d.equipment,
    daysPerWeek: d.daysPerWeek,
    goalScheme,
    weekIndex: 0,
    routine: STATE.previewRoutine,
    nextDayIndex: 0,
    startWeightKg: d.weightKg,
    startComposition: composition,
    startDate: todayISO(),
    lastRotationDate: todayISO(),
    rotationDismissedUntil: null,
    weeklyTipIndex: 0,
    createdAt: new Date().toISOString(),
  };
  MDGymStore.saveProfile(profile);
  MDGymStore.addBodyLog({ date: todayISO(), weightKg: d.weightKg });

  STATE.onboardStep = "ready";
  renderOnboarding();
}

// ------------------------------------------------------------
// Paso "build" (manual): elegis los ejercicios de cada dia vos mismo,
// con tus propias series/reps/descanso (sin esquema automatico).
// ------------------------------------------------------------
function renderOnboardBuildStep(root) {
  const dayIdx = STATE.manualBuild.dayIdx;
  const day = STATE.manualBuild.days[dayIdx];

  const pillsRow = STATE.manualBuild.days
    .map((d, i) => `<div class="day-pill ${i === dayIdx ? "today" : ""}" data-mbday="${i}">Dia ${i + 1}${d.exercises.length ? ` (${d.exercises.length})` : ""}</div>`)
    .join("");

  const exList = day.exercises.length
    ? day.exercises
        .map(
          (ex, exIdx) => `
        <div class="exercise-card" style="align-items:flex-start;">
          <div class="exercise-thumb"><img src="assets/muscles/${ex.muscle_group}.png" alt="${capitalize(ex.muscle_group)}" loading="lazy" /></div>
          <div class="exercise-info" style="width:100%;">
            <div class="exercise-name">${ex.name_es}</div>
            <div class="exercise-meta">${ex.equipment_es} &middot; ${capitalize(ex.muscle_group)}</div>
            <div class="field-row" style="margin-top:8px;">
              <div class="field" style="margin-bottom:0;"><label>Series</label><input type="number" class="mb-sets" data-exidx="${exIdx}" value="${ex.customSets}" /></div>
              <div class="field" style="margin-bottom:0;"><label>Reps</label><input type="number" class="mb-reps" data-exidx="${exIdx}" value="${ex.customReps}" /></div>
              <div class="field" style="margin-bottom:0;"><label>Descanso (s)</label><input type="number" class="mb-rest" data-exidx="${exIdx}" value="${ex.customRestSec}" /></div>
            </div>
            <button type="button" class="btn btn-danger" style="margin-top:8px; padding:8px 10px; font-size:12.5px; width:auto;" data-mbremove="${exIdx}">Sacar ejercicio</button>
          </div>
        </div>
      `
        )
        .join("")
    : `<p class="note">Todavia no agregaste ejercicios a este dia.</p>`;

  root.innerHTML = `
    <div class="onboard-title">Arma tu rutina</div>
    <div class="onboard-sub">Elegi los ejercicios de cada dia, con tus propias series, reps y descanso.</div>
    <div class="day-pill-row">${pillsRow}</div>
    <div class="section-title" style="margin-top:14px;">Dia ${dayIdx + 1}</div>
    ${exList}
    <button class="btn btn-secondary" id="btn-mb-add" style="margin-top:6px;">+ Agregar ejercicio</button>
    <div class="btn-row" style="margin-top:18px;">
      <button class="btn btn-secondary" id="ob-build-back">Atras</button>
      <button class="btn btn-primary" id="ob-build-finish">Terminar y guardar rutina</button>
    </div>
  `;

  root.querySelectorAll("[data-mbday]").forEach((p) =>
    p.addEventListener("click", () => {
      STATE.manualBuild.dayIdx = Number(p.dataset.mbday);
      renderOnboarding();
    })
  );
  document.getElementById("btn-mb-add").addEventListener("click", () => openManualExercisePicker(dayIdx));
  root.querySelectorAll("[data-mbremove]").forEach((b) =>
    b.addEventListener("click", () => {
      const exIdx = Number(b.dataset.mbremove);
      STATE.manualBuild.days[dayIdx].exercises.splice(exIdx, 1);
      renderOnboarding();
    })
  );
  root.querySelectorAll(".mb-sets, .mb-reps, .mb-rest").forEach((inp) =>
    inp.addEventListener("change", () => {
      const exIdx = Number(inp.dataset.exidx);
      const ex = STATE.manualBuild.days[dayIdx].exercises[exIdx];
      if (!ex) return;
      if (inp.classList.contains("mb-sets")) ex.customSets = Math.max(1, Number(inp.value) || 1);
      if (inp.classList.contains("mb-reps")) ex.customReps = Math.max(1, Number(inp.value) || 1);
      if (inp.classList.contains("mb-rest")) ex.customRestSec = Math.max(0, Number(inp.value) || 0);
    })
  );

  document.getElementById("ob-build-back").addEventListener("click", () => {
    STATE.onboardStep = "days";
    renderOnboarding();
  });
  document.getElementById("ob-build-finish").addEventListener("click", () => {
    const emptyDayIdx = STATE.manualBuild.days.findIndex((d) => !d.exercises.length);
    if (emptyDayIdx !== -1) {
      alert(`Al Dia ${emptyDayIdx + 1} todavia no le agregaste ningun ejercicio.`);
      STATE.manualBuild.dayIdx = emptyDayIdx;
      renderOnboarding();
      return;
    }
    finishOnboardingManual();
  });
}

// Modal generico para elegir un ejercicio del catalogo (filtrado por
// equipamiento disponible), con buscador simple por texto.
function openManualExercisePicker(dayIdx) {
  const equipmentList = STATE.onboardData.equipment;
  const pool = window.MDGYM_EXERCISES.filter((e) => equipmentList.includes(e.equipment));
  const groups = {};
  pool.forEach((e) => {
    groups[e.muscle_group] = groups[e.muscle_group] || [];
    groups[e.muscle_group].push(e);
  });

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">Agregar ejercicio</div>
          <div class="modal-sub">Filtrado por tu equipamiento</div>
        </div>
        <button class="icon-btn" id="btn-close-picker" aria-label="Cerrar">${window.mdgymIcon("close", 18)}</button>
      </div>
      <div class="field"><input type="text" id="picker-search" placeholder="Buscar ejercicio..." /></div>
      <div id="picker-list">
        ${Object.keys(groups)
          .map(
            (g) => `
          <div class="equip-group-title">${capitalize(g)}</div>
          ${groups[g].map((e) => `<div class="link-row" data-pick="${e.id}"><span>${e.name_es}</span><span class="badge">${e.equipment_es}</span></div>`).join("")}
        `
          )
          .join("")}
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#btn-close-picker").addEventListener("click", close);
  backdrop.querySelectorAll("[data-pick]").forEach((row) =>
    row.addEventListener("click", () => {
      const exId = row.dataset.pick;
      const ex = window.MDGYM_EXERCISES.find((e) => e.id === exId);
      if (!ex) return;
      STATE.manualBuild.days[dayIdx].exercises.push({ ...ex, customSets: 3, customReps: 10, customRestSec: 60 });
      close();
      renderOnboarding();
    })
  );
  backdrop.querySelector("#picker-search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    backdrop.querySelectorAll("[data-pick]").forEach((row) => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none";
    });
  });
}

function finishOnboardingManual() {
  const d = STATE.onboardData;
  const composition = MDGymCalc.estimateBodyComposition(d.weightKg, d.heightCm, d.sex);
  const routine = STATE.manualBuild.days.map((day, i) => ({
    dayType: "manual",
    label: `Dia ${i + 1}`,
    exercises: day.exercises,
    missing: [],
  }));

  const profile = {
    name: d.name || "",
    age: d.age,
    sex: d.sex,
    weightKg: d.weightKg,
    heightCm: d.heightCm,
    mode: "manual",
    location: d.location,
    goals: [],
    equipment: d.equipment,
    daysPerWeek: d.daysPerWeek,
    goalScheme: window.mdgymCombineGoals([]),
    weekIndex: 0,
    routine,
    nextDayIndex: 0,
    startWeightKg: d.weightKg,
    startComposition: composition,
    startDate: todayISO(),
    lastRotationDate: todayISO(),
    rotationDismissedUntil: null,
    weeklyTipIndex: 0,
    createdAt: new Date().toISOString(),
  };
  MDGymStore.saveProfile(profile);
  MDGymStore.addBodyLog({ date: todayISO(), weightKg: d.weightKg });

  STATE.onboardStep = "ready";
  renderOnboarding();
}

// ============================================================
// RESTART - volver al inicio (con perfil actual o desde cero)
// ============================================================
function openRestartModal() {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">Volver al inicio</div>
          <div class="modal-sub">Tu historial de entrenamientos no se borra con esto.</div>
        </div>
        <button class="icon-btn" id="btn-close-restart" aria-label="Cerrar">${window.mdgymIcon("close", 18)}</button>
      </div>
      <p class="note" style="margin-top:0;">¿Como queres empezar?</p>
      <div class="btn-row" style="flex-direction:column; gap:10px;">
        <button class="btn btn-secondary" id="btn-restart-keep">Usar mi perfil actual (para editarlo)</button>
        <button class="btn btn-danger" id="btn-restart-new">Crear un perfil nuevo desde cero</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#btn-close-restart").addEventListener("click", close);

  backdrop.querySelector("#btn-restart-keep").addEventListener("click", () => {
    const p = MDGymStore.getProfile();
    if (p) {
      STATE.onboardData = {
        name: p.name || "",
        age: p.age,
        weightKg: p.weightKg,
        heightCm: p.heightCm,
        sex: p.sex,
        mode: p.mode || "assistant",
        location: p.location || null,
        goals: [...(p.goals || [])],
        equipment: [...p.equipment],
        daysPerWeek: p.daysPerWeek,
      };
      // si el perfil actual era manual, prellenamos el constructor con lo
      // que ya tenia armado, para no obligar a rehacerlo todo desde cero.
      if (p.mode === "manual") {
        STATE.manualBuild = {
          dayIdx: 0,
          days: p.routine.map((d) => ({ exercises: d.exercises.map((e) => ({ ...e })) })),
        };
      } else {
        STATE.manualBuild = null;
      }
    }
    STATE.previewRoutine = null;
    STATE.onboardAdjustMode = false;
    STATE.adjustRemoved = {};
    STATE.onboardStep = "mode";
    close();
    showView("onboarding");
    renderOnboarding();
  });

  backdrop.querySelector("#btn-restart-new").addEventListener("click", () => {
    STATE.onboardData = { name: "", age: "", weightKg: "", heightCm: "", sex: "M", mode: null, location: null, goals: [], equipment: [], daysPerWeek: 3 };
    STATE.previewRoutine = null;
    STATE.onboardAdjustMode = false;
    STATE.adjustRemoved = {};
    STATE.manualBuild = null;
    STATE.onboardStep = "mode";
    close();
    showView("onboarding");
    renderOnboarding();
  });
}

// ============================================================
// HOME - dia de hoy (pestaña "Rutina")
// ============================================================
function renderHome() {
  mdgymStopRestTimer();
  const profile = MDGymStore.getProfile();
  const root = document.getElementById("home-content");
  if (!profile) return;

  const dayIdx = STATE.viewingDayIndex != null ? STATE.viewingDayIndex : profile.nextDayIndex;
  const day = profile.routine[dayIdx];
  const scheme = profile.goalScheme;
  const today = todayISO();
  const existingSession = MDGymStore.getSessionByDate(today);

  // Mensaje motivador semanal: si con el entreno de HOY se cierra la meta
  // de dias/semana (y hoy todavia no esta guardado), mostramos un empujon.
  const weekRange = mdgymGetWeekRangeForDate(new Date(today + "T00:00:00"));
  const weekStartIso = mdgymDateToISO(weekRange.start);
  const weekEndIso = mdgymDateToISO(weekRange.end);
  const sessionsThisWeek = MDGymStore.getSessions().filter((s) => s.date >= weekStartIso && s.date <= weekEndIso);
  const weekGoal = profile.daysPerWeek || 1;
  const weekRemaining = weekGoal - sessionsThisWeek.length;
  const weekMotivationHtml = (weekRemaining === 1 && !existingSession)
    ? `<div class="motivation-card motivation-week">${window.mdgymIcon("tip", 18)}<span>${mdgymMotivationText(window.MDGYM_MOTIVATION_WEEK, profile.name)}</span></div>`
    : "";

  if (!day || !day.exercises.length) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${window.mdgymIcon("box", 40, 1.4)}</div>
        <p>No pudimos armar ejercicios para este dia con el equipo que elegiste.<br/>Sumá mas equipo en Configuracion.</p>
      </div>
    `;
    return;
  }

  const pillsRow = profile.routine
    .map((d, i) => `<div class="day-pill ${i === dayIdx ? "today" : ""}" data-dayidx="${i}">Dia ${i + 1}</div>`)
    .join("");

  // si el mismo dayType se repite mas de una vez en la semana (ej: "full"
  // en un split de 3 dias), usamos una variante distinta para cada
  // repeticion en vez de mostrar el mismo texto los 3 dias.
  const dayTipPool = window.MDGYM_DAY_TIPS && window.MDGYM_DAY_TIPS[day.dayType];
  const dayTipOccurrence = profile.routine.slice(0, dayIdx).filter((d) => d.dayType === day.dayType).length;
  const dayTip = Array.isArray(dayTipPool) ? dayTipPool[dayTipOccurrence % dayTipPool.length] : dayTipPool;
  const dayTipHtml = dayTip
    ? `<div class="tip-card"><span class="tip-icon">${window.mdgymIcon("tip", 20)}</span><div><span class="tip-label">Por que este dia</span>${dayTip}</div></div>`
    : "";

  const weeksSince = mdgymWeeksSince(profile.lastRotationDate || profile.startDate);
  const isDismissed = profile.rotationDismissedUntil && today < profile.rotationDismissedUntil;
  // "Rotar variantes" regenera la rutina entera con el generador automatico:
  // no tiene sentido (y borraria lo armado a mano) para rutinas manuales.
  const suggestRotate = profile.mode !== "manual" && weeksSince >= 4 && !isDismissed;
  const suggestRotateHtml = suggestRotate
    ? `<div class="suggest-card">
        <p>Llevas ${weeksSince} semanas con los mismos ejercicios. Para seguir progresando puede convenir probar variantes, o seguir asi si todavia sentis que rinden.</p>
        <div class="btn-row">
          <button class="btn btn-secondary" id="btn-suggest-keep" style="flex:1;">Seguir con estos</button>
          <button class="btn btn-primary" id="btn-suggest-rotate" style="flex:1;">Cambiar variantes</button>
        </div>
      </div>`
    : "";

  const isEditingDay = STATE.editingDayIdx === dayIdx;

  const exCards = day.exercises
    .map((ex) => {
      // series/reps/descanso: si el ejercicio tiene sus propios valores
      // (rutina manual, o uno agregado a mano), se usan esos; si no, se usa
      // el esquema general segun el/los objetivo(s) elegidos (rutina armada
      // con el asistente).
      const exSets = ex.customSets != null ? ex.customSets : scheme.sets;
      const exReps = ex.customReps != null ? ex.customReps : scheme.reps;
      const exRestSec = ex.customRestSec != null ? ex.customRestSec : scheme.restSec;

      // si hoy ya guardaste este ejercicio, prellenamos con lo guardado.
      // si no, prellenamos con una sugerencia basada en tu ultima sesion
      // de este ejercicio (regla simple: si completaste todo la ultima vez,
      // sugiere subir un poco el peso; si no, sugiere repetir el mismo).
      const savedEx = existingSession
        ? existingSession.exercises.find((e) => e.exerciseId === ex.id) || null
        : null;
      const lastSessionInfo = MDGymStore.getLastSessionForExercise(ex.id, today);
      const suggestion = !savedEx ? mdgymSuggestNextWeight(ex.id, exReps, today) : null;

      let lastLabel = null;
      if (lastSessionInfo) {
        const withW = lastSessionInfo.sets.filter((s) => s.weightKg != null && s.weightKg !== "");
        if (withW.length) {
          const maxW = Math.max(...withW.map((s) => Number(s.weightKg)));
          lastLabel = `${maxW} kg (${formatDateEs(lastSessionInfo.date)})`;
        }
      }

      const setRows = [];
      for (let i = 0; i < exSets; i++) {
        const savedSet = savedEx && savedEx.sets && savedEx.sets[i] ? savedEx.sets[i] : null;
        const weightVal = savedSet
          ? (savedSet.weightKg != null ? savedSet.weightKg : "")
          : (suggestion ? suggestion.suggestedWeight : "");
        const repsVal = savedSet ? (savedSet.reps != null ? savedSet.reps : "") : exReps;
        const isDone = savedSet ? mdgymIsSetDone(savedSet) : false;
        setRows.push(`
          <div class="set-row ${isDone ? "done" : ""}" data-exid="${ex.id}" data-setidx="${i}">
            <span class="set-badge">${i + 1}</span>
            <input type="number" inputmode="numeric" class="set-reps" placeholder="reps" value="${repsVal}" />
            <input type="number" inputmode="decimal" class="set-weight" placeholder="kg" value="${weightVal}" />
            <button type="button" class="set-check" data-done="${isDone}" data-restsec="${exRestSec}" aria-label="Marcar serie ${i + 1} como hecha">${isDone ? window.mdgymIcon("check", 14) : ""}</button>
          </div>
        `);
      }

      const suggestionNote = suggestion
        ? (
            suggestion.bumped
              ? `<p class="set-suggestion">Sugerencia: probá ${suggestion.suggestedWeight} kg (la vez pasada completaste todo con ${suggestion.lastWeight} kg). Es un punto de partida, no una obligacion.</p>`
              : `<p class="set-suggestion">Repetí ${suggestion.suggestedWeight} kg: la vez pasada no llegaste a completar todas las series con ese peso y esas reps.</p>`
          )
        : "";

      const removeBtn = isEditingDay
        ? `<button type="button" class="btn btn-danger" style="margin-top:8px; padding:8px 10px; font-size:12.5px; width:auto;" data-removeex="${ex.id}">Sacar ejercicio</button>`
        : "";

      return `
        <div class="exercise-card" style="align-items:flex-start;">
          <div class="exercise-thumb" data-detail="${ex.id}"><img src="assets/muscles/${ex.muscle_group}.png" alt="${capitalize(ex.muscle_group)}" loading="lazy" /></div>
          <div class="exercise-info" style="width:100%;">
            <div class="exercise-name" data-detail="${ex.id}">${ex.name_es}</div>
            <div class="exercise-meta">${ex.equipment_es} · ${capitalize(ex.muscle_group)}${lastLabel ? ` · ultima vez: ${lastLabel}` : ""}</div>
            <div class="sets-table">
              <div class="sets-header"><span></span><span>Reps</span><span>Kg</span><span></span></div>
              ${setRows.join("")}
            </div>
            ${suggestionNote}
            ${removeBtn}
          </div>
        </div>
      `;
    })
    .join("");

  const homeSuggestionHtml =
    STATE.homeSuggestion && STATE.homeSuggestion.dayIdx === dayIdx
      ? STATE.homeSuggestion.suggestion
        ? `<div class="suggest-card"><p>Sacaste "${STATE.homeSuggestion.removedName}". ¿Agregar en su lugar <b>${STATE.homeSuggestion.suggestion.name_es}</b>?</p><div class="btn-row"><button class="btn btn-secondary" id="btn-dismiss-suggestion" style="flex:1;">No, gracias</button><button class="btn btn-primary" id="btn-accept-suggestion" style="flex:1;">Agregar</button></div></div>`
        : `<div class="suggest-card"><p>Sacaste "${STATE.homeSuggestion.removedName}" y no encontramos una alternativa con tu equipamiento actual para ese musculo.</p></div>`
      : "";

  const editToggleHtml = `<button class="btn btn-secondary" id="btn-toggle-edit" style="margin:12px 0 4px;">${isEditingDay ? "Listo" : "Editar ejercicios de este dia"}</button>`;

  const missingNote = day.missing.length
    ? `<p class="note" style="color:var(--danger);">⚠ Con tu equipo actual no encontramos ejercicio para: ${day.missing.join(", ")}. Sumá mas equipo (por ejemplo "Objetos varios") en Configuracion para completar este dia.</p>`
    : "";

  root.innerHTML = `
    <div class="day-pill-row">${pillsRow}</div>
    <div class="rest-timer-bar" id="rest-timer" style="display:none;">
      <span class="rest-timer-label">${window.mdgymIcon("tip", 15)} Descanso</span>
      <span class="rest-timer-clock" id="rest-timer-clock">0:00</span>
      <button type="button" class="btn btn-secondary" id="btn-skip-rest">Saltar</button>
    </div>
    <div class="section-title" style="margin-top:14px;">Dia ${dayIdx + 1} &middot; ${day.label}</div>
    <p class="note" style="margin-bottom:14px;">Descanso sugerido entre series: ~${scheme.restSec}s (se cuenta solo al marcar una serie hecha). Toca el circulo de cada serie cuando la termines. ¿Preferis hacer otro dia hoy? Tocá su pestaña arriba: el orden sigue solo desde ahi.</p>
    ${dayTipHtml}
    ${weekMotivationHtml}
    ${suggestRotateHtml}
    ${missingNote}
    <div id="day-motivation"></div>
    ${editToggleHtml}
    ${homeSuggestionHtml}
    ${exCards}
    <div class="finish-bar-spacer"></div>
  `;

  const isLastDayOfWeek = dayIdx === profile.routine.length - 1;
  const finishLabel = existingSession
    ? (isLastDayOfWeek ? "Actualizar semana" : "Actualizar dia")
    : (isLastDayOfWeek ? "Finalizar semana" : "Finalizar dia");
  const finishBar = document.createElement("div");
  finishBar.className = "finish-bar";
  finishBar.innerHTML = `
    <button class="btn btn-modern" id="btn-finish-day">
      <span>${finishLabel}</span>
      <span class="btn-modern-icon">${existingSession ? window.mdgymIcon("refresh", 18) : window.mdgymIcon("check", 18)}</span>
    </button>
  `;
  const oldBar = document.querySelector(".finish-bar");
  if (oldBar) oldBar.remove();
  document.getElementById("view-home").appendChild(finishBar);

  root.querySelectorAll("[data-dayidx]").forEach((p) =>
    p.addEventListener("click", () => {
      STATE.viewingDayIndex = Number(p.dataset.dayidx);
      renderHome();
    })
  );

  document.getElementById("btn-finish-day").addEventListener("click", () => finishDay(profile, day, dayIdx));

  // Mensaje motivador del dia: aparece cuando falta cargar el peso de un
  // solo ejercicio para terminar (no se re-sortea en cada tecla, solo al
  // entrar a ese estado, para que no cambie de mensaje todo el tiempo).
  // "Cargado" ahora es a nivel ejercicio: alcanza con que UNA de sus series
  // tenga peso, no todas.
  let dayMotivationVisible = false;
  function updateDayMotivation() {
    const total = day.exercises.length;
    const filled = day.exercises.filter((ex) =>
      Array.from(root.querySelectorAll(`.set-row[data-exid="${ex.id}"] .set-weight`)).some((inp) => inp.value !== "" && inp.value != null)
    ).length;
    const banner = document.getElementById("day-motivation");
    if (!banner) return;
    const shouldShow = total > 1 && filled === total - 1;
    if (shouldShow && !dayMotivationVisible) {
      banner.innerHTML = `<div class="motivation-card motivation-day">${window.mdgymIcon("tip", 18)}<span>${mdgymMotivationText(window.MDGYM_MOTIVATION_DAY, profile.name)}</span></div>`;
    } else if (!shouldShow) {
      banner.innerHTML = "";
    }
    dayMotivationVisible = shouldShow;
  }
  root.querySelectorAll(".set-weight").forEach((inp) => inp.addEventListener("input", updateDayMotivation));
  updateDayMotivation();

  // Check de serie: toggle done + arranca el timer de descanso al marcarla
  // (con el descanso propio de ESE ejercicio: el del objetivo general, o
  // el que se definio a mano si la rutina es manual / el ejercicio se
  // agrego a mano).
  root.querySelectorAll(".set-check").forEach((btn) => {
    btn.addEventListener("click", () => {
      const wasDone = btn.dataset.done === "true";
      const nowDone = !wasDone;
      btn.dataset.done = String(nowDone);
      btn.innerHTML = nowDone ? window.mdgymIcon("check", 14) : "";
      btn.closest(".set-row").classList.toggle("done", nowDone);
      if (nowDone) mdgymStartRestTimer(Number(btn.dataset.restsec) || scheme.restSec);
      updateDayMotivation();
    });
  });
  const skipRestBtn = document.getElementById("btn-skip-rest");
  if (skipRestBtn) skipRestBtn.addEventListener("click", mdgymStopRestTimer);

  root.querySelectorAll("[data-detail]").forEach((el) =>
    el.addEventListener("click", () => openExerciseDetail(el.dataset.detail))
  );

  // Editar ejercicios del dia: sacar alguno, con sugerencia de reemplazo.
  document.getElementById("btn-toggle-edit").addEventListener("click", () => {
    STATE.editingDayIdx = isEditingDay ? null : dayIdx;
    STATE.homeSuggestion = null;
    renderHome();
  });
  if (isEditingDay) {
    root.querySelectorAll("[data-removeex]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const exId = btn.dataset.removeex;
        const p = MDGymStore.getProfile();
        const d = p.routine[dayIdx];
        const idx = d.exercises.findIndex((e) => e.id === exId);
        if (idx === -1) return;
        const removedName = d.exercises[idx].name_es;
        const excludeIds = new Set(d.exercises.map((e) => e.id));
        const suggestion = window.mdgymSuggestSimilar(exId, p.equipment, excludeIds);
        d.exercises.splice(idx, 1);
        MDGymStore.saveProfile(p);
        STATE.homeSuggestion = { dayIdx, suggestion, removedName };
        renderHome();
      })
    );
  }
  const dismissSuggestionBtn = document.getElementById("btn-dismiss-suggestion");
  if (dismissSuggestionBtn) {
    dismissSuggestionBtn.addEventListener("click", () => {
      STATE.homeSuggestion = null;
      renderHome();
    });
  }
  const acceptSuggestionBtn = document.getElementById("btn-accept-suggestion");
  if (acceptSuggestionBtn) {
    acceptSuggestionBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      const d = p.routine[dayIdx];
      const subEx = STATE.homeSuggestion.suggestion;
      d.exercises.push({ ...subEx, customSets: scheme.sets, customReps: scheme.reps, customRestSec: scheme.restSec });
      MDGymStore.saveProfile(p);
      STATE.homeSuggestion = null;
      renderHome();
    });
  }

  const suggestRotateBtn = document.getElementById("btn-suggest-rotate");
  if (suggestRotateBtn) {
    suggestRotateBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      p.weekIndex = (p.weekIndex || 0) + 1;
      p.routine = window.mdgymBuildRoutine(p.daysPerWeek, p.equipment, p.weekIndex);
      p.nextDayIndex = p.nextDayIndex % p.routine.length;
      p.lastRotationDate = todayISO();
      p.rotationDismissedUntil = null;
      MDGymStore.saveProfile(p);
      STATE.viewingDayIndex = null;
      renderHome();
    });
  }
  const suggestKeepBtn = document.getElementById("btn-suggest-keep");
  if (suggestKeepBtn) {
    suggestKeepBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      const d = new Date(todayISO() + "T00:00:00");
      d.setDate(d.getDate() + 7);
      p.rotationDismissedUntil = d.toISOString().slice(0, 10);
      MDGymStore.saveProfile(p);
      renderHome();
    });
  }
}

// ============================================================
// PROGRESO POR EJERCICIO (peso maximo / 1RM estimado en el tiempo)
// ============================================================

// Estimacion de 1 repeticion maxima via formula de Epley (1 + reps/30).
// Es una ESTIMACION conocida y ampliamente usada, no una medicion real:
// se aleja mas de la realidad cuanto mas altas son las repeticiones.
function mdgymEstimateOneRepMax(weightKg, reps) {
  if (!weightKg || !reps) return null;
  return weightKg * (1 + reps / 30);
}

// Devuelve, por sesion en que se registro este ejercicio con algun peso,
// el punto {date, value} segun el modo pedido ("max" = peso maximo de esa
// sesion, "1rm" = 1RM estimado de esa sesion). Ordenado cronologicamente.
function mdgymExerciseProgressPoints(exerciseId, mode) {
  const sessions = MDGymStore.getSessions().slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const points = [];
  sessions.forEach((s) => {
    const ex = (s.exercises || []).find((e) => e.exerciseId === exerciseId);
    if (!ex || !ex.sets || !ex.sets.length) return;
    const withWeight = ex.sets.filter((st) => st.weightKg != null && st.weightKg !== "");
    if (!withWeight.length) return;
    let value;
    if (mode === "1rm") {
      const estimates = withWeight.map((st) => mdgymEstimateOneRepMax(Number(st.weightKg), Number(st.reps) || 1) || 0);
      value = Math.max(...estimates);
    } else {
      value = Math.max(...withWeight.map((st) => Number(st.weightKg)));
    }
    points.push({ date: s.date, value: Math.round(value * 10) / 10 });
  });
  return points;
}

// ============================================================
// DETALLE DE EJERCICIO (modal)
// ============================================================
function openExerciseDetail(exerciseId) {
  const ex = window.MDGYM_EXERCISES.find((e) => e.id === exerciseId);
  if (!ex) return;
  const howto = ex.howto_images || [];

  const gallery = howto.length
    ? `<div class="howto-gallery">${howto
        .slice(0, 3)
        .map((src) => `<img src="${src}" alt="${ex.name_es}" loading="lazy" />`)
        .join("")}</div>`
    : `<div class="howto-empty">Todavia no tenemos fotos de ejecucion para este ejercicio. Guiate por el musculo marcado y la descripcion de abajo.</div>`;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">${ex.name_es}</div>
          <div class="modal-sub">${ex.equipment_es} · ${capitalize(ex.muscle_group)}</div>
        </div>
        <button class="icon-btn" id="btn-close-detail" aria-label="Cerrar">${window.mdgymIcon("close", 18)}</button>
      </div>
      <img class="modal-muscle-img" src="assets/muscles/${ex.muscle_group}.png" alt="${capitalize(ex.muscle_group)}" />
      ${gallery}
      <div class="modal-instructions">${ex.instructions_es || ""}</div>
      <div id="exercise-progress-section"></div>
    </div>
  `;
  document.body.appendChild(backdrop);

  let progressMode = "max";
  function renderProgressSection() {
    const points = mdgymExerciseProgressPoints(exerciseId, progressMode);
    const section = backdrop.querySelector("#exercise-progress-section");
    if (!section) return;
    const chart = points.length >= 2 ? mdgymLineChartSvg(points.map((p) => ({ value: p.value }))) : null;
    const last = points.length ? points[points.length - 1] : null;
    const modeNote = progressMode === "1rm"
      ? " El 1RM es una ESTIMACION (formula de Epley a partir de peso y reps), no una medicion real de tu maximo."
      : "";
    section.innerHTML = `
      <div class="section-title" style="margin-top:16px; margin-bottom:8px;">Tu progreso</div>
      <div class="btn-row">
        <button class="btn ${progressMode === "max" ? "btn-primary" : "btn-secondary"}" id="btn-progress-max" style="flex:1; padding:10px 12px; font-size:13px;">Peso maximo</button>
        <button class="btn ${progressMode === "1rm" ? "btn-primary" : "btn-secondary"}" id="btn-progress-1rm" style="flex:1; padding:10px 12px; font-size:13px;">1RM estimado</button>
      </div>
      ${
        chart
          ? `<div class="chart-wrap" style="margin-top:10px;">${chart}</div>`
          : `<p class="note" style="margin-top:10px;">${points.length === 0 ? "Todavia no registraste peso en este ejercicio." : "Con un solo registro todavia no hay curva para mostrar. Segui cargando y va a aparecer."}</p>`
      }
      ${last ? `<p class="note" style="margin-top:8px; margin-bottom:0;">Ultimo registro: ${last.value} kg (${formatDateEs(last.date)}).${modeNote}</p>` : ""}
    `;
    section.querySelector("#btn-progress-max").addEventListener("click", () => { progressMode = "max"; renderProgressSection(); });
    section.querySelector("#btn-progress-1rm").addEventListener("click", () => { progressMode = "1rm"; renderProgressSection(); });
  }
  renderProgressSection();

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#btn-close-detail").addEventListener("click", close);
}

// ============================================================
// CREDITOS (atribucion de imagenes de wger.de)
// ============================================================
function openCreditsModal() {
  const items = (window.MDGYM_ATTRIBUTIONS || [])
    .map(
      (a) => `
      <div class="credit-row">
        <div class="credit-exercise">${a.exercise_es}</div>
        <div class="credit-meta">${a.author} · <a href="${a.license_url}" target="_blank" rel="noopener">${a.license}</a></div>
      </div>`
    )
    .join("");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">Creditos de imagenes</div>
          <div class="modal-sub">Fuente: wger.de (API publica) · CC-BY-SA 3.0/4.0 y CC0</div>
        </div>
        <button class="icon-btn" id="btn-close-credits" aria-label="Cerrar">${window.mdgymIcon("close", 18)}</button>
      </div>
      <p class="note" style="margin-top:0;">Los 8 diagramas musculares tambien se compusieron a partir de siluetas y superposiciones de musculos publicadas por wger.de, licencia CC-BY-SA 3.0.</p>
      <div class="credit-list">${items}</div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#btn-close-credits").addEventListener("click", close);
}

// ============================================================
// RESUMEN SEMANAL (al terminar el ultimo dia del ciclo)
// ============================================================
function openWeeklyWrapModal() {
  const pool = window.MDGYM_WEEKLY_TIPS || [];
  const p = MDGymStore.getProfile();
  const idx = pool.length && p ? (p.weeklyTipIndex || 0) % pool.length : 0;
  const tip = pool[idx] || "";

  if (p) {
    p.weeklyTipIndex = pool.length ? (idx + 1) % pool.length : 0;
    MDGymStore.saveProfile(p);
  }

  // "Actualizar ejercicios" regenera la rutina con el generador automatico
  // (mismas plantillas por tipo de dia): no aplica a rutinas manuales,
  // porque las armaste vos mismo ejercicio por ejercicio.
  const canRegenerate = !!(p && p.mode !== "manual");

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-header">
        <div>
          <div class="modal-title">¡Completaste la semana!</div>
          <div class="modal-sub">Entrenamiento guardado. Buen trabajo.</div>
        </div>
        <button class="icon-btn" id="btn-close-weekly" aria-label="Cerrar">${window.mdgymIcon("close", 18)}</button>
      </div>
      ${tip ? `<div class="tip-card" style="margin-bottom:14px;"><span class="tip-icon">${window.mdgymIcon("tip", 20)}</span><div><span class="tip-label">Tip de la semana</span>${tip}</div></div>` : ""}
      <p class="note" style="margin-top:0;">¿Como arrancamos la semana que viene?</p>
      <div class="btn-row" style="flex-direction:column; gap:10px;">
        <button class="btn btn-secondary" id="btn-weekly-repeat">Repetir los mismos ejercicios</button>
        ${canRegenerate ? `<button class="btn btn-primary" id="btn-weekly-update">Actualizar ejercicios</button>` : ""}
      </div>
      <p class="note">${canRegenerate ? "Si repetis, las series arrancan sin marcar de nuevo: se guardan por fecha, no hace falta borrar nada a mano." : "Tu rutina es manual, asi que no se puede regenerar automaticamente: para cambiar ejercicios, edita cada dia desde la pestaña Rutina."}</p>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  backdrop.querySelector("#btn-close-weekly").addEventListener("click", close);

  const repeatBtn = backdrop.querySelector("#btn-weekly-repeat");
  if (repeatBtn) {
    repeatBtn.addEventListener("click", close);
  }

  const updateBtn = backdrop.querySelector("#btn-weekly-update");
  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      const prof = MDGymStore.getProfile();
      if (!prof) { close(); return; }
      prof.weekIndex = (prof.weekIndex || 0) + 1;
      prof.routine = window.mdgymBuildRoutine(prof.daysPerWeek, prof.equipment, prof.weekIndex);
      prof.nextDayIndex = 0;
      prof.lastRotationDate = todayISO();
      prof.rotationDismissedUntil = null;
      MDGymStore.saveProfile(prof);
      close();
      STATE.viewingDayIndex = null;
      renderHome();
    });
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function finishDay(profile, day, dayIdx) {
  const root = document.getElementById("home-content");
  const exercisesLog = day.exercises.map((exData) => {
    const setRows = Array.from(root.querySelectorAll(`.set-row[data-exid="${exData.id}"]`));
    const sets = setRows.map((row) => {
      const weightInput = row.querySelector(".set-weight");
      const repsInput = row.querySelector(".set-reps");
      const checkBtn = row.querySelector(".set-check");
      const weightKg = weightInput && weightInput.value !== "" ? Number(weightInput.value) : null;
      const reps = repsInput && repsInput.value !== "" ? Number(repsInput.value) : null;
      const checked = checkBtn && checkBtn.dataset.done === "true";
      // si cargaste un peso pero te olvidaste de tocar el check, igual cuenta
      // como hecha: no queremos penalizarte por no tocar un boton de mas.
      const done = checked || weightKg != null;
      return { reps, weightKg, done };
    });
    return { exerciseId: exData.id, name_es: exData.name_es, sets };
  });

  const session = {
    date: todayISO(),
    dayType: day.dayType,
    dayLabel: day.label,
    exercises: exercisesLog,
  };
  MDGymStore.upsertSession(session);

  const wasLastDay = dayIdx === profile.routine.length - 1;

  // el dia que efectivamente completaste (sea el que tocaba o uno que elegiste
  // vos a mano) pasa a marcar el orden: el siguiente sugerido es el que sigue
  // a ESE, no al que originalmente tocaba. Asi podes "cambiar el orden" solo
  // tocando otro dia y terminandolo.
  profile.nextDayIndex = (dayIdx + 1) % profile.routine.length;
  MDGymStore.saveProfile(profile);
  STATE.viewingDayIndex = null;
  renderHome();

  if (wasLastDay) {
    openWeeklyWrapModal();
  } else {
    alert("Entrenamiento guardado. ¡Buen trabajo!");
  }
}

// ============================================================
// HISTORIAL
// ============================================================
// ============================================================
// MES - calendario de cumplimiento + grafico de avance
// ============================================================

// % de ejercicios de una sesion que tienen al menos una serie marcada como
// hecha (via el check, o via tener un peso cargado en datos viejos sin ese flag).
function mdgymSessionCompletionPct(session) {
  if (!session || !session.exercises || !session.exercises.length) return 0;
  const completed = session.exercises.filter(
    (e) => e.sets && e.sets.some((s) => mdgymIsSetDone(s))
  ).length;
  return Math.round((completed / session.exercises.length) * 100);
}

function mdgymDateToISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mdgymFormatShortDate(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Devuelve las semanas (lunes a domingo) que tocan el mes dado, aunque se
// extiendan al mes anterior o siguiente. Sirve para poder decir "esta semana
// entrenaste X de tus Y dias" sin importar en que mes cae cada extremo.
function mdgymGetWeekRangesForMonth(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // lunes=0
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setDate(firstOfMonth.getDate() - firstWeekday);

  const lastWeekday = (lastOfMonth.getDay() + 6) % 7;
  const lastSunday = new Date(lastOfMonth);
  lastSunday.setDate(lastOfMonth.getDate() + (6 - lastWeekday));

  const weeks = [];
  const cursor = new Date(firstMonday);
  while (cursor <= lastSunday) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    weeks.push({ start, end });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function renderMonthView() {
  const profile = MDGymStore.getProfile();
  const root = document.getElementById("month-content");
  if (!profile) return;

  const offset = STATE.monthViewOffset || 0;
  const base = new Date();
  const viewDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexado

  const monthLabel = viewDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const sessions = MDGymStore.getSessions();
  const sessionByDate = {};
  sessions.forEach((s) => { sessionByDate[s.date] = s; });

  const firstOfMonth = new Date(year, month, 1);
  const jsDay = firstOfMonth.getDay(); // 0=domingo..6=sabado
  const leadingBlanks = (jsDay + 6) % 7; // pasa a lunes=0..domingo=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayISO();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push(`<div class="cal-cell cal-empty"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const session = sessionByDate[dateStr];
    const isToday = dateStr === todayStr;
    let pctHtml = "";
    let tierClass = "";
    if (session) {
      const pct = mdgymSessionCompletionPct(session);
      tierClass = pct >= 80 ? "cal-high" : pct >= 40 ? "cal-mid" : "cal-low";
      pctHtml = `<span class="cal-pct">${pct}%</span>`;
    }
    cells.push(`
      <div class="cal-cell ${session ? "cal-trained " + tierClass : ""} ${isToday ? "cal-today" : ""}" data-caldate="${dateStr}" title="${dateStr}">
        <span class="cal-daynum">${day}</span>
        ${pctHtml}
      </div>
    `);
  }

  const weekdayLabels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const chartSvg = renderCompletionChartSvg(sessions);

  // ------------------------------------------------------------
  // Cumplimiento semanal: la meta real es profile.daysPerWeek, no 7.
  // Si el objetivo es 3 dias/semana, tener otros 4 dias sin entrenamiento
  // ESE mismo criterio ya no penaliza en el calendario (dias sin sesion
  // quedan neutros, sin "0%"), pero aca lo hacemos explicito semana por
  // semana para que quede claro que cumplir la cantidad de dias pactada
  // es lo que cuenta, entrenes o no el resto de los dias.
  // ------------------------------------------------------------
  const goal = profile.daysPerWeek || 1;
  const todayDateObj = new Date(todayStr + "T00:00:00");
  const weekRanges = mdgymGetWeekRangesForMonth(year, month);
  const weekRowsHtml = weekRanges.map((w) => {
    const startIso = mdgymDateToISO(w.start);
    const endIso = mdgymDateToISO(w.end);
    const trainedCount = sessions.filter((s) => s.date >= startIso && s.date <= endIso).length;
    const isOngoing = todayDateObj >= w.start && todayDateObj <= w.end;
    const met = trainedCount >= goal;
    let statusHtml;
    if (isOngoing) {
      statusHtml = `<span class="week-status week-ongoing">Semana en curso</span>`;
    } else if (met) {
      statusHtml = `<span class="week-status week-met">Meta cumplida</span>`;
    } else {
      statusHtml = `<span class="week-status week-notmet">No llegaste a la meta</span>`;
    }
    return `
      <div class="week-row">
        <div>
          <div class="week-range">${mdgymFormatShortDate(w.start)} al ${mdgymFormatShortDate(w.end)}</div>
          <div class="week-count">${trainedCount}/${goal} dia${goal === 1 ? "" : "s"} entrenado${trainedCount === 1 ? "" : "s"}</div>
        </div>
        ${statusHtml}
      </div>
    `;
  }).join("");

  root.innerHTML = `
    <div class="section-title" style="margin-top:10px;">Mes</div>
    <div class="card">
      <div class="cal-month-nav">
        <button class="icon-btn" id="btn-month-prev" aria-label="Mes anterior">‹</button>
        <span class="cal-month-label">${monthLabel}</span>
        <button class="icon-btn" id="btn-month-next" aria-label="Mes siguiente">›</button>
      </div>
      <div class="cal-weekdays" style="margin-top:14px;">${weekdayLabels.map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
      <p class="note" style="margin-top:12px; margin-bottom:0;">El porcentaje es cuantos de los ejercicios de ese dia registraste con un peso (aunque sea en uno solo). Los dias sin numero de porcentaje no tenes entrenamiento guardado ahi (no es un 0%, simplemente no entrenaste ese dia).</p>
    </div>

    <div class="section-title">Cumplimiento semanal</div>
    <div class="card">
      ${weekRowsHtml}
      <p class="note" style="margin-top:10px; margin-bottom:0;">Tu meta es ${goal} dia${goal === 1 ? "" : "s"} por semana. Si ya entrenaste esa cantidad, el resto de los dias de la semana NO cuentan en contra aunque el calendario de arriba los muestre vacios.</p>
    </div>

    <div class="section-title">Avance: dias entrenados vs % completado</div>
    <div class="card">
      <div class="chart-wrap">${chartSvg}</div>
    </div>
  `;

  document.getElementById("btn-month-prev").addEventListener("click", () => {
    STATE.monthViewOffset = (STATE.monthViewOffset || 0) - 1;
    renderMonthView();
  });
  document.getElementById("btn-month-next").addEventListener("click", () => {
    STATE.monthViewOffset = (STATE.monthViewOffset || 0) + 1;
    renderMonthView();
  });
}

function renderCompletionChartSvg(sessions) {
  const sorted = sessions.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!sorted.length) {
    return `<p class="note">Todavia no hay entrenamientos registrados.</p>`;
  }
  const W = 420, H = 140, PAD = 24;
  const pcts = sorted.map((s) => mdgymSessionCompletionPct(s));
  const stepX = sorted.length > 1 ? (W - PAD * 2) / (sorted.length - 1) : 0;

  const points = pcts.map((pct, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - (pct / 100) * (H - PAD * 2);
    return [x, y];
  });
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const dots = points
    .map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--accent)" />`)
    .join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--border)" stroke-width="1" />
      <line x1="${PAD}" y1="${PAD}" x2="${W - PAD}" y2="${PAD}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3" />
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" />
      ${dots}
    </svg>
  `;
}

function renderHistory() {
  const profile = MDGymStore.getProfile();
  const root = document.getElementById("history-content");
  if (!profile) return;

  const bodyLog = MDGymStore.getBodyLog();
  const lastEntry = bodyLog[bodyLog.length - 1];
  const currentComposition = lastEntry
    ? MDGymCalc.estimateBodyComposition(lastEntry.weightKg, profile.heightCm, profile.sex)
    : profile.startComposition;

  const chartSvg = renderWeightChartSvg(bodyLog);
  const measurementDefs = [
    { key: "cintura", label: "Cintura", unit: "cm" },
    { key: "pecho", label: "Pecho", unit: "cm" },
    { key: "brazo", label: "Brazo", unit: "cm" },
  ];
  const lastMeasurements = {};
  measurementDefs.forEach((m) => {
    const withData = bodyLog.filter((e) => e.measurements && e.measurements[m.key] != null && e.measurements[m.key] !== "");
    if (withData.length) lastMeasurements[m.key] = withData[withData.length - 1].measurements[m.key];
  });
  const measurementChartsHtml = measurementDefs
    .map((m) => {
      const chart = mdgymMeasurementChartSvg(bodyLog, m.key);
      if (!chart) return "";
      return `
        <div class="section-title">Evolucion de ${m.label.toLowerCase()}</div>
        <div class="card">
          <div class="chart-wrap">${chart}</div>
          <p class="note" style="margin-top:8px; margin-bottom:0;">Ultimo registro: ${lastMeasurements[m.key]} ${m.unit}.</p>
        </div>
      `;
    })
    .join("");

  // ultimos ejercicios registrados (por sesion, mas reciente primero)
  const sessions = MDGymStore.getSessions().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const recentRows = [];
  sessions.slice(0, 8).forEach((s) => {
    s.exercises.forEach((e) => {
      // mostramos el peso MAXIMO entre las series de ese ejercicio ese dia
      // (con series individuales, la primera puede ser una entrada en calor)
      const withWeight = (e.sets || []).filter((st) => st.weightKg != null && st.weightKg !== "");
      const w = withWeight.length ? Math.max(...withWeight.map((st) => Number(st.weightKg))) : null;
      if (w != null) recentRows.push({ date: s.date, name: e.name_es, weight: w });
    });
  });

  root.innerHTML = `
    <div class="section-title" style="margin-top:10px;">Punto de partida</div>
    <div class="card">
      <div class="stat-row">
        <div class="stat"><div class="value">${profile.startWeightKg} kg</div><div class="label">Peso inicial</div></div>
        <div class="stat"><div class="value">${profile.startComposition.leanMassKg} kg</div><div class="label">Masa magra est.</div></div>
        <div class="stat"><div class="value">${profile.startComposition.fatPct}%</div><div class="label">% Grasa est.</div></div>
      </div>
      <p class="note">Registrado el ${formatDateEs(profile.startDate)}. La masa magra/grasa es una ESTIMACION (formula de Boer 1984, margen ±3-4kg vs DEXA), no una medicion real por bioimpedancia o pliegues.</p>
    </div>

    <div class="section-title">Evolucion de peso corporal</div>
    <div class="card">
      <div class="chart-wrap">${chartSvg}</div>
      <div class="stat-row" style="margin-top:12px;">
        <div class="stat"><div class="value">${lastEntry ? lastEntry.weightKg : profile.startWeightKg} kg</div><div class="label">Peso actual</div></div>
        <div class="stat"><div class="value">${currentComposition.leanMassKg} kg</div><div class="label">Masa magra est.</div></div>
      </div>
      <div class="field" style="margin-top:14px;">
        <label>Registrar peso de hoy (kg)</label>
        <input type="number" id="f-bodyweight-today" placeholder="Ej: 77.5" />
      </div>
      <p class="note" style="margin-top:10px; margin-bottom:6px;">Medidas de hoy (opcional, en cm)</p>
      <div class="field-row">
        <div class="field"><label>Cintura</label><input type="number" id="f-measure-cintura" placeholder="Ej: 82" /></div>
        <div class="field"><label>Pecho</label><input type="number" id="f-measure-pecho" placeholder="Ej: 98" /></div>
        <div class="field"><label>Brazo</label><input type="number" id="f-measure-brazo" placeholder="Ej: 34" /></div>
      </div>
      <button class="btn btn-primary" id="btn-add-bodyweight" style="margin-top:10px;">Guardar</button>
    </div>

    ${measurementChartsHtml}

    <div class="section-title">Ultimos pesos registrados</div>
    <div class="card">
      ${
        recentRows.length
          ? recentRows
              .map(
                (r) => `<div class="history-item"><div><div class="name">${r.name}</div><div class="sub">${formatDateEs(r.date)}</div></div><div class="val">${r.weight} kg</div></div>`
              )
              .join("")
          : `<p class="note">Todavia no registraste ningun entrenamiento.</p>`
      }
    </div>
  `;

  document.getElementById("btn-add-bodyweight").addEventListener("click", () => {
    const val = Number(document.getElementById("f-bodyweight-today").value);
    if (!val) { alert("Ingresa un peso valido."); return; }
    const measurements = {};
    measurementDefs.forEach((m) => {
      const raw = document.getElementById(`f-measure-${m.key}`).value;
      if (raw !== "") measurements[m.key] = Number(raw);
    });
    const entry = { date: todayISO(), weightKg: val };
    if (Object.keys(measurements).length) entry.measurements = measurements;
    MDGymStore.addBodyLog(entry);
    renderHistory();
  });
}

// Grafico de linea generico a partir de una lista de {value} en orden
// cronologico. Devuelve null si no hay suficientes puntos para trazar algo.
function mdgymLineChartSvg(points) {
  if (!points || points.length < 2) return null;
  const W = 420, H = 140, PAD = 24;
  const values = points.map((p) => p.value);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p.value - min) / range) * (H - PAD * 2);
    return [x, y];
  });
  const path = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(" ");
  const dots = coords.map((c) => `<circle cx="${c[0]}" cy="${c[1]}" r="3.5" fill="var(--accent)" />`).join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" />
      ${dots}
    </svg>
  `;
}

function renderWeightChartSvg(bodyLog) {
  if (!bodyLog.length) {
    return `<p class="note">Todavia no hay registros de peso corporal.</p>`;
  }
  if (bodyLog.length === 1) {
    return `<p class="note">Con un solo registro todavia no hay curva para mostrar. Agrega otro mas adelante.</p>`;
  }
  return mdgymLineChartSvg(bodyLog.map((e) => ({ value: e.weightKg })));
}

// Grafico de una medida corporal especifica (cintura, pecho, brazo...).
// null si hay menos de 2 registros de esa medida puntual.
function mdgymMeasurementChartSvg(bodyLog, key) {
  const pts = bodyLog
    .filter((e) => e.measurements && e.measurements[key] != null && e.measurements[key] !== "")
    .map((e) => ({ value: Number(e.measurements[key]) }));
  return mdgymLineChartSvg(pts);
}

// ============================================================
// CONFIGURACION
// ============================================================
function renderSettings() {
  const profile = MDGymStore.getProfile();
  const settings = MDGymStore.getSettings();
  const root = document.getElementById("settings-content");

  const themes = [
    { id: "oscuro", label: "Oscuro", bg: "#0a0e18", accent: "#22c55e" },
    { id: "claro", label: "Claro", bg: "#f4f6fb", accent: "#2563eb" },
    { id: "sepia", label: "Sepia", bg: "#f2e8d5", accent: "#a9631a" },
    { id: "mar", label: "Mar", bg: "#072534", accent: "#22c1c3" },
    { id: "rosa", label: "Rosa", bg: "#fff0f5", accent: "#e0518f" },
    { id: "rojoblanco", label: "Rojo y blanco", bg: "#ffffff", accent: "#c81e2c" },
    { id: "violeta", label: "Violeta pastel", bg: "#f3edfb", accent: "#8b6fc4" },
    { id: "bosque", label: "Verde bosque", bg: "#0d1f14", accent: "#4caf6d" },
  ];
  const lightThemeIds = ["claro", "sepia", "rosa", "rojoblanco", "violeta"];
  const themeSwatches = themes
    .map(
      (t) => `
      <div class="theme-swatch ${settings.theme === t.id ? "selected" : ""}" data-theme-choice="${t.id}"
           style="background:${t.bg};">
        <div style="position:absolute; bottom:22px; left:8px; width:16px; height:16px; border-radius:50%; background:${t.accent};"></div>
        <span class="lbl" style="color:${lightThemeIds.includes(t.id) ? "#000" : "#fff"};">${t.label}</span>
      </div>`
    )
    .join("");

  const logoIds = Object.keys(window.MDGYM_LOGO_LABELS || {});
  const logoSwatches = logoIds
    .map(
      (id) => `
      <div class="logo-swatch ${settings.logo === id || (!settings.logo && id === "barra") ? "selected" : ""}" data-logo-choice="${id}">
        ${window.mdgymLogo(id, 30)}
        <span class="lbl2">${window.MDGYM_LOGO_LABELS[id]}</span>
      </div>`
    )
    .join("");

  let profileSection = "";
  if (profile) {
    const isManualProfile = profile.mode === "manual";
    const goalLabelsMap = {};
    (window.MDGYM_GOALS || []).forEach((g) => { goalLabelsMap[g.id] = g.label; });
    const goalChipsHtml = (profile.goals || [])
      .map((gid) => `<span class="chip" style="cursor:default;">${goalLabelsMap[gid] || gid}</span>`)
      .join("");

    profileSection = `
      <div class="section-title">Mi Perfil</div>
      <div class="card">
        <div class="stat-row">
          <div class="stat"><div class="value">${profile.age}</div><div class="label">Años</div></div>
          <div class="stat"><div class="value">${profile.weightKg} kg</div><div class="label">Peso</div></div>
          <div class="stat"><div class="value">${profile.heightCm} cm</div><div class="label">Altura</div></div>
        </div>
        ${isManualProfile ? `<p class="note" style="margin-top:12px;">Rutina armada de forma manual, ${profile.daysPerWeek} dia${profile.daysPerWeek > 1 ? "s" : ""} por semana.</p>` : `
        <p class="note" style="margin-top:12px; margin-bottom:6px;">Objetivo(s)</p>
        <div class="chip-group">${goalChipsHtml}</div>
        <p class="note" style="margin-top:12px;">Entrenas ${profile.daysPerWeek} dia${profile.daysPerWeek > 1 ? "s" : ""} por semana, con ${profile.equipment.length} equipos marcados.</p>
        <button class="btn btn-secondary" id="btn-why-routine" style="margin-top:10px;">¿Por que estos ejercicios?</button>
        `}
      </div>

      ${(() => {
        // Metodo de entrenamiento en el que se basa tu split (segun tus
        // dias/semana). No aplica a rutinas manuales: esas no siguen una
        // plantilla de dia, las armaste vos mismo ejercicio por ejercicio.
        const method = !isManualProfile && window.MDGYM_SPLIT_METHOD ? window.MDGYM_SPLIT_METHOD[profile.daysPerWeek] : null;
        if (!method) return "";
        return `
      <div class="section-title">Metodo de entrenamiento</div>
      <div class="card">
        <p class="note" style="margin-top:0; margin-bottom:6px; color:var(--text); font-weight:800;">${method.name}</p>
        <p class="note" style="margin-top:0;">${method.benefit}</p>
        <p class="note" style="margin-top:8px;">Es informacion general de entrenamiento de fuerza, no una promesa de resultado: la respuesta varia segun la persona, la alimentacion, el descanso y sobre todo la constancia.</p>
      </div>
        `;
      })()}

      <div class="section-title">Editar datos</div>
      <div class="card">
        <div class="field">
          <label>Nombre</label>
          <input type="text" id="s-name" value="${profile.name || ""}" placeholder="Ej: David" />
        </div>
        <div class="field-row">
          <div class="field"><label>Edad</label><input type="number" id="s-age" value="${profile.age}" /></div>
          <div class="field"><label>Sexo</label>
            <select id="s-sex">
              <option value="M" ${profile.sex === "M" ? "selected" : ""}>Masculino</option>
              <option value="F" ${profile.sex === "F" ? "selected" : ""}>Femenino</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field"><label>Peso (kg)</label><input type="number" id="s-weight" value="${profile.weightKg}" /></div>
          <div class="field"><label>Altura (cm)</label><input type="number" id="s-height" value="${profile.heightCm}" /></div>
        </div>
        <button class="btn btn-secondary" id="btn-save-profile">Guardar datos</button>
      </div>

      ${isManualProfile ? `
      <div class="section-title">Tu rutina es manual</div>
      <div class="card">
        <p class="note" style="margin-top:0;">Como armaste esta rutina vos mismo, el objetivo, el equipamiento y los dias por semana no se editan desde aca (regenerarian la rutina y perderias lo que armaste). Para sacar o cambiar ejercicios de un dia puntual, andá a Rutina y tocá "Editar ejercicios de este dia". Para rehacerla entera, usá "Volver al inicio" mas abajo.</p>
      </div>
      ` : `
      <div class="section-title">Objetivo(s)</div>
      <div class="card">
        <div class="chip-group" id="s-goal-chips">
          ${window.MDGYM_GOALS.map((g) => `<div class="chip ${profile.goals.includes(g.id) ? "selected" : ""}" data-sgoal="${g.id}">${g.label}</div>`).join("")}
        </div>
        <p class="note">Series/reps actuales: ${profile.goalScheme.sets}x${profile.goalScheme.reps}, descanso ~${profile.goalScheme.restSec}s.</p>
        <button class="btn btn-secondary" id="btn-save-goals" style="margin-top:10px;">Guardar objetivo(s)</button>
      </div>

      <div class="section-title">Equipamiento</div>
      <div class="card">
        <div class="chip-group" id="s-equip-chips">
          ${window.MDGYM_EQUIPMENT_CATALOG.map((eq) => `<div class="chip chip-icon ${profile.equipment.includes(eq.id) ? "selected" : ""}" data-sequip="${eq.id}">${window.mdgymIcon(eq.icon, 15)}<span>${eq.label}</span></div>`).join("")}
        </div>
        <button class="btn btn-secondary" id="btn-save-equip" style="margin-top:10px;">Guardar equipamiento y regenerar rutina</button>
      </div>

      <div class="section-title">Dias por semana</div>
      <div class="card">
        <div class="chip-group" id="s-days-chips">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<div class="chip ${profile.daysPerWeek === n ? "selected" : ""}" data-sdays="${n}">${n} dia${n > 1 ? "s" : ""}</div>`).join("")}
        </div>
        <button class="btn btn-secondary" id="btn-save-days" style="margin-top:10px;">Guardar dias y regenerar rutina</button>
      </div>

      <div class="section-title">Variedad</div>
      <div class="card">
        <p class="note" style="margin-top:0;">Si sentis que se repiten siempre los mismos ejercicios, rotá las variantes disponibles para tu equipo.</p>
        <button class="btn btn-secondary" id="btn-rotate">${window.mdgymIcon("shuffle", 16)} <span>Rotar variantes de ejercicios</span></button>
      </div>
      `}

      <div class="section-title">Empezar de nuevo</div>
      <div class="card">
        <p class="note" style="margin-top:0;">Volve al inicio de todo: podes reusar tus datos actuales para editarlos, o arrancar en blanco. Tu historial de entrenamientos no se borra con esto.</p>
        <button class="btn btn-secondary" id="btn-restart">Volver al inicio</button>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="topbar" style="padding-left:0; padding-right:0;">
      <button class="icon-btn" id="btn-back-settings">←</button>
      <h1>Configuracion</h1>
      <span style="width:38px;"></span>
    </div>

    <div class="section-title" style="margin-top:4px;">Tema</div>
    <div class="card">
      <div class="theme-grid">${themeSwatches}</div>
    </div>

    <div class="section-title">Logo</div>
    <div class="card">
      <p class="note" style="margin-top:0;">Se muestra siempre arriba, junto al nombre de la app.</p>
      <div class="logo-grid">${logoSwatches}</div>
    </div>

    ${profileSection}

    <div class="section-title">Datos</div>
    <div class="card">
      <p class="note" style="margin-top:0;">MDGym guarda todo (perfil, rutina, historial) solo en este navegador (localStorage). No hay cuenta ni nube: si cambias de dispositivo o borras el cache del sitio, se pierde.</p>
      <button class="btn btn-danger" id="btn-clear-all">Borrar todos mis datos</button>
    </div>

    <div class="section-title">Creditos</div>
    <div class="card">
      <p class="note" style="margin-top:0;">Los diagramas musculares y las fotos de ejecucion de varios ejercicios vienen de <a href="https://wger.de" target="_blank" rel="noopener">wger.de</a> (API publica), bajo licencia CC-BY-SA 3.0/4.0 o CC0 segun la imagen.</p>
      <button class="btn btn-secondary" id="btn-show-credits">Ver lista completa de atribuciones</button>
    </div>
  `;

  document.getElementById("btn-back-settings").addEventListener("click", () => showView("home"));

  document.getElementById("btn-show-credits").addEventListener("click", openCreditsModal);

  root.querySelectorAll("[data-theme-choice]").forEach((sw) =>
    sw.addEventListener("click", () => {
      const id = sw.dataset.themeChoice;
      document.documentElement.setAttribute("data-theme", id);
      const s = MDGymStore.getSettings();
      s.theme = id;
      MDGymStore.saveSettings(s);
      mdgymApplyChromeIcons();
      renderSettings();
    })
  );

  root.querySelectorAll("[data-logo-choice]").forEach((sw) =>
    sw.addEventListener("click", () => {
      const id = sw.dataset.logoChoice;
      const s = MDGymStore.getSettings();
      s.logo = id;
      MDGymStore.saveSettings(s);
      mdgymApplyChromeIcons();
      renderSettings();
    })
  );

  if (!profile) return;

  const restartBtn = document.getElementById("btn-restart");
  if (restartBtn) restartBtn.addEventListener("click", openRestartModal);

  const whyBtn = document.getElementById("btn-why-routine");
  if (whyBtn) whyBtn.addEventListener("click", () => openRoutineExplanationModal(profile));

  root.querySelectorAll("[data-sgoal]").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("selected"))
  );
  root.querySelectorAll("[data-sequip]").forEach((c) =>
    c.addEventListener("click", () => c.classList.toggle("selected"))
  );
  root.querySelectorAll("[data-sdays]").forEach((c) =>
    c.addEventListener("click", () => {
      root.querySelectorAll("[data-sdays]").forEach((x) => x.classList.remove("selected"));
      c.classList.add("selected");
    })
  );

  document.getElementById("btn-save-profile").addEventListener("click", () => {
    const p = MDGymStore.getProfile();
    const newName = document.getElementById("s-name").value.trim();
    if (newName) p.name = newName;
    p.age = Number(document.getElementById("s-age").value) || p.age;
    p.sex = document.getElementById("s-sex").value;
    p.weightKg = Number(document.getElementById("s-weight").value) || p.weightKg;
    p.heightCm = Number(document.getElementById("s-height").value) || p.heightCm;
    MDGymStore.saveProfile(p);
    alert("Datos actualizados.");
    renderSettings();
  });

  const saveGoalsBtn = document.getElementById("btn-save-goals");
  if (saveGoalsBtn) {
    saveGoalsBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      const selected = Array.from(root.querySelectorAll("[data-sgoal].selected")).map((c) => c.dataset.sgoal);
      if (!selected.length) { alert("Elegi al menos un objetivo."); return; }
      p.goals = selected;
      p.goalScheme = window.mdgymCombineGoals(selected);
      MDGymStore.saveProfile(p);
      alert("Objetivo actualizado.");
      renderSettings();
    });
  }

  const saveEquipBtn = document.getElementById("btn-save-equip");
  if (saveEquipBtn) {
    saveEquipBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      const selected = Array.from(root.querySelectorAll("[data-sequip].selected")).map((c) => c.dataset.sequip);
      if (!selected.length) { alert("Marca al menos un equipo."); return; }
      p.equipment = selected;
      p.routine = window.mdgymBuildRoutine(p.daysPerWeek, p.equipment, p.weekIndex);
      p.nextDayIndex = p.nextDayIndex % p.routine.length;
      MDGymStore.saveProfile(p);
      alert("Equipamiento actualizado y rutina regenerada.");
      renderSettings();
    });
  }

  const saveDaysBtn = document.getElementById("btn-save-days");
  if (saveDaysBtn) {
    saveDaysBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      const chosen = root.querySelector("[data-sdays].selected");
      if (!chosen) { alert("Elegi cuantos dias por semana."); return; }
      p.daysPerWeek = Number(chosen.dataset.sdays);
      p.routine = window.mdgymBuildRoutine(p.daysPerWeek, p.equipment, p.weekIndex);
      p.nextDayIndex = 0;
      MDGymStore.saveProfile(p);
      alert("Dias actualizados y rutina regenerada.");
      renderSettings();
    });
  }

  const rotateBtn = document.getElementById("btn-rotate");
  if (rotateBtn) {
    rotateBtn.addEventListener("click", () => {
      const p = MDGymStore.getProfile();
      p.weekIndex = (p.weekIndex || 0) + 1;
      p.routine = window.mdgymBuildRoutine(p.daysPerWeek, p.equipment, p.weekIndex);
      p.nextDayIndex = p.nextDayIndex % p.routine.length;
      p.lastRotationDate = todayISO();
      p.rotationDismissedUntil = null;
      MDGymStore.saveProfile(p);
      alert("Variantes rotadas.");
      renderSettings();
    });
  }

  document.getElementById("btn-clear-all").addEventListener("click", () => {
    if (confirm("¿Seguro que queres borrar todos tus datos de MDGym? Esta accion no se puede deshacer.")) {
      MDGymStore.clearAll();
      location.reload();
    }
  });
}
