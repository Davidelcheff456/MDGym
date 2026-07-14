// ============================================================
// MDGym - calculos (IMC, masa magra estimada) y generador de rutina.
// ============================================================

const MDGymCalc = {
  bmi(weightKg, heightCm) {
    if (!weightKg || !heightCm) return null;
    const h = heightCm / 100;
    return weightKg / (h * h);
  },

  // Estimacion de masa magra (lean body mass) - formula de Boer (1984).
  // Es una APROXIMACION clinica basada solo en peso/altura/sexo (margen de
  // error tipico +-3 a 4 kg contra DEXA); no reemplaza una medicion real
  // por bioimpedancia, pliegues cutaneos o DEXA.
  leanBodyMassBoer(weightKg, heightCm, sex) {
    if (!weightKg || !heightCm) return null;
    if (sex === "M") {
      return 0.407 * weightKg + 0.267 * heightCm - 19.2;
    }
    // "F" u otro: se usa la formula femenina de Boer por defecto
    return 0.252 * weightKg + 0.473 * heightCm - 48.3;
  },

  // Masa grasa estimada = peso - masa magra estimada (misma limitacion que arriba)
  estimateBodyComposition(weightKg, heightCm, sex) {
    const lbm = this.leanBodyMassBoer(weightKg, heightCm, sex);
    if (lbm == null) return null;
    const fatMass = Math.max(weightKg - lbm, 0);
    const fatPct = (fatMass / weightKg) * 100;
    return {
      leanMassKg: Math.round(lbm * 10) / 10,
      fatMassKg: Math.round(fatMass * 10) / 10,
      fatPct: Math.round(fatPct * 10) / 10,
    };
  },
};

// ------------------------------------------------------------
// Generador de rutina: dada la plantilla del dia, el equipo
// disponible y un indice de "semana" (para rotar variantes),
// devuelve la lista final de ejercicios con series/reps ya
// calculadas segun el/los objetivo(s).
// ------------------------------------------------------------
// ranking estable, reutilizado por el generador de rutina y por la
// sugerencia de ejercicio similar: compuestos primero, luego nivel
// principiante, luego nombre.
function mdgymRankExercises(pool) {
  return pool.slice().sort((a, b) => {
    const ca = a.mechanic === "compound" ? 0 : 1;
    const cb = b.mechanic === "compound" ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const la = a.level === "beginner" ? 0 : 1;
    const lb = b.level === "beginner" ? 0 : 1;
    if (la !== lb) return la - lb;
    return a.name_es.localeCompare(b.name_es);
  });
}

function mdgymPickExercisesForSlot(muscle, equipmentList, excludeIds, rotationSeed) {
  const pool = window.MDGYM_EXERCISES.filter(
    (e) => e.muscle_group === muscle && equipmentList.includes(e.equipment)
  );
  if (!pool.length) return null;
  const ranked = mdgymRankExercises(pool);
  const notUsed = ranked.filter((e) => !excludeIds.has(e.id));
  const candidates = notUsed.length ? notUsed : ranked;
  const idx = rotationSeed % candidates.length;
  return candidates[idx];
}

// Sugiere un ejercicio alternativo para reemplazar a uno dado: primero
// intenta el mismo musculo principal especifico (primary_muscle) con
// equipamiento compatible; si no encuentra nada, relaja la busqueda al
// grupo muscular general (muscle_group). Excluye el ejercicio original y
// cualquier otro id pasado en excludeIds (por ejemplo, los que ya estan
// ese dia). Regla fija basada en los mismos datos del catalogo, no IA.
function mdgymSuggestSimilar(exerciseId, equipmentList, excludeIds) {
  const original = window.MDGYM_EXERCISES.find((e) => e.id === exerciseId);
  if (!original) return null;
  const exclude = excludeIds instanceof Set ? new Set(excludeIds) : new Set(excludeIds || []);
  exclude.add(exerciseId);

  const byPrimary = window.MDGYM_EXERCISES.filter(
    (e) => e.primary_muscle === original.primary_muscle && equipmentList.includes(e.equipment) && !exclude.has(e.id)
  );
  const pool = byPrimary.length
    ? byPrimary
    : window.MDGYM_EXERCISES.filter(
        (e) => e.muscle_group === original.muscle_group && equipmentList.includes(e.equipment) && !exclude.has(e.id)
      );
  if (!pool.length) return null;
  return mdgymRankExercises(pool)[0];
}

// dayTypeKey: "full" | "upper" | "lower" | "push" | "pull" | "legs"
// weekIndex: numero entero que aumenta cada semana (para rotar variantes)
function mdgymBuildDay(dayTypeKey, equipmentList, weekIndex) {
  const template = window.MDGYM_DAY_TEMPLATES[dayTypeKey];
  if (!template) return { label: dayTypeKey, exercises: [], missing: [] };
  const used = new Set();
  const exercises = [];
  const missing = [];
  template.slots.forEach((slot, slotIdx) => {
    for (let i = 0; i < slot.count; i++) {
      const seed = weekIndex * 7 + slotIdx * 3 + i;
      const picked = mdgymPickExercisesForSlot(slot.muscle, equipmentList, used, seed);
      if (picked) {
        used.add(picked.id);
        exercises.push(picked);
      } else {
        missing.push(slot.muscle);
      }
    }
  });
  return { label: template.label, exercises, missing };
}

// Arma la rutina completa (secuencia de dias) segun dias/semana elegidos.
function mdgymBuildRoutine(daysPerWeek, equipmentList, weekIndex) {
  const sequence = window.MDGYM_SPLIT_BY_DAYS[daysPerWeek] || window.MDGYM_SPLIT_BY_DAYS[3];
  return sequence.map((dayType, i) => ({
    dayType,
    ...mdgymBuildDay(dayType, equipmentList, weekIndex + i),
  }));
}

window.MDGymCalc = MDGymCalc;
window.mdgymBuildRoutine = mdgymBuildRoutine;
window.mdgymBuildDay = mdgymBuildDay;
window.mdgymSuggestSimilar = mdgymSuggestSimilar;
