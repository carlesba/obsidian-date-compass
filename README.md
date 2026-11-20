# Date Compass

Date Compass is an Obsidian plugin that understands dates typed in plain English or Spanish and turns
them into links to your date notes. Type `@last wed` and get `[[2026-11-11]]`; type `every mon for 4
weeks` and get four links; run a command that sets a property such as `dates` on the current note.
It also owns your daily, weekly, monthly, quarterly and yearly note settings, so every
feature agrees on which note is "2026-W48".

Leer en español: [README.es.md](README.es.md).

The examples below assume today is **Tuesday 17 November 2026** and weeks start on Monday.

- [Date phrases](#date-phrases)
- [Date notes and templates](#date-notes-and-templates)
- [Mentions while typing](#mentions-while-typing)
- [Commands](#commands)
- [Calendar](#calendar)
- [Public API for Templater](#public-api-for-templater)
- [Settings layout](#settings-layout)
- [Not yet](#not-yet)

## Date phrases

Every feature reads dates through the same parser. It understands the phrases below in each
language listed under **Supported languages**, ignores case and accents (`miercoles` = `miércoles`), and
splits words from digits (`3daysago` = `3 days ago`). While you type, the last word also completes:
`next we` offers "next Wed" and "next week".

When a word means different things in two listed languages, you get every meaning and choose,
with the first language of the list on top: `mar` is March in English and Tuesday (`martes`) in
Spanish. Date Compass never guesses.

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
| `3/12` | 3 Dec (see **Read typed dates like**) |
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
| `every 2 days x5`, `every 2 weeks 5 times`, `every 2 days for 10 times` | that many dates a step apart, the first one step after today: `every 2 days x5` starts on 19 Nov |
| `every week 3 times`, `every day for 5 days` | 24 Nov, 1 Dec, 8 Dec; 18 to 22 Nov, so `every day` starts tomorrow |
| `every wed until dec 20` | every Wednesday from today to 20 Dec, the end date included when it matches |
| `every other day for 6 days` | every second day for 6 days, the first in two days: 19, 21, 23 Nov |
| `every other wed for 3 months` | alternate Wednesdays over the next 3 months |
| `wed for 5 weeks` | a Wednesday a week for the next 5 weeks, like `every wed for 5 weeks` |
| `every week 3 times starting next week`, `every week from next week 3 times` | 23 Nov, 30 Nov, 7 Dec: the first date is the start of `next week` |
| `every wed 3 times starting next week` | the first Wednesday on or after that start: 25 Nov, 2 Dec, 9 Dec |
| `every day from dec 3 until dec 7` | 3 to 7 Dec |
| `W48 to W50`, `weeks of december` | the week notes W48 to W50; the five weeks that touch December |

A sequence that names a step (`every day`, `every 2 weeks`, `every month`) starts one step after
today, while one that names weekdays (`every wed`) starts today. Add `starting` or `from` and a date
or period, before or after `for`, `times` or `until`, to start somewhere else; `for` then counts
from that start. `until` takes a date without a year as the next time it comes: when `dec 20` is already past this
year, it means 20 Dec next year. `every other wed` counts alternate weeks from the start of the
current week, as set by **Week starts on**, so a weekday that has already passed this week first
appears the week after next. While you type a sequence, the `@` list shows rows with the dates each way of going on would give,
such as `@every` or `@every wed for 5`, and equal results share one row. Once the sequence is complete, as in
`@every week 3 times`, the list also offers it `starting tomorrow`, `starting next week` and `starting next month`. The dates box says "Keep
typing, as in every wed for 5 times." under the box.

A range or sequence longer than 366 dates is refused with a message, and the API returns nothing
for it.

### Spanish

Add **Spanish** under **Supported languages** to use these.

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
| `cada 2 días 5 veces`, `cada 2 días durante 10 veces` | that many dates two days apart, the first in two days |
| `cada miércoles hasta el 20 de diciembre` | every Wednesday from today to 20 Dec |
| `cada otro día durante 6 días` | every second day for 6 days, the first in two days |
| `cada otro miércoles durante 3 meses` | alternate Wednesdays over the next 3 months |
| `miércoles durante 5 semanas` | a Wednesday a week for the next 5 weeks |
| `cada semana 3 veces empezando la semana que viene`, `cada semana 3 veces a partir del lunes` | 23 Nov, 30 Nov, 7 Dec |
| `cada día durante 5 días desde el 3 de diciembre` | 3 to 7 Dec |

## Date notes and templates

Date Compass replaces the Periodic Notes plugin. Settings → Date Compass → **Date notes** has one
group per period: **Daily notes**, **Weekly notes**, **Monthly notes**, **Quarterly notes** and
**Yearly notes**. Each has:

- **Enabled**: notes of this period can be opened, created and linked. Only daily notes start on;
  turn on the other periods you use.
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
- **Open tomorrow's note**, **Open next week's note**, **Open next month's note**, **Open next
  quarter's note**, **Open next year's note**: the same, one period ahead.
- **Open next note of the same period** and **Open previous note of the same period**: from the
  date note you are in, jump to the nearest existing note before or after it.
- **Open a date note by phrase**: type `next month` or `last wed`, see the note it means, press
  Enter to open it, creating it if needed.

## Mentions while typing

Type a trigger, `@` by default, and a phrase. A suggestion list shows what each reading
resolves to before you accept it, such as `Wed 11 Nov → [[2026-11-11]]`. The phrase may contain
spaces: `@last wed`, `@today to fri`. A range shows one row, such as `Tue 17 → Fri 20 Nov · 4 dates`,
that inserts all four links. Rows come in this order: the best reading, other readings (other
languages, ambiguous words), then completions of what you are typing.

Links follow your vault's link settings (wikilinks or Markdown, path style), and a link to a note
that does not exist yet is still inserted; the note is not created. Suggestions never open inside
code blocks or inline code. Escape closes the list and it stays closed for that mention.

Settings → **Mentions** is a list with one row per mention, named by its trigger and showing its
target periods. A row has a pencil that opens the mention, a handle to drag it into a new order and
a ✕ that deletes it; **+** adds a mention with a trigger that is not in use yet and opens its page.
There is no switch to turn mentions off: delete every mention instead. A new install has one
mention, `@`, that targets every period enabled in Date notes.

Each mention has its own:

- **Trigger**: the characters that start the mention.
- **Target periods**: the periods the mention links to, as a list. Each row has a ✕, and **+** opens a
  picker of the periods that are not listed yet. A mention needs at least one target. A target that is
  turned off in Date notes stays in the list, marked as such, and is left out until you turn it on
  there.
- **Text around each link**, **Path in each link**, **Between several links**, **What the link text
  says** and **Date format of the link text**: how its links are written, as described under
  [Link settings](#link-settings) below.

Several mentions can share a vault, each with its own look. For example, keep `@` for day notes only
and add `#` for month notes only: `@fri` then links the day, and `#nov` links the month note
2026-11. The `#` trigger clashes with Obsidian's tags, so the settings warn about it; see
[Trigger clashes](#trigger-clashes).

Keys in the list: Enter inserts the selected row as a plain link, and ⌥↵ inserts it with link
text. ⇧↵ opens the dates box, described under [Commands](#commands), with the typed phrase and that
mention's settings. The last row, **More…**, does what ⇧↵ does, so on a phone tap **More…**; in
the dates box, the **With link text** switch is the tap for ⌥↵.

### Mentions in properties

In source mode, a mention opens on a frontmatter line that belongs to a property, such as
`dates: @next fri`. Choosing a row adds a plain link to that property, written with the mention's
**Path in each link**. The link text is written only with ⌥↵, and **Text around each link** is not
applied, so the property gets the link alone. A link already in the property is not added twice.
Mentions stay closed on frontmatter lines that are not a property, and they cannot open in the
fields of the Properties view.

### Phrases outside the targets

A phrase can mean a period the mention does not target. Date Compass then moves it to a target
instead of dropping it. When a target is coarser than the phrase, the finest such target that
contains the date is used. When every target is finer, the coarsest target is used and today moves by
the same amount as the phrase: a month ahead of the month that holds today is today plus one month,
and a month that is shorter ends on its last day. The examples assume today is Friday 13 February
2026 and **Target periods** lists only the periods shown:

| Target periods | You type | You get |
| --- | --- | --- |
| day | `next month` | the day note for 13 Mar |
| day | `next week` | the day note for 20 Feb |
| month | `tomorrow` | the month note 2026-02 |
| day | `next month`, with today 31 Jan | the day note for 28 Feb |
| day and year | `next month` | the year note 2026 |

Sequences are moved one date at a time, and dates that end up on the same note are inserted once.
Open a date note by phrase and the API do not use targets, so they read phrases as written.

### Trigger clashes

Two things can open at the same characters, and only one wins. The mention page and its row in the
list warn when a trigger:

- is the same as the trigger of another mention;
- is the start of another mention's trigger, or the other way round, so the longer one wins where both
  match;
- is the same as one of Obsidian's own suggesters or the start of one: `[[` for links, `#` for tags,
  `[^` for footnotes, `==` for highlight colors, and `/` for slash commands when the Slash commands
  core plugin is on;
- is also used by another enabled plugin that Date Compass knows: Natural Language Dates, its revived
  fork, Date List or Note Compass mentions.

When you save a clashing trigger a notice repeats the warning. The trigger is still saved. Date
Compass cannot detect other plugins, or Markdown characters such as `$`, `%%`, `>`, `-`, `*`, a
backtick or brackets that pair up, so check those yourself.

## Commands

A command asks for a date or dates and writes them to the current note. Every command appears in the
command palette as "Date Compass: *name*". Settings → **Commands** lists them. Each row has a pencil
that edits it, a handle to drag it into a new order and a ✕ that deletes it, and **+** adds a blank
command and opens its page. A command that writes to a property is not offered until it has a
property.

### The preset

**Insert dates** is added on first install and can be removed. It asks for **Dates** and writes
links at the cursor. It is the standalone Insert dates command, now a preset. Commands that write to
a property, such as one that adds to `dates` or `reminders`, are yours to add.

### Building a command

A command page has:

- **Name**: the name of the command in the palette.
- **Where it writes**: **A property** or **At the cursor**.
  - **A property** always writes to one property of the current note, set by **Property to set**
    below. **At the cursor** needs an editor open. With the cursor in the note body it inserts there;
    with the cursor on a property line in source mode, or a property field focused in the Properties
    view, it adds to that property and skips the template. On a frontmatter line that is not a
    property it shows "Put the cursor on a property to add dates to it." and writes nothing.
- **Property to set** and **When the property already has a value**: only for **A property**.
  **Add**, the default, keeps what is there. **Replace** overwrites it.
  - Add on a list property, or on a property that already holds a list, keeps the items and writes
    the new dates after them, unsorted. A date already in the list is skipped; two entries are the
    same when their text is equal after trimming, so `[[2026-11-18]]` and `2026-11-18` are
    different.
  - Add on a text property that holds one value appends the new dates to the text, separated by
    ", ", and skips a date the text already has.
  - Add on an empty or missing property writes the same as Replace.
  - A date or date and time property holds one value, so it is always replaced.
- **What it asks for**: **One date** takes a phrase for one note and shows its question, "Which date
  for {name}?", as the box's placeholder; for a property it also shows "The date will be added to the
  property {name}." or "The date will replace the value of the property {name}." above the results,
  which stays while you type. **Dates** opens the dates box, "Which dates for {name}?", for any
  range, sequence or list, and writes every date. The dates box previews the result as you type, such as
  `4 dates · Mon 23 Nov – Mon 14 Dec` for `every mon for 4 weeks`, or says why the text is not a date,
  or hints how to keep typing. Done or Enter writes the dates, and cancelling changes nothing. For a property the box says "Dates will be
  added to the property {name}." or "Dates will replace the value of the property {name}."; the
  sentence says replace for a date or date and time property. Shift+Enter in the `@` list opens this
  same box.
- **Each date as link**: on writes each date as a link. Off writes plain text. In a property that is
  the format of the property type: `YYYY-MM-DD` for a date property, `YYYY-MM-DDTHH:mm` for date and
  time, and the note name for any other type. In the note body it is the note name, or the link text
  when you ask for it.
- **Target periods**: the periods the command accepts, edited as in a mention. Phrases outside them
  move to a target, as described under [Phrases outside the targets](#phrases-outside-the-targets).
- **Text around each link** and **Between several links**: only for **At the cursor**, and they apply
  in the note body only; a property gets the link alone. A single date is always a bare link, never
  a bullet.
- **Path in each link**, **What the link text says** and **Date format of the link text**: see
  [Link settings](#link-settings).

With Replace or an empty property, phrases that resolve to one date write one value, not a list, unless the property is a list or
already holds a list, which stays a list. A link is always a wikilink in a property, because Obsidian properties
do not treat Markdown links as links.

The link text is written when you press ⌥↵ in the picker or the `@` list, or turn on the **With link
text** switch in the dates box. On a phone use the switch. Plain text, with **Each date as link**
off, never gets one in a property.

### Link settings

Mentions and commands share these settings:

- **Path in each link**: **Shortest when safe** (default) writes only the note name, such as
  `[[2020-12-31]]`, when that name can only open this note and clicking it would create a missing
  note in its date notes folder; otherwise it follows Obsidian's new link format, so a missing
  note elsewhere gets `[[Daily/2020-12-31]]`. **Always the note name** and **Always the full path**
  skip the checks. The choice also applies to links written into properties.
- **Text around each link**: what is written for each date in the note body; default `{{link}}`.
  `{{link}}` is the link, with its path and link text, so add words around it, such as `Review
  {{link}}`. `{{name}}`, `{{path}}`, `{{alias}}` and `{{date:FORMAT}}` write plain text without a
  link. An empty template is refused.
- **Between several links**: **Comma and space** (default), **Space**, **One bullet per line** or
  **One link per line**, for a range or sequence inserted in the note body.
- **What the link text says**: **The typed phrase** or **A date format** (default). With the typed
  phrase, several dates get no link text. It is written only when you ask for it with ⌥↵ or the **With link text**
  switch; there is no setting that turns it on by default.
- **Date format of the link text**: shown only with **A date format**; default `ddd D MMM`. Below
  it, "Today: Tue 17 Nov" shows today in the format as you type.

### Ribbon buttons

Below the commands, **Ribbon buttons** lists the Date Compass commands that get their own button in
the ribbon; on a phone they are in the ribbon menu. It starts empty. **+** opens a list of the
commands that are not there yet: the commands that open date notes (today's, this week's,
tomorrow's, next week's and so on, for the periods that are enabled), **Open next note of the same
period**, **Open previous note of the same period**, **Open a date note by phrase** and your own
commands from the list above. Each row has a handle to drag it into a new order and a ✕ that
removes it. The buttons follow the order of the list and change as soon as you edit it.

A button shows the icon of its command and the command name as its tooltip; clicking it runs the
command. The same icons show in the mobile toolbar. Your own commands share one icon.

A row stays in the list when its command cannot run, and says why: the period is turned off in
Date notes, the command still needs a property, or the command was deleted. It has no button
until that is fixed. The calendar keeps its own ribbon icon and is not in this list.

## Calendar

A month calendar for the sidebar, built on the same date notes as everything else: each day, week
number, month, quarter and year points at the note Date Compass would open for it.

**Opening it.** Run the command **Open calendar** or click the calendar icon in the ribbon; the
calendar appears in the right sidebar, and a calendar that is already open is brought to the
front. It is never opened for you. On a phone or tablet the same command and ribbon icon open it
in the right drawer. **Reveal active note in calendar** opens the calendar on the month of the
date note you are in, whatever its period; a weekly, quarterly or yearly note shows the month its
first day falls in.

**Clicks.**

- Click a day to open its daily note. A note that does not exist yet is created, after a
  confirmation unless you turn that off.
- Cmd-click on macOS, or Ctrl-click elsewhere, does the same in a new split.
- Hold Cmd or Ctrl and hover over a day that has a note to preview it. The settings of the core
  Page preview plugin have a **Calendar** toggle that drops the need for the key.
- Right-click a day that has a note for **Delete** and the usual file menu.

**Header.** The title shows the month, the year and the quarter (`Nov 2026 Q4`; the quarter only
when quarterly notes are enabled). Each part opens its own note with the same clicks as a day, when its period is
enabled; a part whose period is off is plain text. The arrows move one month, and **Today**
returns to the current month; on a phone or tablet **Today** is a dot between the arrows. At
midnight a calendar showing the current month moves on by itself.

**Views.** Settings → **Calendar** → **View** picks how much of the calendar you see:

- **Month** shows whole months. **Months shown** stacks one to three months, each later month
  under its own title. **Extra weeks before** and **Extra weeks after** add up to four weeks above
  the first month and below the last one.
- **Weeks** shows a set number of weeks around today (**Weeks shown**, 2 to 12), so the distance
  you see ahead stays the same all month. **Today's row** puts the week of today on the first,
  middle or last row. The title names the month of that row, and days of other months fade as in
  the month view. The header has two arrows on each side: the single arrows (‹ ›) move one week,
  and the double arrows (« ») jump to the start of a month. « goes to the 1st of the month shown,
  and pressed again to the 1st of the month before; » goes to the 1st of the next month. **Today**
  brings today's week back to its row.

**Week column.** With **Show week numbers** on, the first column shows each week's number. The
number opens the weekly note when weekly notes are enabled, and is plain text when they are off.
The first weekday and the week numbers follow
**Week starts on** in Localization. When that setting and the name format of weekly notes number
weeks differently, for example weeks starting on Sunday with the ISO format `GGGG-[W]WW`, a week
can show one number in the calendar and another in its note; the Date notes page warns about it
and changes neither setting.

**Dots.** Each entry of the **Dots** list in Settings → **Calendar** adds dots to the calendar,
in list order. Each row shows its name, a preview of its dots on a sample day, and what it
counts: content, tasks, or where the link sits (body, property). An entry has a source and a look:

- **Source**: **Words** counts the words of the note, **Open tasks** its unfinished tasks,
  **Linking notes** the notes that link to it, from the body or from a property, and
  **Date property** the notes whose date property falls on that date, without any link.
- **Property**, for date property dots only: the property to read, such as `deadline`. A note
  with `deadline: 2020-12-31` marks 31 December. The property can hold a date, a date and time, or
  a list of dates, written as `YYYY-MM-DD`. A week, month, quarter or year counts the notes dated
  on any of its days. A date command that writes plain text into a date property writes exactly
  this format.
- **Dots**: one dot as soon as there is something, or one dot per amount, such as one per 250
  words, up to a limit of one to five. Word dots always show at least one dot on a date with a note,
  so a word dot also tells you the note exists.
- **Show on**: days, weeks, months, quarters and years, any of them. Month, quarter and year dots
  show on those parts of the calendar title.
- **Show for**: **Past**, **Current** (today, this week, this month…) and **Future**, any of them.
  A day, month, quarter or year is past or future compared with today's. A week is current when it contains today, past when all its
  days are before today, and future otherwise. With only **Future**, for example, the dots mark
  what is coming and disappear once the day arrives.
- **Shape**, **Color** and **Position**: a filled dot or a hollow ring, in the theme's default
  color, the accent or one of the theme's colors, below or above the number or in a top corner.
  On the highlighted day of the open note every dot takes the highlighted text color.
- **Show on days without a note**, for linking notes and date properties: a meeting note that links to next
  Tuesday marks Tuesday before its note exists.
- **Link found in**, for linking notes only: where the link to the day or week has to be.
  **Note body** counts links and embeds in the text, **Any property** counts links in any property,
  and **Property: *name*** counts links in that property, including each item of a list property.
  Add as many places as you need with **+**, which lists the vault's properties and also takes a
  typed name; a note counts when it links from any of them. Left empty, it shows **Anywhere**.
- **Only notes that match**, for linking notes and date properties: a filter that decides which
  notes count. Left empty, every note that links to the day or week, or that holds the date,
  counts.

**Filter of linking notes.** The filter works like the note filters of Note Compass and of Bases:

- **Add filter** asks which field the condition looks at, then the row takes an operator and a
  value. The **X** at the end of a row removes it.
- The fields are **file** (is a note, links to a note, in folder, has tag, has property, and their
  opposites), **file name**, **file base name**, **file full name**, **file path**, **folder** and
  **file extension** as text, **created time** and **modified time** as dates, **file size** as a
  number, **file links**, **file backlinks**, **file embeds** and **file tags** as lists, and any
  **property** of the note, compared by the type Obsidian gives that property.
- Text takes is, starts with, ends with, contains, contains any of, contains all of, is empty and
  their opposites. Is, starts with and ends with respect letter case, and the contains operators
  ignore it. Lists take is exactly, contains, contains any of, contains all of and is empty,
  comparing whole items. Numbers take =, ≠, <, ≤, > and ≥. Dates take on, before, on or before,
  after and on or after, against a fixed date or a number of days before or after today.
  Checkboxes take is and is not.
- **has tag** also matches tags nested under the tag, with or without `#`, in any letter case.
  **in folder** also matches notes in subfolders.
- The list at the top of a group chooses how its conditions combine: **All the following are
  true**, **Any of the following are true** or **None of the following are true**.
  **Add filter group** nests a group with its own choice inside another, up to three levels.
- A condition without a value matches nothing, and its opposite matches every note. A condition
  whose operator does not fit the type of its property matches nothing and shows a warning.

Filters saved by version 0.5.0 keep counting the same notes. A tag filter becomes a **has tag**
condition. A path or name prefix becomes a **starts with** condition when it has no letters. Any
other prefix, and every property filter, compared text in any letter case, which the new
conditions do not, so they stay under **Filters from an earlier version**: they still apply on top
of the filter, cannot be edited, and the dots show a warning until you remove them and build them
again in the filter. A saved filter that cannot be read is kept too: the dots count no note and
show a warning until you remove it.

By default the list keeps the earlier look: one filled dot per 250 words, at least one and at most
five, then one hollow dot when the note has an unfinished task. A **Words per dot** value saved by
an earlier version becomes the amount of the word dots, and 0 leaves only the task dots.

Settings → **Calendar**:

- **View**: **Month** or **Weeks**, with their options described above. Month by default.
- **Show week numbers**: add the week column. On by default.
- **Dim dates without a note**: show days, weeks, months, quarters and years that have no note
  yet in a muted color. Days of the previous and next month are see-through either way, so both
  differences show at once. Off by default.
- **Confirm before creating a note**: ask before creating a note that does not exist yet. On by
  default.
- **Dots**: the list of dots described above, with + to add an entry by its source. Each row has a
  pencil that opens the entry and a copy button that duplicates it, named "*name* copy", right
  below the original.

A note is found only at the path its folder and name format give it. The layout comes from Liam
Cain's [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) plugin (MIT), and the
compact look follows the Minimal theme's styling of it. The calendar uses only Obsidian's own theme
variables, so its colours, fonts and accent follow whichever theme you use.

## Public API for Templater

Other plugins and Templater scripts reach Date Compass through
`app.plugins.plugins["date-compass"].api`. It has eight functions, and each reads your current
settings: languages, week start, what "next" weekday means, how typed dates are read, and the folders,
formats and Enabled switches of Date notes.

Results are plain objects, so scripts need no extra library. A **note** has:

| Field | Meaning | Example |
| --- | --- | --- |
| `period` | `day`, `week`, `month`, `quarter` or `year` | `week` |
| `start` | the first day of the period, `YYYY-MM-DD` | `2026-11-16` |
| `date` | the date that names the note; `notePath(date, period)` gives `path` back | `2026-11-19` |
| `name` | the note name, from the period's name format | `2026-W47` |
| `path` | the vault path, from the period's folder and name format | `journal/2026-W47.md` |

A **reading** has `language` (`en`, `es`, or `shared` for phrases without words such as `W50`,
`-3d` or `3/12`) and `notes`: one note for a date or a period, several
for a range or sequence.

`now` is optional everywhere and defaults to the current time; pass a `Date` or a moment. A `date`
argument takes a `Date`, a moment or a `YYYY-MM-DD` string. Anything else, an unknown period, or a
period turned off in Date notes makes `notePath` throw and `openNote` and `ensureNote` reject. Phrases for a period
turned off in Date notes give no result, as in mentions. A week is the one the name format names:
ISO weeks with the default `GGGG-[W]WW`, so with Sunday weeks pass a note's `date` rather than its
`start`. The
TypeScript types `DateCompassApi`, `DateCompassInterpretation`, `DateCompassNote` and `DateCompassPeriod` are exported
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

**`ensureNote(date, period)`** creates that note from its template when it does not exist, without
opening it, and returns its path. It returns `undefined` when Templater could not create it.

```js
<%* const path = await dc.ensureNote(tp.date.now("YYYY-MM-DD", 1), "day"); if (path) tR += `[[${path.replace(/\.md$/, "")}]]`; %>
```

**`periods()`** returns the `enabled` switch, `folder` and `format` of each period, as a frozen copy.
A note's path is its folder plus the date written in its format, so another plugin can compute
paths exactly as Date Compass does.

```js
<%* const { week } = dc.periods(); if (week.enabled) tR += `${week.folder ? `${week.folder}/` : ""}${moment().format(week.format)}.md`; %>
```

## Settings layout

On the main page, click a row to open its page: **Localization**, **Date notes**, **Calendar**,
**Mentions** and **Commands**. Last is **Reset all settings**, which puts every option back to the
defaults after you confirm.

The **Localization** page has:

- **Supported languages**: a list with one row per language, in priority order. Each row has a
  remove button and the **+** button adds a language that is not listed yet, last. The last
  language can't be removed, and + says so when every language is listed. When a word means different things, such as "mar", the first language
  wins the top row. Drag a row to change the order.
- **Week starts on**: **Locale default** (default), **Monday** or **Sunday**.
- **"Next" weekday means**: **That day of next week** (default) or **The next time that day
  comes**.
- **Read typed dates like**: **Day/Month** (default) or **Month/Day**, for `3/12`. Below it,
  "Today: 17/11" shows today in the chosen order.

Nothing is hidden: every behaviour that picks or hides something is a setting above.

## Not yet

- Times of day.
- Languages other than English and Spanish.
