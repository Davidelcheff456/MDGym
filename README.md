# MDGym

App web (estatica, sin backend) que arma tu rutina de gimnasio segun tu objetivo,
tus datos fisicos y el equipamiento que tenes disponible (gym o casa), y te deja
registrar el peso usado en cada ejercicio dia a dia.

## Como funciona

- Todo corre en el navegador. No hay servidor ni base de datos: el perfil, la
  rutina y el historial se guardan con `localStorage` en el dispositivo/navegador
  donde lo uses. Si cambias de celular/PC o borras el cache del sitio, se pierde
  ese historial (no hay sincronizacion en la nube en esta version).
- La base de ~93 ejercicios (nombre, musculo, equipo especifico, instrucciones)
  viene originalmente del dataset publico [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  (licencia Unlicense / dominio publico); los nombres en espanol, el equipo
  detallado (maquina por maquina) y las instrucciones fueron redactados a mano.
- Los ejercicios de musculo especifico muestran un diagrama anatomico real
  (silueta con el musculo trabajado resaltado, de la API publica de
  [wger.de](https://wger.de), licencia CC-BY-SA 3.0/4.0 o CC0 segun la imagen).
  Los de movilidad y cardio no tienen un musculo puntual, asi que en su lugar
  usan directamente su propia foto real de ejecucion como imagen principal.
  En total, 92 de los ~93 ejercicios tienen hasta 3 fotos reales de ejecucion
  (de wger.de o de free-exercise-db, segun el ejercicio) — ver el detalle
  completo de autores y licencias abajo, y dentro de la app en Configuracion →
  Creditos.
- El equipamiento se elige maquina por maquina (prensa de piernas, polea alta,
  maquina Smith, etc.), no como categoria generica, para que la rutina se ajuste
  a lo que realmente tenes en tu gym.
- La estimacion de masa magra/grasa usa la formula de Boer (1984), que es una
  aproximacion clinica (margen de error tipico +-3/4 kg contra DEXA), no una
  medicion real. Se lo aclara dentro de la app.

## Probarlo en tu computadora antes de publicar

**Importante:** abrir `index.html` con doble clic (protocolo `file://`) puede
fallar en algunos navegadores — algunos bloquean `localStorage` o scripts
locales por seguridad en ese modo, y la app puede quedar sin responder. Lo
mas confiable es levantar un servidor liviano desde esta carpeta:

- **Windows, la forma mas facil:** doble clic en `iniciar.bat` (esta en esta
  misma carpeta). Abre un servidor local y te lleva directo al navegador.
- **Manual, con Python** (viene instalado en Mac/Linux, y en Windows si
  instalaste Python):
  ```bash
  python3 -m http.server 8000
  ```
- **Manual, con Node:**
  ```bash
  npx serve .
  ```

Despues abris `http://localhost:8000` en el navegador.

Si aun asi algo no funciona, apreta F12 para abrir las herramientas de
desarrollador y mira la pestaña "Console": si hay un error ahi, la propia
app tambien muestra un aviso rojo arriba de la pantalla explicando que algo
fallo (en vez de quedarse sin hacer nada en silencio).

## Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `mdgym`).
2. Subi el contenido de esta carpeta a la raiz del repo:

   ```bash
   cd MDGym
   git init
   git add .
   git commit -m "MDGym inicial"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mdgym.git
   git push -u origin main
   ```

3. En GitHub: entra al repo -> **Settings** -> **Pages**.
4. En "Build and deployment" -> **Source**, elegi **Deploy from a branch**.
5. En **Branch**, elegi `main` y la carpeta `/ (root)`. Guardar.
6. Esperá 1-2 minutos. GitHub te va a dar la URL (algo como
   `https://TU_USUARIO.github.io/mdgym/`).

No necesitas ningun build step (no hay React, Vite, ni nada para compilar):
es HTML/CSS/JS plano, GitHub Pages lo sirve tal cual.

## Estructura del proyecto

```
MDGym/
  index.html               -> estructura de la app (onboarding, inicio, rutina, historial, config)
  css/styles.css            -> estilos + los 4 temas (oscuro, claro, sepia, mar)
  js/data-exercises.js      -> base de ejercicios curada (nombre, musculo, equipo especifico, fotos)
  js/data-routines.js       -> catalogo de equipamiento, objetivos y plantillas de dia/split
  js/data-attributions.js   -> atribucion de autor/licencia de cada foto tomada de wger.de
  js/ui-icons.js            -> iconos de interfaz en SVG (sin emojis)
  js/storage.js             -> capa de persistencia en localStorage
  js/calc.js                -> calculos (IMC, masa magra estimada) + generador de rutina
  js/app.js                 -> logica de la app y render de cada pantalla
  assets/muscles/           -> 8 diagramas musculares (silueta + musculo resaltado), wger.de
  assets/howto/             -> fotos reales de ejecucion para 30 ejercicios, wger.de
```

## Atribuciones e imagenes

Las imagenes de `assets/muscles/` y `assets/howto/` no son propias: se
obtuvieron de la API publica de [wger.de](https://wger.de/api/v2/) y estan
licenciadas por sus autores bajo Creative Commons (mayormente CC-BY-SA 3.0 o
4.0, algunas CC0). El detalle completo — que foto corresponde a que ejercicio,
autor y licencia — esta en `js/data-attributions.js` y tambien visible dentro
de la app en **Configuracion → Creditos → Ver lista completa de atribuciones**.

Si haces cambios y publicas tu propia version, para cumplir la licencia
CC-BY-SA tenes que mantener esa atribucion visible (no hace falta que la
muevas de lugar, ya viene incluida).

## Cosas para mejorar mas adelante (quedaron fuera del alcance inicial)

- Cobertura de ejercicios sin ningun equipo (solo "Peso corporal") es limitada
  para hombros y biceps: la app te avisa cuando falta un ejercicio para algun
  musculo y te sugiere sumar "Objetos varios" (mochila, botellas, etc.).
- No hay cuenta ni respaldo en la nube: si queres pasar tu historial a otro
  dispositivo, por ahora no hay forma automatica (se podria agregar un
  exportar/importar `.json` mas adelante).
- Un solo ejercicio (Burpees) todavia no tiene fotos reales de ejecucion: no
  encontramos una coincidencia confiable ni en free-exercise-db ni en
  wger.de (que ademas esta bloqueando pedidos automatizados con un desafio
  anti-bots al momento de escribir esto), asi que preferimos no mostrar una
  foto incorrecta antes que arriesgar el formato. Se puede ir sumando a mano
  en `js/data-exercises.js` (campo `howto_images`).
