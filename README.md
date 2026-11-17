# Date Compass

Date Compass is an Obsidian plugin that understands dates typed in plain English or Spanish and turns
them into links to your date notes. Type `@last wed` and get `[[2026-11-11]]`; type `every mon for 4
weeks` and get four links; run a command that writes `dates`, `start` and `end` into a note's
properties. It also owns your daily, weekly, monthly, quarterly and yearly note settings, so every
feature agrees on which note is "2026-W48".

Leer en español: [README.es.md](README.es.md).

The examples below assume today is **Tuesday 17 November 2026** and weeks start on Monday.

- [Date phrases](#date-phrases)
- [Date notes and templates](#date-notes-and-templates)
- [Mentions while typing](#mentions-while-typing)
- [Insert date sequence](#insert-date-sequence)
- [Date actions](#date-actions)
- [Public API for Templater](#public-api-for-templater)
- [Settings layout](#settings-layout)
- [Not in v1](#not-in-v1)
- [For Carles: hand checks and open decisions](#for-carles-hand-checks-and-open-decisions)

## Date phrases

Every feature reads dates through the same parser. It understands the phrases below in each
language turned on under **Languages**, ignores case and accents (`miercoles` = `miércoles`), and
splits words from digits (`3daysago` = `3 days ago`). While you type, the last word also completes:
`next we` offers "next Wed" and "next week".

When a word means different things in two enabled languages, you get every meaning and choose:
`mar` is March in English and Tuesday (`martes`) in Spanish. Date Compass never guesses.

### English

| You type | You get |
| --- | --- |
| `today`, `tomorrow` or `tmr`, `yesterday` or `yest` | 17 Nov, 18 Nov, 16 Nov |
| `wed` | the next Wednesday after today: 18 Nov |
| `this wed` | the Wednesday of this week: 18 Nov (may be in the past) |
| `next wed` | the Wednesday of next week: 25 Nov (see **"Next" weekday means**) |
| `last wed` | the most recent past Wednesday: 11 Nov |
| `3daysago`, `3d ago`, `-3d` | 14 Nov |
| `in a week`, `+1w`, `1 week`, `in 2 weeks` | 24 Nov, 24 Nov, 24 Nov, 1 Dec |
| `in 40 days`, `40d` | 27 Dec |
| `dec 3`, `3 dec`, `december 3rd`, `2026-12-03` | 3 Dec; a date without a year is in the current year |
| `3/12` | 3 Dec (see **Numeric dates**) |
| `this week`, `next week`, `last week`, `W50`, `2026-W48` | week notes 2026-W47, W48, W46, W50, W48 |
| `week of dec 3` | the week note that contains 3 Dec: 2026-W49 |
| `this month`, `last month`, `march` | month notes 2026-11, 2026-10, 2026-03 |
| `next quarter`, `Q1`, `2026-Q1` | quarter notes 2027-Q1, 2026-Q1, 2026-Q1 |
| `next year`, `2027` | the year note 2027 |

Units can be written `d day days`, `w wk week weeks`, `m mo month months`, `q quarter quarters`,
`y yr year years`. "In 2 weeks" is a day, not a week note.

Ranges and sequences give several dates at once:

| You type | You get |
| --- | --- |
| `today to fri`, `from today to fri`, `today - fri`, `today..fri`, `today until fri` | 17, 18, 19, 20 Nov |
| `mon to fri` | 23 to 27 Nov |
| `fri to mon` | 20 to 23 Nov: an end weekday comes after the start |
| `next 5 days`, `last 3 days` | five days starting today; three days ending today |
| `next 3 weeks` | three week notes starting with this week |
| `every mon for 4 weeks` | 23 Nov, 30 Nov, 7 Dec, 14 Dec |
| `every mon, wed for 4 weeks` | those weekdays over the next 4 weeks, starting today |
| `every 2 days x5`, `every 2 weeks 5 times` | five dates starting today, a step apart |
| `W48 to W50`, `weeks of december` | the week notes W48 to W50; the five weeks that touch December |

A range or sequence longer than 366 dates is refused with a message.

### Spanish

Turn on **Spanish** under **Languages** to use these.

| You type | You get |
| --- | --- |
| `hoy`, `mañana`, `ayer`, `pasado mañana`, `anteayer` | 17, 18, 16, 19 and 15 Nov |
| `este miércoles` | the Wednesday of this week: 18 Nov |
| `el próximo miércoles`, `miércoles que viene` | the Wednesday of next week: 25 Nov |
| `el miércoles pasado` | 11 Nov |
| `hace 3 días` | 14 Nov |
| `en 3 días`, `dentro de una semana` | 20 Nov, 24 Nov |
| `3 de diciembre` | 3 Dec |
| `esta semana`, `la semana que viene` | week notes 2026-W47, 2026-W48 |
| `el mes pasado` | the month note 2026-10 |
| `el próximo trimestre`, `el año que viene` | the quarter note 2027-Q1, the year note 2027 |
| `de hoy a viernes` | 17 to 20 Nov |
| `del lunes al viernes` | 23 to 27 Nov |
| `los próximos 5 días` | five days starting today |
| `cada lunes y miércoles durante 4 semanas` | Mondays and Wednesdays over the next 4 weeks |
| `cada 2 días 5 veces` | five dates starting today, two days apart |

## Date notes and templates

Date Compass replaces the Periodic Notes plugin. Settings → Date Compass → **Date notes** has one
group per period: **Daily notes**, **Weekly notes**, **Monthly notes**, **Quarterly notes** and
**Yearly notes**. Each has:

- **Enabled**: notes of this period can be opened, created and linked. Quarterly notes start off.
- **Folder**: where the notes live; empty means the vault root.
- **Name format**: a moment.js format such as `YYYY-MM-DD`. Slashes make subfolders. The defaults
  are `YYYY-MM-DD`, `GGGG-[W]WW`, `YYYY-MM`, `YYYY-[Q]Q` and `YYYY`.
- **Template**: the note whose content fills a new note of this period. Empty creates new notes
  empty, which leaves any Templater folder or regex rule in charge.

**Apply templates with** picks who fills in the template: **Automatic** (Templater when it is
enabled, otherwise core Templates, otherwise Date Compass itself), **Templater**, or **Core
Templates**. Date Compass's own filling replaces `{{title}}`, `{{date}}`, `{{time}}`,
`{{date:FORMAT}}` and `{{time:FORMAT}}`, where `{{date}}` is the note's own date rather than today.
A template is applied once, even when Templater's own "trigger on new file creation" rules also
match the new note.

**Coming from Periodic Notes.** On first load Date Compass copies the folders, formats and
templates from Periodic Notes, or the daily note settings from core Daily notes when Periodic
Notes is not installed. After that it owns them. When Periodic Notes or Daily notes later hold
different folders or formats, the Date notes page shows a notice, because Calendar and other
plugins read those settings. Its **Copy them in** button copies their values into Date Compass.
Date Compass never changes another plugin's settings.

Commands:

- **Open today's note**, **Open this week's note**, **Open this month's note**, **Open this
  quarter's note**, **Open this year's note**: one per enabled period. A note that does not exist
  yet is created.
- **Open next note of the same period** and **Open previous note of the same period**: from the
  date note you are in, jump to the nearest existing note before or after it.
- **Open a date note by phrase**: type `next month` or `last wed`, see the note it means, press
  Enter to open it, creating it if needed.

## Mentions while typing

Type the trigger, `@` by default, and a phrase. A suggestion list shows what each reading
resolves to before you accept it, such as `Wed 11 Nov → [[2026-11-11]]`. The phrase may contain
spaces: `@last wed`, `@today to fri`. A range shows one row, such as `Tue 17 → Fri 20 Nov · 4 dates`,
that inserts all four links. Rows come in this order: the best reading, other readings (other
languages, ambiguous words), then completions of what you are typing.

Links follow your vault's link settings (wikilinks or Markdown, path style), and a link to a note
that does not exist yet is still inserted; the note is not created. Suggestions never open inside
code blocks, inline code or frontmatter. Escape closes the list and it stays closed for that
mention.

Settings → **Mentions**:

- **Mentions**: turn suggestions on or off. On by default.
- **Trigger**: the characters that start a mention.
- **Periods that can be mentioned**: one toggle per period. A period turned off in Date notes is
  never offered.
- **Link text**: **The note name**, **The typed phrase**, or **A date format**; with the last one,
  **Link text format** sets it, such as `ddd D MMM`.
- **Between range links**: **Comma and space**, **Space**, or **One bullet per line**.

The page warns when another enabled plugin (Natural Language Dates, its revived fork, Date List or
Note Compass mentions) uses the same trigger, because both lists would compete.

## Insert date sequence

The command **Insert date sequence** opens a box with one input. As you type it previews the
result, such as `4 dates · Mon 23 Nov – Mon 14 Dec` for `every mon for 4 weeks`, or says why the
text is not a date, or hints how to keep typing. Enter inserts the links at the cursor.

Settings → **Insert sequence**:

- **Layout**: **Inline, with the Mentions separator between range links** (default), **Bullet
  list**, or **One per line**.
- **Item template**: the text inserted for each date, where `{{link}}` is its link, such as
  `Review {{link}}`. A template without `{{link}}` is refused.

## Date actions

An action is a command that asks you questions and writes the dates you answer into the current
note's properties or at the cursor. Each enabled action appears in the command palette as
"Date Compass: *name*".

### The two presets

Both are added on first install and can be removed.

- **Add dates** asks **Dates** (for example `today to fri`) and then **Update start and end?**
  (yes or no). It adds the links to the `dates` property, and when you answer yes, it sets `start`
  to the first date and `end` to the last, as plain date text. A single existing `dates` value
  becomes a list first.
- **Set reminders** asks **Reminders** (for example `every mon, wed for 4 weeks`) and adds the links
  to the `reminders` property.

### Building an action

Settings → **Actions** lists every action. Drag a row to reorder, use its checkbox to turn the
command on or off, and click it to edit. **Add action** creates one. An action page has:

- **Enabled** and **Name**: the command name in the palette.
- **Questions**, added with **Add question**. Each question has:
  - **Key**: the name writes use for its answer.
  - **Question**: what the command asks; empty asks with the key.
  - **Field type**: **One date**, **Dates: a range, sequence or list**, **A periodic note**, or
    **Yes or no**.
  - **How the answer is used**: which writes use it.
  - **Can be skipped**: whether it may be left unanswered; writes that use a skipped answer write
    nothing.
  - **Typed in advance**: text already in the box when the question opens, such as `today`. For a
    yes-or-no question, `no` offers No first.
- **Writes**, added with **Add write**. Each write has:
  - **Write the answer into**: **A property** (then **Property** names it) or **The note at the
    cursor**, laid out as in Insert sequence.
  - **Answer from**: the question whose dates are written.
  - **Which dates of the answer**: **All of them**, **The first** or **The last**.
  - **Write each date as**: **A link** or **Date text** in the period's name format.
  - **Values already in the property**: **Keep them and add the dates after them**, **Keep them,
    add the dates, remove duplicates and sort by date** (default), or **Replace them with the
    dates**.
  - **Only write when**: **Always**, or when a yes-or-no question is answered yes.

Links written into properties are always wikilinks, because Obsidian properties do not treat
Markdown links as links.

## Public API for Templater

Other plugins and Templater scripts reach Date Compass through
`app.plugins.plugins["date-compass"].api`. It has six functions, and each reads your current
settings: languages, week start, numeric date order, and the folders and formats of Date notes.

Results are plain objects, so scripts need no extra library. A **note** has:

| Field | Meaning | Example |
| --- | --- | --- |
| `period` | `day`, `week`, `month`, `quarter` or `year` | `week` |
| `start` | the first day of the period, `YYYY-MM-DD` | `2026-11-16` |
| `date` | the date that names the note; `notePath(date, period)` gives `path` back | `2026-11-19` |
| `name` | the note name, from the period's name format | `2026-W47` |
| `path` | the vault path, from the period's folder and name format | `journal/2026-W47.md` |

A **reading** has `language` (`en` or `es`) and `notes`: one note for a date or a period, several
for a range or sequence.

`now` is optional everywhere and defaults to the current time; pass a `Date` or a moment. A `date`
argument takes a `Date`, a moment or a `YYYY-MM-DD` string; anything else, or an unknown period,
throws. Phrases for a period turned off in Date notes give no result, as in mentions. The
TypeScript types `DateCompassApi`, `DateCompassInterpretation` and `DateCompassNote` are exported
from `src/api/index.ts`.

Start each script with:

```js
const dc = app.plugins.plugins["date-compass"].api;
```

**`parse(text, now?)`** returns every reading of the text, one per meaning, in the order of your
languages; an empty list when nothing matches.

```js
<%* for (const reading of dc.parse("mar")) tR += `${reading.language}: [[${reading.notes[0].name}]]\n`; %>
```

**`resolve(text, now?)`** returns the best reading, or `undefined`. This is the replacement for
`nldates.parseDate(...)`.

```js
<%* const when = dc.resolve(await tp.system.prompt("When?")); tR += when ? `[[${when.notes[0].name}]]` : ""; %>
```

**`sequence(text, now?)`** returns the notes of a range or sequence in order, or one note for a
single date, or an empty list.

```js
<%* tR += dc.sequence("every mon for 4 weeks").map((note) => `- [ ] Review [[${note.name}]]`).join("\n"); %>
```

**`notePath(date, period)`** returns where the note of that period lives, whether or not it exists.

```js
<%* tR += `[[${dc.notePath(tp.date.now("YYYY-MM-DD"), "week").replace(/\.md$/, "")}|This week]]`; %>
```

**`dateOf(path)`** reads a path back as a date note, or returns `undefined` when it is not one.

```js
<%* const note = dc.dateOf(tp.file.path(true)); if (note) tR += `${note.period} starting ${note.start}`; %>
```

**`openNote(date, period)`** opens that note, creating it from its template when it does not exist.

```js
<%* await dc.openNote(tp.date.now("YYYY-MM-DD", 1), "day"); %>
```

## Settings layout

The main page is short:

- **Languages**: a toggle for **English** and **Spanish**. At first both your interface language
  and English are on.
- **Week starts on**: **Locale default**, **Monday** or **Sunday**.
- **"Next" weekday means**: **That day of next week** (default) or **The next time that day
  comes**.
- **Numeric dates**: **Day, then month** (default) or **Month, then day**, for `3/12`.
- **Date notes**, **Mentions**, **Insert sequence** and **Actions**: click a row to open its page.
- **Reset all settings**: puts every option back to the defaults after you confirm.

Nothing is hidden: every behaviour that picks or hides something is a setting above.

## Not in v1

- A calendar view; it is planned for a later version.
- Times of day.
- Languages other than English and Spanish.
- Publishing to the community plugin list, a GitHub repository, tags or releases.

## For Carles: hand checks and open decisions

- [docs/hand-checks.md](docs/hand-checks.md): what to check by hand in `~/Obsidian/plugin tester`.
- [docs/decisions.md](docs/decisions.md): the decisions taken without you, to confirm or reverse.
