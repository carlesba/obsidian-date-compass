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
- [Comandos](#comandos)
- [Calendario](#calendario)
- [API pública para Templater](#api-pública-para-templater)
- [Organización de los ajustes](#organización-de-los-ajustes)
- [Todavía no](#todavía-no)

## Expresiones de fecha

Todas las funciones leen las fechas con el mismo analizador. Entiende las expresiones de abajo en
cada idioma de la lista **Idiomas admitidos**, no distingue mayúsculas ni acentos (`miercoles` =
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
`@every week 3 times`, la lista la ofrece también con `starting tomorrow`, `starting next week` y `starting next month`. El cuadro de fechas
dice «Sigue escribiendo, como en every wed for 5 times.» bajo el cuadro.

Un rango o una secuencia de más de 366 fechas se rechaza con un mensaje, y la API no devuelve nada
para él.

### Español

Añade **Español** en **Idiomas admitidos** para usarlas.

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

- **Activadas**: las notas de este periodo se pueden abrir, crear y enlazar. Solo las notas
  diarias empiezan activadas; activa los demás periodos que uses.
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
- **Abrir la nota de mañana**, **Abrir la nota de la semana que viene**, **Abrir la nota del mes
  que viene**, **Abrir la nota del próximo trimestre**, **Abrir la nota del año que viene**: lo
  mismo, un periodo más adelante.
- **Abrir la nota siguiente del mismo periodo** y **Abrir la nota anterior del mismo periodo**:
  desde la nota de fecha en la que estás, salta a la nota existente más cercana antes o después.
- **Abrir una nota de fecha escribiendo una frase**: escribe `next month` o `el miércoles pasado`,
  mira a qué nota apunta y pulsa Intro para abrirla, creándola si hace falta.

## Menciones mientras escribes

Escribe un disparador, `@` por defecto, y una frase. Una lista de sugerencias muestra a qué apunta
cada lectura antes de aceptarla, como `Wed 11 Nov → [[2026-11-11]]` (las filas de ejemplo de esta
sección se muestran como en la interfaz en inglés; en español las fechas y el recuento van en
español). La frase puede tener espacios:
`@el miércoles pasado`, `@de hoy a viernes`. Un rango muestra una sola fila, como `Tue 17 → Fri 20
Nov · 4 dates`, que inserta los cuatro enlaces. Las filas van en este orden: la mejor lectura, las
otras lecturas (otros idiomas, palabras ambiguas) y luego las formas de completar lo que escribes.

Los enlaces siguen los ajustes de enlaces de tu bóveda (wikilinks o Markdown, estilo de ruta), y un
enlace a una nota que aún no existe se inserta igualmente; la nota no se crea. Las sugerencias
nunca se abren dentro de bloques de código ni código en línea. Escape cierra la lista y queda
cerrada para esa mención.

Ajustes → **Menciones** es una lista con una fila por mención, con el disparador como nombre y sus
periodos de destino debajo. Cada fila tiene un lápiz que abre la mención, un asa para arrastrarla a
otro lugar y una ✕ que la borra; **+** añade una mención con un disparador que aún no se usa y abre su
página. No hay interruptor para desactivar las menciones: borra todas. Una instalación nueva tiene
una mención, `@`, que apunta a todos los periodos activados en Notas de fecha.

Cada mención tiene lo suyo:

- **Disparador**: los caracteres que inician la mención.
- **Periodos de destino**: los periodos a los que enlaza la mención, como lista. Cada fila tiene una
  ✕, y **+** abre un selector con los periodos que aún no están en la lista. Una mención necesita al
  menos un destino. Un destino desactivado en Notas de fecha sigue en la lista, marcado como tal, y
  se omite hasta que lo actives allí.
- **Texto alrededor de cada enlace**, **Ruta en cada enlace**, **Entre varios enlaces**, **Qué dice
  el texto del enlace** y **Formato de fecha del texto del enlace**: cómo se escriben sus enlaces,
  como se describe en [Ajustes de enlace](#ajustes-de-enlace), más abajo.

Varias menciones pueden convivir en una bóveda, cada una a su manera. Por ejemplo, deja `@` solo
para notas diarias y añade `#` solo para notas mensuales: `@fri` enlaza el día y `#nov` enlaza la
nota mensual 2026-11. El disparador `#` choca con las etiquetas de Obsidian, así que los ajustes
avisan; consulta [Choques de disparadores](#choques-de-disparadores).

Teclas de la lista: Intro inserta la fila seleccionada como enlace sin más, y ⌥↵ la inserta con
texto en el enlace. ⇧↵ abre el cuadro de fechas, descrito en [Comandos](#comandos), con la frase
escrita y los ajustes de esa mención. La última fila, **Más…**, hace lo mismo que ⇧↵, así que en el
móvil toca **Más…**; en el cuadro de fechas, el interruptor **Con texto en el enlace** es el
equivalente táctil de ⌥↵.

### Menciones en propiedades

En modo código, una mención se abre en una línea del frontmatter que pertenece a una propiedad,
como `dates: @next fri`. Al elegir una fila se añade un enlace sin más a esa propiedad, escrito con
la **Ruta en cada enlace** de la mención. El texto del enlace solo se escribe con ⌥↵, y **Texto
alrededor de cada enlace** no se aplica, así que la propiedad recibe solo el enlace. Un enlace que
ya está en la propiedad no se añade dos veces. Las menciones siguen cerradas en las líneas del
frontmatter que no son una propiedad, y no se pueden abrir en los campos de la vista de Propiedades.

### Frases fuera de los destinos

Una frase puede significar un periodo al que la mención no apunta. Date Compass la traslada
entonces a un destino en lugar de descartarla. Si hay un destino más grueso que la frase, se usa el
más fino de ellos que contiene la fecha. Si todos los destinos son más finos, se usa el más grueso
y hoy se desplaza lo mismo que la frase: el mes siguiente al mes que contiene hoy es hoy más un
mes, y un mes más corto acaba en su último día. Los ejemplos suponen que hoy es viernes 13 de
febrero de 2026 y que **Periodos de destino** lista solo los periodos indicados:

| Periodos de destino | Escribes | Obtienes |
| --- | --- | --- |
| día | `next month` | la nota diaria del 13 mar |
| día | `next week` | la nota diaria del 20 feb |
| mes | `tomorrow` | la nota mensual 2026-02 |
| día | `next month`, con hoy 31 ene | la nota diaria del 28 feb |
| día y año | `next month` | la nota anual 2026 |

Las secuencias se trasladan fecha a fecha, y las fechas que acaban en la misma nota se insertan una
sola vez. Abrir una nota de fecha escribiendo una frase y la API no usan destinos, así que leen
las frases tal como están.

### Choques de disparadores

Dos cosas pueden abrirse con los mismos caracteres, y solo gana una. La página de la mención y su
fila en la lista avisan cuando un disparador:

- es igual al de otra mención;
- es el comienzo del disparador de otra mención, o al revés, así que gana el más largo donde
  coinciden los dos;
- es igual a uno de los sugeridores propios de Obsidian o su comienzo: `[[` para enlaces, `#` para
  etiquetas, `[^` para notas al pie, `==` para colores de resaltado y `/` para comandos de barra
  cuando el plugin básico Comandos de barra está activado;
- lo usa también otro plugin activado que Date Compass conoce: Natural Language Dates, su versión
  revivida, Date List o las menciones de Note Compass.

Al guardar un disparador que choca, un aviso repite la advertencia. El disparador se guarda igualmente.
Date Compass no puede detectar otros plugins ni caracteres de Markdown como `$`, `%%`, `>`, `-`, `*`,
el acento grave o los corchetes que se emparejan, así que compruébalos tú.

## Comandos

Un comando pide una fecha o fechas y las escribe en la nota actual. Cada comando aparece en la
paleta de comandos como "Date Compass: *nombre*". Ajustes → **Comandos** los lista. Cada fila tiene
un lápiz para editarlo, un asa para arrastrarlo a otro lugar y una ✕ que lo borra, y **+** añade un
comando en blanco y abre su página. Un comando que escribe en una propiedad no se ofrece hasta que
tiene una propiedad.

### El comando predefinido

**Insertar fechas** se añade en la primera instalación y se puede quitar. Pide **Fechas** y escribe
enlaces en el cursor. Es el comando independiente Insertar fechas, ahora convertido en uno
predefinido. Los comandos que escriben en una propiedad, como uno que añada a `dates` o a
`reminders`, los añades tú.

### Crear un comando

La página de un comando tiene:

- **Nombre**: el nombre del comando en la paleta de comandos.
- **Dónde escribe**: **Una propiedad** o **En el cursor**.
  - **Una propiedad** escribe siempre en una propiedad de la nota actual, la de **Propiedad que
    rellena**. **En el cursor** necesita un editor abierto. Con el cursor en el cuerpo de la nota
    inserta ahí; con el cursor en una línea de propiedad en modo código, o con un campo de propiedad
    enfocado en la vista de Propiedades, añade a esa propiedad y no aplica la plantilla. En una línea
    del frontmatter que no es una propiedad muestra «Coloca el cursor en una propiedad para añadirle
    fechas.» y no escribe nada.
- **Propiedad que rellena** y **Cuando la propiedad ya tiene un valor**: solo con **Una propiedad**.
  **Añadir**, la opción por defecto, conserva lo que hay. **Sustituir** lo cambia por las fechas
  nuevas.
  - Añadir en una propiedad de lista, o en una que ya contiene una lista, conserva los elementos y
    escribe las fechas nuevas a continuación, sin ordenar. Una fecha que ya está en la lista se
    omite; dos entradas son la misma cuando su texto coincide sin los espacios de los extremos, así
    que `[[2026-11-18]]` y `2026-11-18` son distintas.
  - Añadir en una propiedad de texto con un solo valor agrega las fechas nuevas al texto, separadas
    por ", ", y omite la fecha que el texto ya tiene.
  - Añadir en una propiedad vacía o que no existe escribe lo mismo que Sustituir.
  - Una propiedad de fecha o de fecha y hora solo guarda un valor, así que siempre se sustituye.
- **Qué pide**: **Una fecha** admite una frase de una nota y muestra en su cuadro la pregunta «¿Qué
  fecha para {name}?» como texto de ayuda; en una propiedad muestra además, encima de los
  resultados, "La fecha se añadirá a la propiedad «{name}»." o "La fecha sustituirá el valor de la
  propiedad «{name}».", que no desaparece al escribir. **Fechas** abre el cuadro de fechas, «¿Qué
  fechas para {name}?», para cualquier rango, secuencia o lista, y escribe todas las fechas. El cuadro
  de fechas muestra el resultado mientras escribes, con el número de fechas y la primera y la última
  (`4 dates · Mon 23 Nov – Mon 14 Dec` con la interfaz en inglés para `every mon for 4 weeks`), o dice
  por qué el texto no es una fecha, o sugiere cómo seguir escribiendo. Hecho o Intro escribe las
  fechas, y cancelar no cambia nada. En una propiedad dice "Las fechas se añadirán a la propiedad
  «{name}»." o "Las fechas sustituirán el valor de la propiedad «{name}»."; la frase dice sustituir
  en una propiedad de fecha o de fecha y hora. ⇧↵ en la lista de `@` abre este mismo cuadro.
- **Cada fecha como enlace**: activado escribe cada fecha como un enlace. Desactivado escribe texto.
  En una propiedad es el formato del tipo de propiedad: `YYYY-MM-DD` para fecha,
  `YYYY-MM-DDTHH:mm` para fecha y hora, y el nombre de la nota en los demás tipos. En el cuerpo de
  la nota es el nombre de la nota, o el texto del enlace cuando lo pides.
- **Periodos de destino**: los periodos que acepta el comando, que se editan como en una mención. Las
  frases fuera de ellos se trasladan a un destino, como se describe en
  [Frases fuera de los destinos](#frases-fuera-de-los-destinos).
- **Texto alrededor de cada enlace** y **Entre varios enlaces**: solo con **En el cursor**, y valen
  solo en el cuerpo de la nota; una propiedad recibe solo el enlace. Una sola fecha es siempre un
  enlace sin más, nunca una viñeta.
- **Ruta en cada enlace**, **Qué dice el texto del enlace** y **Formato de fecha del texto del
  enlace**: consulta [Ajustes de enlace](#ajustes-de-enlace).

Con Sustituir o con la propiedad vacía, una frase que da una sola fecha escribe un valor, no una lista, salvo que la propiedad sea una lista
o ya contenga una, que sigue siendo lista. En una propiedad el enlace es siempre un wikilink, porque las propiedades
de Obsidian no tratan los enlaces Markdown como enlaces.

El texto del enlace se escribe cuando pulsas ⌥↵ en el selector o en la lista de `@`, o activas el
interruptor **Con texto en el enlace** del cuadro de fechas. En el móvil usa el interruptor. El texto
sin enlace, con **Cada fecha como enlace** desactivado, nunca lleva texto de enlace en una propiedad.

### Ajustes de enlace

Las menciones y los comandos comparten estos ajustes:

- **Ruta en cada enlace**: **La más corta si es seguro** (por defecto) escribe solo el nombre de la
  nota, como `[[2020-12-31]]`, cuando ese nombre solo puede abrir esta nota y al pulsarlo una
  nota que falta se crearía en su carpeta de notas de fecha; si no, sigue el formato de enlaces
  nuevos de Obsidian, así que una nota que falta en otro sitio recibe `[[Daily/2020-12-31]]`.
  **Siempre el nombre de la nota** y **Siempre la ruta completa** se saltan las comprobaciones.
  La elección también vale para los enlaces escritos en propiedades.
- **Texto alrededor de cada enlace**: lo que se escribe por cada fecha en el cuerpo de la nota; por
  defecto `{{link}}`. `{{link}}` es el enlace, con su ruta y su texto, así que añade palabras a su
  alrededor, como `Revisar {{link}}`. `{{name}}`, `{{path}}`, `{{alias}}` y `{{date:FORMATO}}`
  escriben texto sin enlace. Una plantilla vacía se rechaza.
- **Entre varios enlaces**: **Coma y espacio** (por defecto), **Espacio**, **Una viñeta por línea**
  o **Un enlace por línea**, para un rango o una secuencia insertados en el cuerpo de la nota.
- **Qué dice el texto del enlace**: **La frase escrita** o **Un formato de fecha** (por defecto).
  Con la frase escrita, varias fechas no llevan texto en el enlace. Solo se escribe cuando lo pides
  con ⌥↵ o con el interruptor **Con texto en el enlace**; ningún ajuste lo activa por defecto.
- **Formato de fecha del texto del enlace**: solo aparece con **Un formato de fecha**; por
  defecto `ddd D MMM`. Debajo, «Hoy: mar. 17 nov.» muestra el día de hoy en el formato mientras
  escribes.

## Calendario

Un calendario mensual para la barra lateral, construido sobre las mismas notas de fecha que todo
lo demás: cada día, número de semana, mes, trimestre y año apunta a la nota que Date Compass
abriría para él.

**Cómo abrirlo.** Ejecuta el comando **Abrir calendario** o haz clic en el icono de calendario de
la barra de herramientas; el calendario aparece en la barra lateral derecha, y si ya estaba abierto
pasa al frente. Nunca se abre solo. En un teléfono o una tableta, el mismo comando y el mismo
icono lo abren en el panel derecho. **Mostrar la nota activa en el calendario** abre el calendario
en el mes de la nota de fecha en la que estás, sea del periodo que sea; una nota semanal,
trimestral o anual muestra el mes en el que cae su primer día.

**Clics.**

- Haz clic en un día para abrir su nota diaria. Una nota que aún no existe se crea, tras una
  confirmación salvo que la desactives.
- Cmd-clic en macOS, o Ctrl-clic en el resto, hace lo mismo en una división nueva.
- Mantén pulsado Cmd o Ctrl y pasa el cursor sobre un día que tiene nota para previsualizarla.
  Los ajustes del plugin del núcleo de vista previa de páginas tienen un interruptor
  **Calendario** que quita la necesidad de la tecla.
- Haz clic derecho en un día que tiene nota para ver **Eliminar** y el menú habitual de archivo.

**Cabecera.** El título muestra el mes, el trimestre (`Q4`, solo cuando las notas trimestrales
están activadas) y el año. Cada parte abre su propia nota con los mismos clics que un día, cuando
su periodo está activado; una parte cuyo periodo está desactivado es texto normal. Las flechas
mueven un mes, y **Hoy** vuelve al mes actual; en un teléfono o tableta **Hoy** es un punto entre
las flechas. A medianoche, un calendario que muestra el mes actual avanza solo.

**Columna de semanas.** Con **Mostrar números de semana** activado, la primera columna muestra el
número de cada semana. El número abre la nota semanal cuando las notas semanales están activadas,
y es texto normal cuando están desactivadas. El primer
día de la semana y los números de semana siguen **La semana empieza el** de Localización. Cuando
ese ajuste y el formato de nombre de las notas semanales numeran las semanas de forma distinta,
por ejemplo semanas que empiezan en domingo con el formato ISO `GGGG-[W]WW`, una semana puede
mostrar un número en el calendario y otro en su nota; la página Notas de fecha lo avisa
y no cambia ninguno de los dos ajustes.

**Puntos.** Cada entrada de la lista **Puntos** en Ajustes → **Calendario** añade puntos a los
días y semanas, en el orden de la lista. Una entrada tiene una fuente y un aspecto:

- **Fuente**: **Palabras** cuenta las palabras de la nota, **Tareas pendientes** sus tareas sin
  terminar y **Notas que enlazan** las notas que enlazan a ella, desde el texto o desde una
  propiedad.
- **Puntos**: un punto en cuanto hay algo, o un punto por cantidad, como uno cada 250 palabras,
  hasta un límite de uno a cinco. Los puntos de palabras muestran siempre al menos uno en un día o
  semana con nota.
- **Mostrar en**: días, semanas o ambos.
- **Forma**, **Color** y **Posición**: un punto relleno o un anillo hueco, en el color del tema,
  el de acento o uno de los colores del tema, debajo o encima del número o en una esquina
  superior. En el día resaltado de la nota abierta todos los puntos toman el color del texto
  resaltado.
- **Mostrar en días sin nota**, solo para notas que enlazan: una nota de reunión que enlaza al
  martes que viene marca el martes antes de que exista su nota.
- **Solo notas que cumplen todos los filtros**, solo para notas que enlazan: la ruta o el nombre
  empieza por un texto, la nota tiene una etiqueta o una anidada bajo ella, o tiene una propiedad,
  con un valor opcional escrito como `clave: valor`.

Por defecto la lista mantiene el aspecto anterior: un punto relleno cada 250 palabras, como mínimo
uno y como máximo cinco, y después un punto hueco cuando la nota tiene una tarea sin terminar. Un
valor de **Palabras por punto** guardado por una versión anterior pasa a ser la cantidad de los
puntos de palabras, y 0 deja solo los puntos de tareas.

Ajustes → **Calendario**:

- **Mostrar números de semana**: añade la columna de semanas. Activado por defecto.
- **Confirmar antes de crear una nota**: pregunta antes de crear una nota que aún no existe.
  Activado por defecto.
- **Compatibilidad con estilos de tema para Calendar**: da al calendario el id
  `calendar-container` que usa el plugin Calendar de Liam Cain, para que los temas y fragmentos
  CSS escritos para ese plugin, como el tema Minimal, también den estilo a este calendario.
  Desactivado por defecto. Déjalo desactivado mientras el plugin Calendar también esté abierto:
  dos elementos compartirían ese id y el tema daría estilo a ambos. La página avisa cuando el
  ajuste está activado y el plugin Calendar está habilitado.
- **Puntos**: la lista de puntos descrita arriba, con + para añadir una entrada según su fuente.

Una nota solo se encuentra en la ruta que le dan su carpeta y su formato de nombre. El aspecto
sigue el del plugin [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) de Liam Cain
(MIT).

## API pública para Templater

Otros plugins y los scripts de Templater llegan a Date Compass con
`app.plugins.plugins["date-compass"].api`. Tiene ocho funciones, y cada una lee tus ajustes
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
que `openNote` y `ensureNote` lo rechacen. Las expresiones de un periodo desactivado en Notas de fecha no dan
resultado, igual que en las menciones. Una semana es la que nombra el formato: semanas ISO con el
`GGGG-[W]WW` por defecto, así que con semanas que empiezan en domingo pasa el `date` de una nota y no
su `start`. Los tipos de TypeScript `DateCompassApi`,
`DateCompassInterpretation`, `DateCompassNote` y `DateCompassPeriod` se exportan desde `src/api/index.ts`.

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

**`ensureNote(date, period)`** crea esa nota con su plantilla si no existe, sin abrirla, y devuelve
su ruta. Devuelve `undefined` cuando Templater no pudo crearla.

```js
<%* const path = await dc.ensureNote(tp.date.now("YYYY-MM-DD", 1), "day"); if (path) tR += `[[${path.replace(/\.md$/, "")}]]`; %>
```

**`periods()`** devuelve el interruptor `enabled`, la `folder` y el `format` de cada periodo, como una
copia congelada. La ruta de una nota es su carpeta más la fecha escrita en su formato, así que otro
plugin puede calcular las rutas igual que Date Compass.

```js
<%* const { week } = dc.periods(); if (week.enabled) tR += `${week.folder ? `${week.folder}/` : ""}${moment().format(week.format)}.md`; %>
```

## Organización de los ajustes

En la página principal, haz clic en una fila para abrir su página: **Localización**, **Notas de
fecha**, **Calendario**, **Menciones** y **Comandos**. Al final está **Restablecer todos los
ajustes**, que devuelve cada opción a los valores predeterminados tras confirmarlo.

La página **Localización** tiene:

- **Idiomas admitidos**: una lista con una fila por idioma, por orden de prioridad. Cada fila
  tiene un botón para quitarla y el botón **+** añade al final un idioma que aún no está en la
  lista. El último idioma no se puede quitar, y + lo avisa cuando ya están todos. Cuando una palabra significa cosas distintas, como "mar",
  la primera fila es la del primer idioma. Arrastra una fila para cambiar el
  orden.
- **La semana empieza el**: **Según la configuración regional** (por defecto), **Lunes** o
  **Domingo**.
- **"Próximo" día de la semana significa**: **Ese día de la semana que viene** (por defecto) o **La
  próxima vez que llegue ese día**.
- **Leer fechas escritas como**: **Día/Mes** (por defecto) o **Mes/Día**, para `3/12`. Debajo,
  «Hoy: 17/11» muestra el día de hoy en el orden elegido.

No hay nada oculto: todo comportamiento que elige u oculta algo es uno de estos ajustes.

## Todavía no

- Horas del día.
- Idiomas distintos del inglés y el español.
