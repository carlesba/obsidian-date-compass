# Date Compass

Date Compass es un plugin de Obsidian que entiende fechas escritas en inglés o en español natural y
las convierte en enlaces a tus notas de fecha. Escribe `@el miércoles pasado` y obtienes
`[[2026-11-11]]`; escribe `cada lunes y miércoles durante 4 semanas` y obtienes un enlace por cada fecha; ejecuta
un comando que escribe `dates`, `start` y `end` en las propiedades de una nota. También gestiona
los ajustes de tus notas diarias, semanales, mensuales, trimestrales y anuales, para que todas las
funciones estén de acuerdo en qué nota es "2026-W48".

Read in English: [README.md](README.md).

Los ejemplos suponen que hoy es **martes 17 de noviembre de 2026** y que la semana empieza el lunes.
Los nombres de los ajustes son los que muestra Obsidian con la interfaz en español.

- [Expresiones de fecha](#expresiones-de-fecha)
- [Notas de fecha y plantillas](#notas-de-fecha-y-plantillas)
- [Menciones mientras escribes](#menciones-mientras-escribes)
- [Insertar secuencia de fechas](#insertar-secuencia-de-fechas)
- [Acciones de fecha](#acciones-de-fecha)
- [API pública para Templater](#api-pública-para-templater)
- [Organización de los ajustes](#organización-de-los-ajustes)
- [Fuera de la v1](#fuera-de-la-v1)
- [Para Carles: comprobaciones a mano y decisiones abiertas](#para-carles-comprobaciones-a-mano-y-decisiones-abiertas)

## Expresiones de fecha

Todas las funciones leen las fechas con el mismo analizador. Entiende las expresiones de abajo en
cada idioma activado en **Idiomas**, no distingue mayúsculas ni acentos (`miercoles` =
`miércoles`) y separa palabras de cifras (`3daysago` = `3 days ago`). Mientras escribes, la última
palabra también se completa: `next we` ofrece "next Wed" y "next week".

Cuando una palabra significa cosas distintas en dos idiomas activados, obtienes todos los
significados y eliges tú: `mar` es marzo en inglés (March) y martes en español. Date Compass nunca
adivina.

### Inglés

| Escribes | Obtienes |
| --- | --- |
| `today`, `tomorrow` o `tmr`, `yesterday` o `yest` | 17 nov, 18 nov, 16 nov |
| `wed` | el siguiente miércoles después de hoy: 18 nov |
| `this wed` | el miércoles de esta semana: 18 nov (puede estar en el pasado) |
| `next wed` | el miércoles de la semana que viene: 25 nov (ver **"Próximo" día de la semana significa**) |
| `last wed` | el miércoles pasado más reciente: 11 nov |
| `3daysago`, `3d ago`, `-3d` | 14 nov |
| `in a week`, `+1w`, `1 week`, `in 2 weeks` | 24 nov, 24 nov, 24 nov, 1 dic |
| `in 40 days`, `40d` | 27 dic |
| `dec 3`, `3 dec`, `december 3rd`, `2026-12-03` | 3 dic; una fecha sin año es del año actual |
| `3/12` | 3 dic (ver **Fechas numéricas**) |
| `this week`, `next week`, `last week`, `W50`, `2026-W48` | notas semanales 2026-W47, W48, W46, W50, W48 |
| `week of dec 3` | la nota semanal que contiene el 3 dic: 2026-W49 |
| `this month`, `last month`, `march` | notas mensuales 2026-11, 2026-10, 2026-03 |
| `next quarter`, `Q1`, `2026-Q1` | notas trimestrales 2027-Q1, 2026-Q1, 2026-Q1 |
| `next year`, `2027` | la nota anual 2027 |

Las unidades se escriben `d day days`, `w wk week weeks`, `m mo month months`, `q quarter
quarters`, `y yr year years`. "In 2 weeks" es un día, no una nota semanal.

Los rangos y las secuencias dan varias fechas a la vez:

| Escribes | Obtienes |
| --- | --- |
| `today to fri`, `from today to fri`, `today - fri`, `today..fri`, `today until fri` | 17, 18, 19 y 20 nov |
| `mon to fri` | del 23 al 27 nov |
| `fri to mon` | del 20 al 23 nov: un día final va después del inicial |
| `next 5 days`, `last 3 days` | cinco días desde hoy; tres días que acaban hoy |
| `next 3 weeks` | tres notas semanales empezando por esta semana |
| `every mon for 4 weeks` | 23 nov, 30 nov, 7 dic, 14 dic |
| `every mon, wed for 4 weeks` | esos días durante las próximas 4 semanas, desde hoy |
| `every 2 days x5`, `every 2 weeks 5 times` | cinco fechas desde hoy, separadas por ese paso |
| `W48 to W50`, `weeks of december` | las notas semanales de W48 a W50; las cinco semanas que tocan diciembre |

Un rango o una secuencia de más de 366 fechas se rechaza con un mensaje.

### Español

Activa **Español** en **Idiomas** para usarlas.

| Escribes | Obtienes |
| --- | --- |
| `hoy`, `mañana`, `ayer`, `pasado mañana`, `anteayer` | 17, 18, 16, 19 y 15 nov |
| `este miércoles` | el miércoles de esta semana: 18 nov |
| `el próximo miércoles`, `miércoles que viene` | el miércoles de la semana que viene: 25 nov |
| `el miércoles pasado` | 11 nov |
| `hace 3 días` | 14 nov |
| `en 3 días`, `dentro de una semana` | 20 nov, 24 nov |
| `3 de diciembre` | 3 dic |
| `esta semana`, `la semana que viene` | notas semanales 2026-W47, 2026-W48 |
| `el mes pasado` | la nota mensual 2026-10 |
| `el próximo trimestre`, `el año que viene` | la nota trimestral 2027-Q1, la nota anual 2027 |
| `de hoy a viernes` | del 17 al 20 nov |
| `del lunes al viernes` | del 23 al 27 nov |
| `los próximos 5 días` | cinco días desde hoy |
| `cada lunes y miércoles durante 4 semanas` | lunes y miércoles de las próximas 4 semanas |
| `cada 2 días 5 veces` | cinco fechas desde hoy, cada dos días |

## Notas de fecha y plantillas

Date Compass sustituye al plugin Periodic Notes. Ajustes → Date Compass → **Notas de fecha** tiene
un grupo por periodo: **Notas diarias**, **Notas semanales**, **Notas mensuales**, **Notas
trimestrales** y **Notas anuales**. Cada uno tiene:

- **Activadas**: las notas de este periodo se pueden abrir, crear y enlazar. Las trimestrales
  empiezan desactivadas.
- **Carpeta**: dónde viven las notas; vacía es la raíz de la bóveda.
- **Formato del nombre**: un formato de moment.js como `YYYY-MM-DD`. Las barras crean subcarpetas.
  Por defecto son `YYYY-MM-DD`, `GGGG-[W]WW`, `YYYY-MM`, `YYYY-[Q]Q` y `YYYY`.
- **Plantilla**: la nota cuyo contenido rellena una nota nueva de este periodo. Vacía crea las
  notas nuevas vacías, y así manda cualquier regla de carpeta o regex de Templater.

**Aplicar plantillas con** elige quién rellena la plantilla: **Automático** (Templater si está
activado; si no, las plantillas del núcleo; si no, el propio Date Compass), **Templater** o
**Plantillas del núcleo**. El relleno propio de Date Compass sustituye `{{title}}`, `{{date}}`,
`{{time}}`, `{{date:FORMAT}}` y `{{time:FORMAT}}`, donde `{{date}}` es la fecha de la propia nota y
no la de hoy. Una plantilla se aplica una sola vez, aunque las reglas de "trigger on new file
creation" de Templater también coincidan con la nota nueva.

**Si vienes de Periodic Notes.** Al cargarse por primera vez, Date Compass copia las carpetas,
formatos y plantillas de Periodic Notes, o los ajustes de la nota diaria del núcleo Notas diarias
cuando Periodic Notes no está instalado. Desde entonces los gestiona él. Si más adelante Periodic
Notes o Notas diarias tienen otras carpetas o formatos, la página Notas de fecha muestra un aviso,
porque Calendar y otros plugins leen esos ajustes. Su botón **Copiarlos aquí** copia sus valores en
Date Compass. Date Compass nunca cambia los ajustes de otro plugin.

Comandos:

- **Abrir la nota de hoy**, **Abrir la nota de esta semana**, **Abrir la nota de este mes**,
  **Abrir la nota de este trimestre**, **Abrir la nota de este año**: uno por periodo activado. Una
  nota que aún no existe se crea.
- **Abrir la nota siguiente del mismo periodo** y **Abrir la nota anterior del mismo periodo**:
  desde la nota de fecha en la que estás, salta a la nota existente más cercana antes o después.
- **Abrir una nota de fecha escribiendo una frase**: escribe `next month` o `el miércoles pasado`,
  mira a qué nota apunta y pulsa Intro para abrirla, creándola si hace falta.

## Menciones mientras escribes

Escribe el disparador, `@` por defecto, y una frase. Una lista de sugerencias muestra a qué apunta
cada lectura antes de aceptarla, como `Wed 11 Nov → [[2026-11-11]]`. La frase puede tener espacios:
`@el miércoles pasado`, `@de hoy a viernes`. Un rango muestra una sola fila, como `Tue 17 → Fri 20
Nov · 4 dates`, que inserta los cuatro enlaces. Las filas van en este orden: la mejor lectura, las
otras lecturas (otros idiomas, palabras ambiguas) y luego las formas de completar lo que escribes.

Los enlaces siguen los ajustes de enlaces de tu bóveda (wikilinks o Markdown, estilo de ruta), y un
enlace a una nota que aún no existe se inserta igualmente; la nota no se crea. Las sugerencias nunca
se abren dentro de bloques de código, código en línea ni frontmatter. Escape cierra la lista y
queda cerrada para esa mención.

Ajustes → **Menciones**:

- **Menciones**: activa o desactiva las sugerencias. Activadas por defecto.
- **Disparador**: los caracteres que inician una mención.
- **Periodos que se pueden mencionar**: un interruptor por periodo. Un periodo desactivado en Notas
  de fecha nunca se ofrece.
- **Texto del enlace**: **El nombre de la nota**, **La frase escrita** o **Un formato de fecha**;
  con este último, **Formato del texto del enlace** lo define, como `ddd D MMM`.
- **Entre enlaces de un rango**: **Coma y espacio**, **Espacio** o **Una viñeta por línea**.

La página avisa cuando otro plugin activado (Natural Language Dates, su versión revivida, Date List
o las menciones de Note Compass) usa el mismo disparador, porque las dos listas competirían.

## Insertar secuencia de fechas

El comando **Insertar secuencia de fechas** abre un cuadro con un solo campo. Mientras escribes
muestra el resultado, con el número de fechas y la primera y la última (`4 dates · Mon 23 Nov – Mon 14 Dec`
con la interfaz en inglés para `every mon for 4 weeks`), o dice
por qué el texto no es una fecha, o sugiere cómo seguir escribiendo. Intro inserta los enlaces en
el cursor.

Ajustes → **Insertar secuencia**:

- **Disposición**: **En línea, con el separador de Menciones entre enlaces de un rango** (por
  defecto), **Lista con viñetas** o **Uno por línea**.
- **Plantilla de cada elemento**: el texto que se inserta por cada fecha, donde `{{link}}` es su
  enlace, como `Revisar {{link}}`. Una plantilla sin `{{link}}` se rechaza.

## Acciones de fecha

Una acción es un comando que te hace preguntas y escribe las fechas que respondes en las propiedades
de la nota actual o en el cursor. Cada acción activada aparece en la paleta de comandos como
"Date Compass: *nombre*".

### Los dos predefinidos

Los dos se añaden en la primera instalación y se pueden quitar.

- **Añadir fechas** pregunta **Fechas** (por ejemplo `de hoy a viernes`) y luego **¿Actualizar
  inicio y fin?** (sí o no). Añade los enlaces a la propiedad `dates` y, si respondes que sí, pone
  en `start` la primera fecha y en `end` la última, como texto de fecha. Un valor suelto que ya
  esté en `dates` se convierte antes en una lista.
- **Poner recordatorios** pregunta **Recordatorios** (por ejemplo `cada lunes y miércoles durante
  4 semanas`) y añade los enlaces a la propiedad `reminders`.

### Crear una acción

Ajustes → **Acciones** lista todas las acciones. Arrastra una fila para reordenar, usa su casilla
para activar o desactivar el comando y haz clic para editarla. **Añadir acción** crea una. La
página de una acción tiene:

- **Activada** y **Nombre**: el nombre del comando en la paleta.
- **Preguntas**, que se añaden con **Añadir pregunta**. Cada pregunta tiene:
  - **Clave**: el nombre con el que las escrituras usan su respuesta.
  - **Pregunta**: lo que pregunta el comando; vacía pregunta con la clave.
  - **Tipo de campo**: **Una fecha**, **Fechas: un rango, una secuencia o una lista**, **Una nota
    periódica** o **Sí o no**.
  - **Cómo se usa la respuesta**: qué escrituras la usan.
  - **Se puede omitir**: si se puede dejar sin responder; las escrituras que usan una respuesta
    omitida no escriben nada.
  - **Escrito de antemano**: texto ya escrito cuando se abre la pregunta, como `hoy`. En una
    pregunta de sí o no, `no` ofrece No primero.
- **Escrituras**, que se añaden con **Añadir escritura**. Cada escritura tiene:
  - **Escribir la respuesta en**: **Una propiedad** (y **Propiedad** le da nombre) o **La nota en
    el cursor**, dispuesta como en Insertar secuencia.
  - **Respuesta de**: la pregunta cuyas fechas se escriben.
  - **Qué fechas de la respuesta**: **Todas**, **La primera** o **La última**.
  - **Escribir cada fecha como**: **Un enlace** o **Texto de fecha** con el formato de nombre del
    periodo.
  - **Valores que ya tiene la propiedad**: **Conservarlos y añadir las fechas detrás**,
    **Conservarlos, añadir las fechas, quitar duplicados y ordenar por fecha** (por defecto) o
    **Sustituirlos por las fechas**.
  - **Escribir solo cuando**: **Siempre**, o cuando una pregunta de sí o no se responde que sí.

Los enlaces que se escriben en propiedades son siempre wikilinks, porque las propiedades de
Obsidian no tratan los enlaces Markdown como enlaces.

## API pública para Templater

Otros plugins y los scripts de Templater llegan a Date Compass con
`app.plugins.plugins["date-compass"].api`. Tiene seis funciones, y cada una lee tus ajustes
actuales: idiomas, inicio de semana, orden de las fechas numéricas y las carpetas y formatos de
Notas de fecha.

Los resultados son objetos simples, así que los scripts no necesitan ninguna biblioteca. Una
**nota** tiene:

| Campo | Significado | Ejemplo |
| --- | --- | --- |
| `period` | `day`, `week`, `month`, `quarter` o `year` | `week` |
| `start` | el primer día del periodo, `YYYY-MM-DD` | `2026-11-16` |
| `date` | la fecha que da nombre a la nota; `notePath(date, period)` devuelve `path` | `2026-11-19` |
| `name` | el nombre de la nota, según el formato del nombre del periodo | `2026-W47` |
| `path` | la ruta en la bóveda, según la carpeta y el formato del periodo | `journal/2026-W47.md` |

Una **lectura** tiene `language` (`en` o `es`) y `notes`: una nota para una fecha o un periodo, y
varias para un rango o una secuencia.

`now` es opcional en todas y por defecto es el momento actual; pasa un `Date` o un moment. Un
argumento `date` admite un `Date`, un moment o un texto `YYYY-MM-DD`; cualquier otra cosa, o un
periodo desconocido, lanza un error. Las expresiones de un periodo desactivado en Notas de fecha no
dan resultado, igual que en las menciones. Los tipos de TypeScript `DateCompassApi`,
`DateCompassInterpretation` y `DateCompassNote` se exportan desde `src/api/index.ts`.

Empieza cada script con:

```js
const dc = app.plugins.plugins["date-compass"].api;
```

**`parse(text, now?)`** devuelve todas las lecturas del texto, una por significado, en el orden de
tus idiomas; una lista vacía cuando nada encaja.

```js
<%* for (const reading of dc.parse("mar")) tR += `${reading.language}: [[${reading.notes[0].name}]]\n`; %>
```

**`resolve(text, now?)`** devuelve la mejor lectura, o `undefined`. Sustituye a
`nldates.parseDate(...)`.

```js
<%* const when = dc.resolve(await tp.system.prompt("¿Cuándo?")); tR += when ? `[[${when.notes[0].name}]]` : ""; %>
```

**`sequence(text, now?)`** devuelve en orden las notas de un rango o una secuencia, una sola nota
para una fecha suelta, o una lista vacía.

```js
<%* tR += dc.sequence("cada lunes y miércoles durante 4 semanas").map((note) => `- [ ] Revisar [[${note.name}]]`).join("\n"); %>
```

**`notePath(date, period)`** devuelve dónde vive la nota de ese periodo, exista o no.

```js
<%* tR += `[[${dc.notePath(tp.date.now("YYYY-MM-DD"), "week").replace(/\.md$/, "")}|Esta semana]]`; %>
```

**`dateOf(path)`** lee una ruta como nota de fecha, o devuelve `undefined` si no lo es.

```js
<%* const note = dc.dateOf(tp.file.path(true)); if (note) tR += `${note.period} desde ${note.start}`; %>
```

**`openNote(date, period)`** abre esa nota y la crea con su plantilla si no existe.

```js
<%* await dc.openNote(tp.date.now("YYYY-MM-DD", 1), "day"); %>
```

## Organización de los ajustes

La página principal es corta:

- **Idiomas**: un interruptor para **Inglés** y otro para **Español**. Al principio están activados
  el idioma de tu interfaz y el inglés.
- **La semana empieza el**: **Según la configuración regional**, **Lunes** o **Domingo**.
- **"Próximo" día de la semana significa**: **Ese día de la semana que viene** (por defecto) o **La
  próxima vez que llegue ese día**.
- **Fechas numéricas**: **Día y luego mes** (por defecto) o **Mes y luego día**, para `3/12`.
- **Notas de fecha**, **Menciones**, **Insertar secuencia** y **Acciones**: haz clic en una fila
  para abrir su página.
- **Restablecer todos los ajustes**: devuelve cada opción a los valores predeterminados tras
  confirmarlo.

No hay nada oculto: todo comportamiento que elige u oculta algo es uno de estos ajustes.

## Fuera de la v1

- Una vista de calendario; está prevista para una versión posterior.
- Horas del día.
- Idiomas distintos del inglés y el español.
- Publicar en la lista de plugins de la comunidad, un repositorio de GitHub, etiquetas o versiones.

## Para Carles: comprobaciones a mano y decisiones abiertas

- [docs/hand-checks.md](docs/hand-checks.md): qué comprobar a mano en `~/Obsidian/plugin tester`.
- [docs/decisions.md](docs/decisions.md): las decisiones tomadas sin ti, para confirmarlas o
  revertirlas.
