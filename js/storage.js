// ============================================================
// MDGym - capa de persistencia (100% localStorage, sin backend).
// Todo vive en el navegador del usuario. Si borra el cache del
// sitio o cambia de dispositivo, pierde estos datos: no hay
// sincronizacion en la nube en esta version.
// ============================================================

const MDGYM_KEYS = {
  profile: "mdgym_profile",
  sessions: "mdgym_sessions", // historial de entrenamientos registrados
  bodyLog: "mdgym_body_log", // historial de peso corporal
  settings: "mdgym_settings",
};

function mdgymRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("MDGym: error leyendo", key, e);
    return fallback;
  }
}

function mdgymWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("MDGym: error guardando", key, e);
  }
}

const MDGymStore = {
  getProfile() {
    return mdgymRead(MDGYM_KEYS.profile, null);
  },
  saveProfile(profile) {
    mdgymWrite(MDGYM_KEYS.profile, profile);
  },
  clearAll() {
    try {
      Object.values(MDGYM_KEYS).forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("MDGym: error borrando datos", e);
    }
  },

  getSettings() {
    return mdgymRead(MDGYM_KEYS.settings, { theme: "oscuro", units: "kg", logo: "barra" });
  },
  saveSettings(s) {
    mdgymWrite(MDGYM_KEYS.settings, s);
  },

  getSessions() {
    return mdgymRead(MDGYM_KEYS.sessions, []);
  },
  saveSessions(sessions) {
    mdgymWrite(MDGYM_KEYS.sessions, sessions);
  },
  // Agrega o reemplaza la sesion del dia (por fecha + indice de dia de rutina)
  upsertSession(session) {
    const all = this.getSessions();
    const idx = all.findIndex((s) => s.date === session.date);
    if (idx >= 0) all[idx] = session;
    else all.push(session);
    this.saveSessions(all);
  },
  getSessionByDate(date) {
    return this.getSessions().find((s) => s.date === date) || null;
  },

  // Devuelve el ultimo peso registrado (kg) para un ejercicio, antes de
  // la fecha dada (o en general si no se pasa fecha). null si no hay.
  getLastWeightForExercise(exerciseId, beforeDate) {
    const sessions = this.getSessions()
      .filter((s) => !beforeDate || s.date < beforeDate)
      .sort((a, b) => (a.date < b.date ? 1 : -1)); // mas reciente primero
    for (const s of sessions) {
      const ex = (s.exercises || []).find((e) => e.exerciseId === exerciseId);
      if (ex && ex.sets && ex.sets.length) {
        const withWeight = ex.sets.filter((st) => st.weightKg != null && st.weightKg !== "");
        if (withWeight.length) {
          const max = Math.max(...withWeight.map((st) => Number(st.weightKg)));
          return { weightKg: max, date: s.date };
        }
      }
    }
    return null;
  },

  // Sesion mas reciente (antes de beforeDate, si se pasa) que tenga
  // registrado este ejercicio, con su lista de series completa. Sirve
  // para prellenar y para la sugerencia de progresion de peso.
  getLastSessionForExercise(exerciseId, beforeDate) {
    const sessions = this.getSessions()
      .filter((s) => !beforeDate || s.date < beforeDate)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const s of sessions) {
      const ex = (s.exercises || []).find((e) => e.exerciseId === exerciseId);
      if (ex && ex.sets && ex.sets.length) {
        return { date: s.date, sets: ex.sets };
      }
    }
    return null;
  },

  getBodyLog() {
    return mdgymRead(MDGYM_KEYS.bodyLog, []);
  },
  addBodyLog(entry) {
    const log = this.getBodyLog();
    const idx = log.findIndex((e) => e.date === entry.date);
    if (idx >= 0) log[idx] = entry;
    else log.push(entry);
    log.sort((a, b) => (a.date > b.date ? 1 : -1));
    mdgymWrite(MDGYM_KEYS.bodyLog, log);
  },
};

window.MDGymStore = MDGymStore;
