// ============================================================
// MDGym - datos de rutinas: catalogo de equipamiento, objetivos,
// plantillas de dia y calendarios por dias/semana.
// Es un conjunto FINITO de plantillas (no rutinas infinitas):
// se arma combinando plantilla de dia + equipo disponible + objetivo.
// ============================================================

// Catalogo de equipamiento. El "id" debe matchear con el campo
// "equipment" de data-exercises.js. Las maquinas y poleas estan
// desglosadas una por una (no como categoria generica) para que
// selecciones exactamente lo que tenes en tu gym.
window.MDGYM_EQUIPMENT_CATALOG = [
  { id: "body only", label: "Peso corporal / en casa", group: "Basico", icon: "body" },

  { id: "dumbbell", label: "Mancuernas", group: "Pesas libres", icon: "dumbbell" },
  { id: "barbell", label: "Barra y discos", group: "Pesas libres", icon: "barbell" },
  { id: "e-z curl bar", label: "Barra Z", group: "Pesas libres", icon: "barbell" },
  { id: "kettlebells", label: "Kettlebell (pesa rusa)", group: "Pesas libres", icon: "kettlebell" },

  { id: "machine_chest_press", label: "Prensa de pecho (maquina)", group: "Maquinas", icon: "machine" },
  { id: "machine_chest_press_incline", label: "Prensa de pecho inclinado (maquina)", group: "Maquinas", icon: "machine" },
  { id: "machine_smith", label: "Maquina Smith", group: "Maquinas", icon: "machine" },
  { id: "machine_shoulder_press", label: "Prensa de hombros (maquina)", group: "Maquinas", icon: "machine" },
  { id: "machine_bicep_curl", label: "Maquina de curl de biceps", group: "Maquinas", icon: "machine" },
  { id: "machine_dip", label: "Maquina de fondos (dips)", group: "Maquinas", icon: "machine" },
  { id: "machine_leg_press", label: "Prensa de piernas", group: "Maquinas", icon: "machine" },
  { id: "machine_leg_extension", label: "Maquina de extension de cuadriceps", group: "Maquinas", icon: "machine" },
  { id: "machine_leg_curl", label: "Maquina de curl femoral", group: "Maquinas", icon: "machine" },
  { id: "machine_calf_raise", label: "Maquina de pantorrillas (sentado)", group: "Maquinas", icon: "machine" },
  { id: "machine_calf_raise_standing", label: "Maquina de pantorrillas (de pie)", group: "Maquinas", icon: "machine" },
  { id: "machine_ab_crunch", label: "Maquina de abdominales", group: "Maquinas", icon: "machine" },

  { id: "cable_crossover", label: "Polea - cruce (crossover)", group: "Poleas", icon: "cable" },
  { id: "cable_lat_pulldown", label: "Polea alta - jalon al pecho", group: "Poleas", icon: "cable" },
  { id: "cable_seated_row", label: "Polea baja - remo sentado", group: "Poleas", icon: "cable" },
  { id: "cable_face_pull", label: "Polea alta con cuerda - face pull", group: "Poleas", icon: "cable" },
  { id: "cable_rear_delt", label: "Polea - aperturas posteriores", group: "Poleas", icon: "cable" },
  { id: "cable_bicep_curl", label: "Polea baja - curl de biceps", group: "Poleas", icon: "cable" },
  { id: "cable_triceps_pushdown", label: "Polea alta - extension de triceps", group: "Poleas", icon: "cable" },
  { id: "cable_russian_twist", label: "Polea baja - giro de torso", group: "Poleas", icon: "cable" },
  { id: "cable_wrist_curl", label: "Polea baja - curl de muneca", group: "Poleas", icon: "cable" },
  { id: "cable_woodchop", label: "Polea alta - lenador", group: "Poleas", icon: "cable" },

  { id: "bands", label: "Banda elastica", group: "Accesorios", icon: "band" },
  { id: "exercise ball", label: "Pelota de estabilidad", group: "Accesorios", icon: "ball" },
  { id: "other", label: "Objetos varios / caseros", group: "Accesorios", icon: "bag" },
];

// ------------------------------------------------------------
// Atajos de equipamiento: en vez de tildar maquina por maquina, se puede
// arrancar de un preset y despues seguir ajustando a mano (los presets
// solo pre-tildan la checklist, no reemplazan la seleccion manual).
// ------------------------------------------------------------
window.MDGYM_EQUIPMENT_PRESETS = {
  gym: [
    {
      id: "gym_full",
      label: "Gimnasio completo",
      note: "Tilda todo el catalogo: maquinas, poleas, pesas libres y accesorios.",
      // se calcula en runtime con mdgymEquipmentForLocation("gym") (todo el catalogo)
    },
    {
      id: "gym_basic",
      label: "Gimnasio basico",
      note: "Un gym chico tipico: pesas libres + un par de maquinas y poleas comunes.",
      equipment: [
        "body only", "dumbbell", "barbell", "kettlebells",
        "machine_leg_press", "machine_chest_press", "machine_shoulder_press",
        "cable_lat_pulldown", "cable_seated_row", "cable_triceps_pushdown",
        "bands",
      ],
    },
  ],
  home: [
    {
      id: "home_some",
      label: "Algunos aparatos",
      note: "Peso corporal + mancuernas, bandas y una pelota de estabilidad.",
      equipment: ["body only", "dumbbell", "bands", "exercise ball", "other"],
    },
    {
      id: "home_none",
      label: "Ninguno (solo cuerpo)",
      note: "Solo ejercicios de peso corporal, sin ningun equipo.",
      equipment: ["body only"],
    },
  ],
};

// Objetivos combinables. sets/reps/rest son de referencia general
// (rangos habituales de entrenamiento de fuerza), no una prescripcion
// medica individual.
window.MDGYM_GOALS = [
  { id: "fuerza", label: "Fuerza maxima", sets: 4, reps: 5, restSec: 150 },
  { id: "hipertrofia", label: "Ganar masa muscular", sets: 4, reps: 10, restSec: 90 },
  { id: "definicion", label: "Perder grasa / definicion", sets: 3, reps: 12, restSec: 45 },
  { id: "resistencia", label: "Resistencia / acondicionamiento", sets: 3, reps: 16, restSec: 30 },
];

// Combina varios objetivos: promedia series y repeticiones (redondeado),
// y toma el descanso mas largo entre los elegidos (mas conservador / seguro).
function mdgymCombineGoals(goalIds) {
  const goals = (goalIds && goalIds.length ? goalIds : ["hipertrofia"])
    .map((id) => window.MDGYM_GOALS.find((g) => g.id === id))
    .filter(Boolean);
  if (!goals.length) return { sets: 3, reps: 10, restSec: 75 };
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return {
    sets: avg(goals.map((g) => g.sets)),
    reps: avg(goals.map((g) => g.reps)),
    restSec: Math.max(...goals.map((g) => g.restSec)),
  };
}
window.mdgymCombineGoals = mdgymCombineGoals;

// Plantillas de dia: cada una define slots (musculo + cantidad de
// ejercicios). El generador reemplaza cada slot por un ejercicio real
// segun el equipo disponible.
window.MDGYM_DAY_TEMPLATES = {
  full: {
    label: "Cuerpo completo",
    slots: [
      { muscle: "piernas", count: 2 },
      { muscle: "pecho", count: 1 },
      { muscle: "espalda", count: 1 },
      { muscle: "hombros", count: 1 },
      { muscle: "biceps", count: 1 },
      { muscle: "triceps", count: 1 },
      { muscle: "abdominales", count: 1 },
    ],
  },
  upper: {
    label: "Tren superior",
    slots: [
      { muscle: "pecho", count: 2 },
      { muscle: "espalda", count: 2 },
      { muscle: "hombros", count: 2 },
      { muscle: "biceps", count: 1 },
      { muscle: "triceps", count: 1 },
    ],
  },
  lower: {
    label: "Tren inferior",
    slots: [
      { muscle: "piernas", count: 4 },
      { muscle: "abdominales", count: 2 },
    ],
  },
  push: {
    label: "Empuje (Push)",
    slots: [
      { muscle: "pecho", count: 2 },
      { muscle: "hombros", count: 2 },
      { muscle: "triceps", count: 2 },
    ],
  },
  pull: {
    label: "Tiron (Pull)",
    slots: [
      { muscle: "espalda", count: 3 },
      { muscle: "biceps", count: 2 },
      { muscle: "antebrazos", count: 1 },
    ],
  },
  legs: {
    label: "Piernas",
    slots: [
      { muscle: "piernas", count: 4 },
      { muscle: "abdominales", count: 2 },
    ],
  },
};

// Calendario finito segun dias de entrenamiento por semana (1 a 6).
// Cada entrada es una secuencia de tipos de dia (keys de MDGYM_DAY_TEMPLATES).
window.MDGYM_SPLIT_BY_DAYS = {
  1: ["full"],
  2: ["full", "full"],
  3: ["full", "full", "full"],
  4: ["upper", "lower", "upper", "lower"],
  5: ["push", "pull", "legs", "upper", "lower"],
  6: ["push", "pull", "legs", "push", "pull", "legs"],
};

// ============================================================
// Tips del entrenador: por que se entrena asi ese tipo de dia.
// Conocimiento general de entrenamiento (splits push/pull/legs,
// upper/lower, full body), sin pretender ser asesoramiento medico.
// ============================================================
window.MDGYM_DAY_TIPS = {
  full: [
    "Entrenar cuerpo completo estimula todos los grupos musculares en la misma sesion, algo util cuando entrenas pocos dias por semana: cada musculo recibe estimulo mas seguido a lo largo de la semana aunque el volumen por sesion sea menor.",
    "Repetis full body otra vez esta semana: la idea no es cambiar todo cada dia, sino sumar frecuencia. Cada musculo se estimula varias veces por semana en vez de una sola vez con mucho volumen.",
    "Tercer full body de la semana: si rendis un poco menos que en el primero es esperable, hay fatiga acumulada. Ajusta el peso si hace falta, no tiene que ser un record cada dia para que sirva.",
  ],
  upper: [
    "Los dias de tren superior agrupan pecho, espalda, hombros y brazos para separar el estimulo del tren inferior, permitiendo entrenar con mas frecuencia sin que la fatiga de piernas interfiera.",
    "Segundo dia de tren superior de la semana: pecho, espalda, hombros y brazos vienen con algo de fatiga del primero, por eso tener un dia de piernas en el medio les dio tiempo de recuperarse.",
  ],
  lower: [
    "El dia de tren inferior concentra piernas y gluteos, los grupos musculares mas grandes del cuerpo: separarlos les da el descanso que necesitan entre sesiones sin frenar el progreso del resto del cuerpo.",
    "Segundo dia de tren inferior: piernas y gluteos tuvieron un dia de tren superior de por medio para recuperarse, asi que pueden recibir estimulo de nuevo sin arrastrar tanta fatiga.",
  ],
  push: [
    "Pecho, hombro y triceps trabajan juntos en casi todos los movimientos de empuje (press de banca, press militar), por eso se entrenan el mismo dia: la fatiga de un musculo sinergista no compromete un dia distinto.",
    "Segundo dia de empuje de la semana: pecho, hombro y triceps ya trabajaron juntos antes, pero como hubo un dia de traccion y uno de pierna en el medio, llegan recuperados.",
  ],
  pull: [
    "Espalda y biceps son sinergistas en los movimientos de traccion (remo, dominadas): agruparlos evita que el biceps llegue fatigado a un dia de espalda, o al reves.",
    "Segundo dia de traccion: espalda y biceps tuvieron tiempo de recuperarse desde el ultimo dia de tiron gracias al empuje y pierna intercalados.",
  ],
  legs: [
    "Piernas es el dia mas demandante: cuadriceps, isquiotibiales, gluteos y pantorrillas concentran gran parte de la masa muscular del cuerpo, por eso conviene darles un dia dedicado con buen descanso despues.",
    "Segundo dia de piernas de la semana: al ser el grupo mas grande y demandante, llegar con buen descanso desde el ultimo dia de piernas ayuda a mantener la intensidad.",
  ],
};

// Tips generales que se muestran al terminar el ultimo dia del ciclo
// semanal. Rotan (no siempre el mismo) para no repetirse cada semana.
window.MDGYM_WEEKLY_TIPS = [
  "La progresion importa mas que la perfeccion: si esta semana sumaste un poco de peso o una repeticion mas en algun ejercicio respecto a la vez anterior, ya estas progresando.",
  "El descanso entre sesiones es donde el musculo realmente se recupera y crece. Dormir bien y darle a cada grupo muscular unos dias antes de repetirlo es tan importante como el entrenamiento en si.",
  "La constancia le gana a la intensidad puntual: sostener el entrenamiento varias semanas seguidas suele rendir mas que semanas muy intensas seguidas de parates largos.",
  "Si notas que el peso registrado se estanca en varios ejercicios, puede ser buen momento para revisar comida, descanso, o probar variantes en Configuracion.",
  "Registrar el peso cada vez, aunque parezca poco relevante, es lo que te va a permitir ver el progreso real semana a semana en el Historial.",
];

// ============================================================
// Contenido para explicar la rutina antes de mostrarla:
// por que ese split, en que se baso la seleccion, beneficios
// esperados por objetivo y tiempos aproximados de resultados.
// Conocimiento general de entrenamiento, no asesoramiento medico.
// ============================================================
window.MDGYM_SPLIT_RATIONALE = {
  1: "Entrenas 1 dia por semana, asi que armamos una unica sesion de cuerpo completo (full body): la forma mas eficiente de estimular todos los musculos principales con el minimo tiempo disponible.",
  2: "Con 2 dias por semana repetimos cuerpo completo (full body) en ambas sesiones, para que cada musculo reciba estimulo dos veces por semana.",
  3: "Con 3 dias armamos tres sesiones de cuerpo completo (full body): buena frecuencia semanal por musculo sin necesidad de dividir el cuerpo en partes.",
  4: "Con 4 dias separamos tren superior y tren inferior (2 veces cada uno): mas volumen por grupo muscular que el full body, manteniendo buena frecuencia semanal.",
  5: "Con 5 dias combinamos empuje, traccion y piernas (push / pull / legs) mas un dia extra de tren superior e inferior, para darle mas volumen especifico a cada grupo muscular.",
  6: "Con 6 dias repetimos el ciclo de empuje, traccion y piernas (push / pull / legs) dos veces por semana: mas volumen total y frecuencia, pensado para quien ya viene entrenando con regularidad.",
};

// ============================================================
// Metodologia de entrenamiento en la que se basa cada split (segun
// dias/semana): nombre del sistema + un resumen de por que se usa
// tanto. Son descripciones generales del enfoque (asi se suele
// explicar en literatura de entrenamiento de fuerza), no una cita
// de un estudio puntual ni una promesa de resultado individual.
// ============================================================
window.MDGYM_SPLIT_METHOD = {
  1: {
    name: "Rutina de cuerpo completo (Full Body)",
    benefit: "Es de los enfoques mas usados cuando se entrena pocos dias por semana: trabajar todo el cuerpo en cada sesion le da a cada musculo mas frecuencia de estimulo semanal. Es una de las formas de entrenamiento con mas respaldo practico para principiantes.",
  },
  2: {
    name: "Rutina de cuerpo completo (Full Body)",
    benefit: "Es de los enfoques mas usados cuando se entrena pocos dias por semana: trabajar todo el cuerpo en cada sesion le da a cada musculo mas frecuencia de estimulo semanal. Es una de las formas de entrenamiento con mas respaldo practico para principiantes.",
  },
  3: {
    name: "Rutina de cuerpo completo (Full Body)",
    benefit: "Es de los enfoques mas usados cuando se entrena pocos dias por semana: trabajar todo el cuerpo en cada sesion le da a cada musculo mas frecuencia de estimulo semanal. Es una de las formas de entrenamiento con mas respaldo practico para principiantes.",
  },
  4: {
    name: "Division tren superior / tren inferior (Upper/Lower)",
    benefit: "Es una de las divisiones clasicas del entrenamiento de fuerza: separa el cuerpo en dos bloques y permite mas volumen por grupo muscular que el full body, sin perder la frecuencia de 2 veces por semana por musculo (un punto que suele asociarse a buen progreso).",
  },
  5: {
    name: "Empuje/Traccion/Piernas + Upper/Lower (hibrido)",
    benefit: "Push/Pull/Legs es de las divisiones mas usadas en entrenamiento de fuerza y musculacion: agrupa en el mismo dia los musculos que trabajan juntos en el movimiento (empuje, traccion, piernas), lo que ayuda a organizar mejor el volumen y la fatiga en la semana.",
  },
  6: {
    name: "Empuje/Traccion/Piernas (Push/Pull/Legs), doble ciclo semanal",
    benefit: "Repetir el ciclo Push/Pull/Legs dos veces por semana suma mas volumen y frecuencia por grupo muscular. Es un esquema tipico de quienes ya vienen entrenando con regularidad y pueden sostener mas dias de entrenamiento.",
  },
};

window.MDGYM_GOAL_INFO = {
  fuerza: {
    beneficio: "Mas fuerza maxima y mejor tecnica en los movimientos basicos (sentadilla, press, peso muerto y similares); con el tiempo tambien aporta a la salud osea y articular.",
    tiempo: "Los primeros aumentos de fuerza (mas por adaptacion del sistema nervioso que por musculo nuevo todavia) suelen notarse a partir de las 2 a 4 semanas de entrenamiento constante. Cambios mas marcados suelen tardar 8 a 12 semanas o mas.",
  },
  hipertrofia: {
    beneficio: "Mas masa muscular y volumen corporal, trabajando cada musculo con series moderadas-altas y descansos medios para maximizar el estimulo.",
    tiempo: "El musculo tarda en notarse a simple vista: los primeros cambios visibles suelen aparecer recien despues de 6 a 8 semanas de entrenamiento y alimentacion consistentes, y se hacen mas claros entre las 12 y 16 semanas.",
  },
  definicion: {
    beneficio: "Mantener (o incluso ganar algo de) musculo mientras se prioriza el gasto calorico, con series mas cortas y descansos breves que suman intensidad al entrenamiento.",
    tiempo: "La definicion depende mas de la alimentacion (deficit calorico sostenido) que del entrenamiento en si mismo. Con constancia en ambas cosas, los cambios visibles suelen empezar a notarse entre las 4 y 8 semanas.",
  },
  resistencia: {
    beneficio: "Mas resistencia muscular (aguantar mas repeticiones sin fatigarte) y mejor acondicionamiento general, con series largas y descansos cortos.",
    tiempo: "La resistencia muscular suele mejorar relativamente rapido: cambios notables desde las 3 a 4 semanas de entrenamiento regular.",
  },
};

// ---------- Mensajes motivadores (uso el nombre del usuario, {name}) ----------
window.MDGYM_MOTIVATION_DAY = [
  "Dale {name}, ya casi lo tenes, falta uno solo.",
  "{name}, un ejercicio mas y cerraste el dia.",
  "Vamos {name}, se viene el ultimo.",
  "{name}, esto ya esta cerca de terminar.",
  "Un empujon mas, {name}, vos podes.",
  "{name}, no aflojes ahora que falta poco.",
  "Ultimo esfuerzo, {name}, despues descansas.",
  "{name}, ya hiciste la parte dificil, termina fuerte.",
];

window.MDGYM_MOTIVATION_WEEK = [
  "{name}, con el entreno de hoy cerras tu semana.",
  "Dale {name}, hoy cumplis tu meta semanal.",
  "{name}, este es el ultimo dia que te falta esta semana.",
  "Vamos {name}, hoy completas los dias que te propusiste.",
  "{name}, un entreno mas y ya cumpliste la semana.",
  "Hoy es el dia, {name}: cerras tu semana con este entreno.",
];
