# Date Compass

Date Compass es un plugin de Obsidian que entiende fechas escritas en inglés o en español natural y
las convierte en enlaces a tus notas de fecha. Escribe `@el miércoles pasado` y obtienes
`[[2026-11-11]]`; escribe `cada lunes y miércoles durante 4 semanas` y obtienes un enlace por cada fecha; ejecuta
un comando que rellena una propiedad como `dates` en la nota actual. También gestiona
los ajustes de tus notas diarias, semanales, mensuales, trimestrales y anuales, para que todas las
funciones estén de acuerdo en qué nota es "2026-W48".

Read in English: [README.md](README.md).

Los ejemplos suponen que hoy es **martes 17 de noviembre de 2026** y que la semana empieza el lunes.
Los nombres de los ajustes son los que muestra Obsidian con la interfaz en español.

- [Expresiones de fecha](#expresiones-de-fecha)
- [Notas de fecha y plantillas](#notas-de-fecha-y-plantillas)
- [Menciones mientras escribes](#menciones-mientras-escribes)
- [Insertar fechas y los ajustes de Inserción](#insertar-fechas-y-los-ajustes-de-inserción)
- [Acciones de fecha](#acciones-de-fecha)
- [API pública para Templater](#api-pública-para-templater)
- [Organización de los ajustes](#organización-de-los-ajustes)
- [Todavía no](#todavía-no)
- [Para Carles: comprobaciones a mano y decisiones abiertas](#para-carles-comprobaciones-a-mano-y-decisiones-abiertas)

## Expresiones de fecha

Todas las funciones leen las fechas con el mismo analizador. Entiende las expresiones de abajo en
cada idioma de la lista **Entender fechas en**, no distingue mayúsculas ni acentos (`miercoles` =
`miércoles`) y separa palabras de cifras (`3daysago` = `3 days ago`). Mientras escribes, la última
palabra también se completa: `next we` ofrece "next Wed" y "next week".

Cuando una palabra significa cosas distintas en dos idiomas de la lista, obtienes todos los
significados y eliges tú, con el primer idioma de la lista arriba: `mar` es marzo en inglés
(March) y martes en español. Date Compass nunca adivina.

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
| `3/12` | 3 dic (ver **Leer fechas escritas como**) |
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
| `every 2 days x5`, `every 2 weeks 5 times`, `every 2 days for 10 times` | ese número de fechas separadas por ese paso, la primera un paso después de hoy: `every 2 days x5` empieza el 19 nov |
| `every week 3 times`, `every day for 5 days` | 24 nov, 1 dic, 8 dic; del 18 al 22 nov, así que `every day` empieza mañana |
| `every wed until dec 20` | cada miércoles desde hoy hasta el 20 dic, con el último día incluido si coincide |
| `every other day for 6 days` | un día sí y otro no durante 6 días, el primero dentro de dos días: 19, 21 y 23 nov |
| `every other wed for 3 months` | miércoles alternos durante los próximos 3 meses |
| `wed for 5 weeks` | un miércoles por semana durante 5 semanas, como `every wed for 5 weeks` |
| `every week 3 times starting next week`, `every week from next week 3 times` | 23 nov, 30 nov, 7 dic: la primera fecha es el inicio de `next week` |
| `every wed 3 times starting next week` | el primer miércoles desde ese inicio: 25 nov, 2 dic, 9 dic |
| `every day from dec 3 until dec 7` | del 3 al 7 dic |
| `W48 to W50`, `weeks of december` | las notas semanales de W48 a W50; las cinco semanas que tocan diciembre |

Una secuencia que nombra un paso (`every day`, `every 2 weeks`, `every month`) empieza un paso
después de hoy, y una que nombra días de la semana (`every wed`) empieza hoy. Añade `starting` o
`from` y una fecha o un periodo, antes o después de `for`, `times` o `until`, para empezar en otro
momento; `for` cuenta entonces desde ese inicio. Con `until`, una fecha sin año es la próxima vez que llega: si el `dec 20` ya pasó este año, se
entiende el 20 dic del año que viene. `every other wed` cuenta las semanas alternas desde el inicio
de la semana actual, según **La semana empieza el**, así que un día que ya pasó esta semana
aparece por primera vez dentro de dos semanas. Mientras escribes una secuencia, la lista de `@` muestra filas con las fechas que daría cada forma de
seguir, como con `@every` o `@every wed for 5`, y los resultados iguales comparten fila. Cuando la secuencia está completa, como en
`@every week 3 times`, la lista la ofrece también con `starting tomorrow`, `starting next week` y `starting next month`. Insertar
fechas dice «Sigue escribiendo, como en every wed for 5 times.» bajo el cuadro.

Un rango o una secuencia de más de 366 fechas se rechaza con un mensaje, y la API no devuelve nada
para él.

### Español

Añade **Español** en **Entender fechas en** para usarlas.

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
| `cada 2 días 5 veces`, `cada 2 días durante 10 veces` | ese número de fechas cada dos días, la primera dentro de dos días |
| `cada miércoles hasta el 20 de diciembre` | cada miércoles desde hoy hasta el 20 dic |
| `cada otro día durante 6 días` | un día sí y otro no durante 6 días, el primero dentro de dos días |
| `cada otro miércoles durante 3 meses` | miércoles alternos durante los próximos 3 meses |
| `miércoles durante 5 semanas` | un miércoles por semana durante 5 semanas |
| `cada semana 3 veces empezando la semana que viene`, `cada semana 3 veces a partir del lunes` | 23 nov, 30 nov, 7 dic |
| `cada día durante 5 días desde el 3 de diciembre` | del 3 al 7 dic |

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
cada lectura antes de aceptarla, como `Wed 11 Nov → [[2026-11-11]]` (las filas de ejemplo de esta
sección se muestran como en la interfaz en inglés; en español las fechas y el recuento van en
español). La frase puede tener espacios:
`@el miércoles pasado`, `@de hoy a viernes`. Un rango muestra una sola fila, como `Tue 17 → Fri 20
Nov · 4 dates`, que inserta los cuatro enlaces. Las filas van en este orden: la mejor lectura, las
otras lecturas (otros idiomas, palabras ambiguas) y luego las formas de completar lo que escribes.

Los enlaces siguen los ajustes de enlaces de tu bóveda (wikilinks o Markdown, estilo de ruta), y un
enlace a una nota que aún no existe se inserta igualmente; la nota no se crea. Cómo se escribe cada
enlace se define en Inserción, más abajo. Las sugerencias nunca
se abren dentro de bloques de código, código en línea ni frontmatter. Escape cierra la lista y
queda cerrada para esa mención.

Ajustes → **Menciones**:

- **Menciones**: activa o desactiva las sugerencias. Activadas por defecto.
- **Disparador**: los caracteres que inician una mención.
- **Periodos que se pueden mencionar**: un interruptor por periodo. Un periodo desactivado en Notas
  de fecha nunca se ofrece.

Teclas de la lista: Intro inserta la fila seleccionada, ⇧↵ abre Insertar fechas con la frase
escrita y ⌥↵ inserta con el texto del enlace invertido. La última fila, **Más…**, hace lo mismo que
⇧↵, así que en el móvil toca **Más…**; en Insertar fechas, el interruptor **Con texto en el
enlace** es el equivalente táctil de ⌥↵.

La página avisa cuando otro plugin activado (Natural Language Dates, su versión revivida, Date List
o las menciones de Note Compass) usa el mismo disparador, porque las dos listas competirían.

## Insertar fechas y los ajustes de Inserción

El comando **Insertar fechas** abre un cuadro con un solo campo. Mientras escribes muestra el
resultado, con el número de fechas y la primera y la última (`4 dates · Mon 23 Nov – Mon 14 Dec`
con la interfaz en inglés para `every mon for 4 weeks`), o dice por qué el texto no es una fecha, o
sugiere cómo seguir escribiendo. La línea de enlaces se corta con puntos suspensivos si es larga. El
interruptor **Con texto en el enlace** escribe los enlaces con un texto en lugar del nombre de la
nota, y el botón **Hecho** o Intro inserta los enlaces en el cursor. En escritorio, ⌥↵ en lugar de
Intro invierte **Con texto en el enlace** para esa inserción; en el móvil usa el interruptor.

Desde la lista de `@`, **Más…** o ⇧↵ abre este cuadro con la frase que escribiste; al pulsar Hecho,
los enlaces sustituyen a `@frase`.

**En una propiedad.** Con el cursor en una línea de propiedad en modo código, o con un campo de
propiedad enfocado en la vista de Propiedades, Insertar fechas añade los enlaces a esa propiedad en
lugar de al cuerpo. El cuadro dice entonces "Las fechas se añadirán a la propiedad «{name}»." y no
tiene línea de enlaces ni interruptor. Los valores que ya tiene la propiedad conservan su orden, un
`2026-11-23` suelto se queda con el enlace añadido a su lado y un enlace que ya está no se añade dos
veces. Los enlaces escritos en una propiedad son wikilinks sin más. Con el cursor en una línea del frontmatter que
no es una propiedad aparece «Coloca el cursor en una propiedad para añadirle fechas.»; el texto
nunca se escribe dentro del YAML.

Ajustes → **Inserción** define cada enlace que escribe Date Compass, desde la lista de `@` y desde
Insertar fechas:

- **Forma de cada enlace**: el texto que se escribe por cada fecha; por defecto `{{link}}`.
  Variables: `{{link}}` es el enlace que crea Obsidian, `{{name}}` el nombre de la nota, `{{path}}`
  su ruta, `{{alias}}` el texto del enlace y `{{date:FORMATO}}` la fecha en formato moment.js.
  Ejemplo: `Revisar {{link}}`. Una plantilla vacía se rechaza.
- **Entre varios enlaces**: **Coma y espacio** (por defecto), **Espacio**, **Una viñeta por línea**
  o **Un enlace por línea**. Una sola fecha es siempre un enlace sin más, nunca una viñeta.
- Grupo **Texto del enlace**:
  - **Mostrar un texto en lugar del nombre de la nota**: desactivado por defecto; ⌥↵ y el
    interruptor **Con texto en el enlace** lo invierten en una inserción.
  - **Qué dice el texto del enlace**: **La frase escrita** o **Un formato de fecha** (por defecto).
    Con la frase escrita, varias fechas no llevan texto en el enlace.
  - **Formato de fecha del texto del enlace**: solo aparece con **Un formato de fecha**; por
    defecto `ddd D MMM`.

## Acciones de fecha

Una acción es un comando que hace una pregunta y rellena una propiedad de la nota actual,
sustituyendo su valor. Cada acción activada aparece en la paleta de comandos como "Date Compass:
*nombre*". Una acción sin propiedad no se ofrece.

### Las dos acciones predefinidas

Los dos se añaden en la primera instalación y se pueden quitar. Los dos piden **Fechas** y tienen
activado **Cada fecha como enlace**.

- **Poner fechas** rellena la propiedad `dates`.
- **Poner recordatorios** rellena la propiedad `reminders`.

### Crear una acción

Ajustes → **Acciones** lista todas las acciones. Cada fila tiene un interruptor que ofrece la acción
como comando y un lápiz para editarla. Arrastra una fila para reordenarla, bórrala desde la lista y
**Añadir acción** crea una. La página de una acción tiene:

- **Activada**: ofrece esta acción como el comando "Date Compass: <nombre>".
- **Nombre**: el nombre del comando en la paleta de comandos.
- **Propiedad que rellena**: la propiedad de la nota actual que recibe la respuesta. Su valor se
  sustituye.
- **Qué pide**: **Una fecha** admite una frase de una nota de cualquier periodo activado y muestra
  en su cuadro la pregunta «¿Qué fecha para {name}?» como texto de ayuda, y encima de los resultados
  la frase "La fecha sustituirá el valor de la propiedad «{name}».", que no desaparece al escribir. **Fechas** abre un
  cuadro como el de Insertar fechas, «¿Qué fechas para {name}?», para cualquier rango, secuencia o
  lista, dice "Las fechas sustituirán el
  valor de la propiedad «{name}»." y escribe todas las fechas.
- **Cada fecha como enlace**: activado escribe cada fecha como un enlace. Desactivado escribe texto
  con el formato del tipo de propiedad: `YYYY-MM-DD` para fecha,
  `YYYY-MM-DDTHH:mm` para fecha y hora, y el nombre de la nota en los demás tipos.

Una frase que da una sola fecha escribe un valor, no una lista, salvo que la propiedad sea una lista
o ya contenga una, que sigue siendo lista. El enlace es siempre un wikilink, porque las propiedades
de Obsidian no tratan los enlaces Markdown como enlaces. Cancelar cualquiera de los cuadros no
cambia nada.

### Si vienes de la v1

Al cargar por primera vez, las acciones de la v1 se convierten. Una acción conserva su primera
escritura en una propiedad: esa propiedad y, si escribía enlaces, enlaces. El tipo de su pregunta da
**Una fecha** (fecha o nota periódica) o **Fechas** (cualquier otro). Todo lo demás se pierde: las
escrituras siguientes, las escrituras en el cuerpo, las preguntas de sí o no y sus condiciones, los
modos, primera y última, e inicio y fin. Toda acción convertida ahora sustituye el valor donde la v1
añadía. Una acción sin escritura en una propiedad se elimina. El predefinido "Añadir fechas" pasa a
llamarse **Poner fechas**.

## API pública para Templater

Otros plugins y los scripts de Templater llegan a Date Compass con
`app.plugins.plugins["date-compass"].api`. Tiene seis funciones, y cada una lee tus ajustes
actuales: idiomas, inicio de semana, qué significa "próximo" día de la semana, cómo se leen las fechas
escritas y las carpetas, formatos e interruptores Activadas de Notas de fecha.

Los resultados son objetos simples, así que los scripts no necesitan ninguna biblioteca. Una
**nota** tiene:

| Campo | Significado | Ejemplo |
| --- | --- | --- |
| `period` | `day`, `week`, `month`, `quarter` o `year` | `week` |
| `start` | el primer día del periodo, `YYYY-MM-DD` | `2026-11-16` |
| `date` | la fecha que da nombre a la nota; `notePath(date, period)` devuelve `path` | `2026-11-19` |
| `name` | el nombre de la nota, según el formato del nombre del periodo | `2026-W47` |
| `path` | la ruta en la bóveda, según la carpeta y el formato del periodo | `journal/2026-W47.md` |

Una **lectura** tiene `language` (`en`, `es`, o `shared` para expresiones sin palabras como `W50`,
`-3d` o `3/12`) y `notes`: una nota para una fecha o un periodo, y
varias para un rango o una secuencia.

`now` es opcional en todas y por defecto es el momento actual; pasa un `Date` o un moment. Un
argumento `date` admite un `Date`, un moment o un texto `YYYY-MM-DD`. Cualquier otra cosa, un
periodo desconocido o un periodo desactivado en Notas de fecha hacen que `notePath` lance un error y
que `openNote` lo rechace. Las expresiones de un periodo desactivado en Notas de fecha no dan
resultado, igual que en las menciones. Una semana es la que nombra el formato: semanas ISO con el
`GGGG-[W]WW` por defecto, así que con semanas que empiezan en domingo pasa el `date` de una nota y no
su `start`. Los tipos de TypeScript `DateCompassApi`,
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

La página principal tiene un grupo **Localización**:

- **Entender fechas en**: los idiomas como fichas, por orden de prioridad. **Añadir idioma** añade
  uno al final; cada ficha tiene un botón para quitarla, salvo la última que queda. Cuando una
  palabra significa cosas distintas, como "mar", la primera fila es la del primer idioma.
- **La semana empieza el**: **Según la configuración regional** (por defecto), **Lunes** o
  **Domingo**.
- **"Próximo" día de la semana significa**: **Ese día de la semana que viene** (por defecto) o **La
  próxima vez que llegue ese día**.
- **Leer fechas escritas como**: **D/M, como en 31/12** (por defecto) o **M/D, como en 12/31**,
  para `3/12`.

Debajo, haz clic en una fila para abrir su página: **Notas de fecha**, **Menciones**, **Inserción**
y **Acciones**. Al final está **Restablecer todos los ajustes**, que devuelve cada opción a los
valores predeterminados tras confirmarlo.

No hay nada oculto: todo comportamiento que elige u oculta algo es uno de estos ajustes.

## Todavía no

- Una vista de calendario; está prevista para una versión posterior.
- Horas del día.
- Idiomas distintos del inglés y el español.
- Publicar en la lista de plugins de la comunidad, un repositorio de GitHub, etiquetas o versiones.

## Para Carles: comprobaciones a mano y decisiones abiertas

- [docs/hand-checks.md](docs/hand-checks.md): qué comprobar a mano en `~/Obsidian/plugin tester`.
- [docs/decisions.md](docs/decisions.md): las decisiones tomadas sin ti, para confirmarlas o
  revertirlas.
