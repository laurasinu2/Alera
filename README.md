# Alera PWA

PWA local-first para organizar un plan de inglés por semanas, registrar práctica y gestionar revisiones ancladas a la fecha original de aprendizaje.

## Qué incluye

- Perfil local: nombre y foto opcional. Sin login, correo, backend ni cuenta remota.
- Plan English B2 de 19 semanas (21/09/2026–31/01/2027) cargado desde el temario entregado, incluyendo objetivos semanales de Speaking, Writing, Reading y Listening.
- 73 Knowledge Items: Grammar, Vocabulary y Pronunciation.
- Practice: Speaking, Writing, Reading y Listening aparecen también en “Esta semana” con su temario asociado y abren directamente el registro de sesión.
- Los Knowledge Items de la pantalla semanal se pueden marcar y desmarcar; al desmarcar se reinicia su calendario de revisiones.
- Las flechas de Grammar/Vocabulary/Pronunciation abren el detalle semanal de la categoría; las de Practice abren el registro de esa sesión.
- Dificultades de Practice vinculables a Knowledge para aumentar prioridad de refuerzo.
- Reviews con calendario **no acumulativo**: +1, +2, +4, +6, +10, +16 y +24 semanas, siempre desde `learnedAt`.
- Si una revisión se hace tarde, no desplaza las siguientes. Una revisión tardía cubre los hitos base ya vencidos hasta esa semana.
- Las dificultades o una review mala crean refuerzos extraordinarios sin alterar el calendario base.
- Biblioteca/Knowledge, detalle del tema, retención estimada, historial y gráficas.
- Progress para Speaking, Writing, Reading, Listening y retención de Knowledge.
- Exportación/importación de copia JSON.
- Service Worker y manifest para uso offline e instalación como PWA.

## Almacenamiento

Todo el estado se guarda en `localStorage` bajo la clave `alera_pwa_v1`. La foto de perfil también se guarda localmente como Data URL.

## Ejecutar en local

Una PWA necesita HTTP(S) para registrar el Service Worker. Desde esta carpeta:

```bash
python3 -m http.server 8080
```

Después abre `http://localhost:8080`.

También puedes servir la carpeta con cualquier hosting estático (GitHub Pages, Netlify, Cloudflare Pages, etc.). Para instalarla en móvil, utiliza HTTPS o localhost.

## Estructura

- `index.html` — shell
- `styles.css` — sistema visual fiel a la paleta de Alera
- `app.js` — lógica, UI, localStorage, reviews y practice
- `data.js` — temario completo y semanas
- `manifest.webmanifest` — PWA
- `sw.js` — offline cache
- `assets/icons/` — iconos suministrados

No hay dependencias externas ni llamadas de red.


### v3 visual
Paleta principal actualizada a azul y fondos neutralizados hacia blanco, manteniendo lavanda y coral como acentos.


## UI v4 compact
La interfaz usa una escala tipográfica más cercana a iOS, tarjetas y cabeceras más compactas y targets táctiles cómodos sin agrandar visualmente los controles.


## Acceso local v5

- En el primer acceso de cada navegador/dispositivo se muestra una pantalla de contraseña.
- PIN inicial configurado: `**********`.
- Tras introducirlo correctamente se guarda `alera_device_access_v1=granted` en `localStorage` y no vuelve a solicitarse en ese dispositivo.
- Si se borran los datos del sitio/app o se usa otro navegador/dispositivo, la pantalla aparecerá de nuevo.
- Es una barrera local de conveniencia, no autenticación criptográfica ni protección frente a alguien con acceso a los archivos/código de la PWA.


## Branding oficial v6

- Se han integrado los cuatro recursos de marca proporcionados: isotipo, logo horizontal y las dos pantallas verticales.
- `splash-loading.png` aparece al arrancar la PWA.
- `splash-welcome.png` sirve de fondo en el acceso PIN del primer dispositivo.
- El logo horizontal se usa de forma compacta en la cabecera y onboarding.
- El isotipo oficial genera los iconos PWA de 192/512 px y la variante maskable.
- Cache del Service Worker: `alera-v6-official-brand`.


## v7 — paleta oficial azul
La interfaz usa ahora el azul del botón de acceso (#2F84D8 → #1A65C8) y una gama derivada del logo oficial de Alera (azules claros, cian y azul profundo). Las tarjetas permanecen blancas/azuladas para conservar legibilidad.
