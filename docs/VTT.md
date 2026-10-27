# Chronexus Table — virtual tabletop and combat (planned M42–M47)

Requested on 27 October 2026. **Planning only**: nothing here is implemented. Each milestone
starts only on an explicit request, like every other open milestone.

## 1. Goal in one paragraph

A game master (GM) creates a **table** on a Chronexus Server through its web interface and
invites players with a code. Each player joins from the desktop app and becomes a player of
that GM's table. At the table the GM shows a **battle map with a grid**, places player
characters and **monsters**, runs **initiative**, and everyone moves their tokens on the grid —
as in Roll20 or Foundry VTT. Distances are always shown **in feet and in metres**, with a
converter on screen. The players' journals stay theirs: **the GM never sees or changes a
player's notes**; each player keeps deciding, item by item, who sees what, exactly as today.

## 2. Product boundaries (they extend AGENTS.md, they do not replace it)

1. **Two separate spaces.** The *journal* (notes, Codex, graph, sheet, private and shared
   items — today's Chronexus) and the *table* (maps, tokens, monsters, initiative, combat log).
   Nothing moves between them implicitly.
2. **The GM is not a reader of the journal.** A GM account has no access to players' private
   or shared journal items. Sharing keeps today's audiences — *only this device*, *private
   copy*, *shared with the other players* — and adds one explicit audience, *shared with the
   GM too*, chosen per item by its author. The server enforces this; the UI only mirrors it.
3. **GM-only content lives only in the table space**: hidden monsters, unrevealed map areas,
   GM notes on an encounter, secret rolls. The server never sends it to players (filtering
   happens on the server, never by hiding things in the client). It never enters a player's
   journal, knowledge graph, search, AI sources or backups.
4. **No implicit mutations**, as today: a hit does not change the player's sheet by itself.
   The token's owner applies damage to their own character (one click, confirmed); the GM
   manages monster hit points. Spell slots and resources are never consumed automatically.
5. **Player knowledge stays player knowledge.** What a player sees at the table (a monster's
   name, a revealed room) can be written into the journal only by the player, explicitly.
6. **Offline-first exception, scoped.** The table needs a live connection to the server; the
   journal keeps working offline. Losing the connection freezes the table view with a clear
   notice and resynchronizes on return; it never blocks the journal.
7. **Licences.** Rules text and monsters come only from sources with a compatible licence
   (D&D 5e SRD 5.1 under CC BY 4.0, Open5e documents with their own licences), with
   attribution kept. No code is copied from proprietary tools (Roll20, Foundry VTT); open
   tools are used as references for concepts only unless their licence fits.

## 3. Roles and accounts

| Role | Where | Can |
| --- | --- | --- |
| Server operator | CLI | As today: invitations for GM accounts, backups, recovery |
| Game master (GM) | Web interface of the server (and later the desktop) | Create tables, invite players, upload maps, create monsters and encounters, run combat |
| Player | Desktop app | Join tables by code, control own tokens, roll, see what the GM reveals |
| Spectator (optional, later) | Web | Watch a table read-only |

- A GM account is an ordinary server account with the **GM capability** granted by the
  operator (`chronexus-server invite --gm`) or by an invitation the operator allows.
- **Table invitations**: the GM creates one-use codes (or a reusable link with an expiry and
  a seat limit). A player who has no account on that server **registers through the code**
  (user name, display name, password, as today's invitation flow) and is bound to the table;
  an existing account just joins.
- A player can be at tables of several GMs; a table is independent from the player's own
  journal campaign. The player may **link** a table to one of their journal campaigns, which
  only lets the desktop show both side by side.
- Leaving or being removed from a table: the player keeps their journal; table data they saw
  is dropped from their device.

## 4. The table: requirements

### 4.1 Scenes and maps
- A table has **scenes**. A scene has a background map: PNG/JPEG/WebP uploaded by the GM
  (validated like today's images; larger limits for maps, e.g. 32 MiB and 16 384 px per side),
  optionally a **Universal VTT** file (`.dd2vtt`/`.uvtt`, the open format exported by
  Dungeondraft and others) that brings the image plus grid, walls, doors and lights.
- **Grid**: square (default) or hex (flat/pointy), cell size in pixels, offset, colour and
  opacity, and the **distance per cell** (default 5 ft). Calibration tool: drag a box over
  two cells of the printed grid to align it, as in Foundry's grid configuration.
- **Layers** (Roll20 model): *map* (background, GM only edits), *tokens*, *GM layer*
  (invisible to players), *drawings/templates*.
- The GM **activates** one scene for the players; preparing another scene stays private.

### 4.2 Tokens
- **Player tokens** belong to a player and can be linked to their character: name, portrait
  (an image the player chooses to share as a projection, as today's shared images), size
  (tiny…gargantuan → cells), speed. HP shown to others only if the player allows it.
- **Monster and NPC tokens** belong to the GM: name (may be masked, e.g. "Hooded figure"),
  size, speed, AC, HP (hidden from players unless the GM shows a status like *bloodied*),
  conditions. Several tokens can share one stat block, each with its own HP.
- **Visibility per token**: visible, hidden (GM layer), revealed later. The server never
  sends hidden tokens to players.
- **Conditions** as markers (the SRD condition list), with optional duration in rounds.

### 4.3 Movement on the grid
- Drag a token: it **snaps to the grid**; while dragging, a **ruler** shows the path and the
  distance **in ft and m**, e.g. `25 ft · 7.5 m`.
- **Diagonal rule** chosen per table: *every square counts 5 ft* (default) or *alternating
  5/10 ft*; Euclidean for gridless maps.
- **Movement budget** per turn from the token's speed (manual value, never computed from
  hidden formulas), shown as remaining distance in both units; difficult terrain cells cost
  double when the GM marks them. Exceeding the budget is allowed but flagged, not blocked
  (the GM is the referee).
- **Permissions**: players move only their own tokens and only during their turn (the GM can
  relax this outside combat); the GM moves everything. The server validates every move.
- **Measuring tool** (anyone): a ruler that does not move anything.
- **Area templates**: cone, sphere/circle, cube/square, line, cylinder, with size in ft and m;
  cells covered are highlighted (5e rule for template coverage, configurable).

### 4.4 Combat tracker
- Start combat with selected tokens; **initiative** rolled with the existing dice roller
  (players roll their own; the GM rolls for monsters, optionally secretly), or entered by
  hand; ties broken by the GM.
- Turn order, current turn highlight, **round counter**, *next turn*, *delay*, *remove*,
  *add mid-combat*. Condition durations count down by round with a visible reminder, never
  removed silently.
- **Combat log**: rolls (public or GM-secret), damage and healing applied, conditions,
  moves. Players see only the public part.
- **Hit points**: the GM changes monster HP; a player changes their own character's HP from
  the table or their sheet — one explicit action, mirrored to the token. No automatic damage
  from rolls.

### 4.5 Fog of war and vision
- **Manual fog** first (Owlbear Rodeo / Roll20 style): the GM paints or removes fog with
  rectangles, polygons and a brush; players see only revealed areas.
- Later **dynamic vision**: walls and doors (drawn or from Universal VTT), token vision radius
  and darkvision in ft/m, light sources; line of sight computed on the server for what each
  player may see.

### 4.6 Monsters and encounters
- **Monster library** for the GM: import from the SRD 5.1 (via the already allowlisted
  `dnd5eapi.co` and Open5e), with source, edition and licence kept — an editable copy, never
  a silent overwrite; plus custom monsters.
- **Encounters**: a saved set of monsters with positions for a scene, ready to drop.
- Stat block view for the GM, with rolls (attack, damage, saving throws) through the dice
  roller.

## 5. Units: feet and metres everywhere

The user's requirement: in the combat screen **every distance shows both units** and there is
a **converter on screen**.

- **Canonical unit**: the rules' unit stays the source of truth (feet for D&D 5e). Every
  stored distance keeps its original unit and value; conversion is display-only, so nothing
  drifts after repeated conversions.
- **Display**: `30 ft · 9 m` (order follows the user's preferred primary unit, a global
  setting). Applies to the ruler, movement budget, speeds, template sizes, vision/light radii,
  grid scale and the converter. Later, the same display reaches the journal: sheet speeds,
  spell ranges and areas, item ranges.
- **Conversion convention**, chosen per table and always labelled:
  - *Table convention (default for D&D)*: 5 ft = 1.5 m, i.e. 1 square = 1.5 m, as used by the
    official non-English editions of the game; 30 ft → 9 m.
  - *Exact*: 1 ft = 0.3048 m (international foot); 30 ft → 9.144 m.
- **Rounding**: table convention shows multiples of 0.5 m when exact on the grid; exact
  convention shows up to two decimals, trimmed (`9.14 m`). Never round silently in stored data.
- **On-screen converter**: a small always-available panel in the combat screen — type a value
  in ft or m, see the other instantly with the active convention and the other one in grey;
  keyboard reachable; copies the result. It never changes game data.
- **Tests**: exhaustive table of conversions (0, 5, 10, 15, 30, 60, 120, 1 mile), round-trip
  stability, both conventions, localized decimal separators in all ten languages.

## 6. Architecture

- **Server (Chronexus-Server)**
  - New domain *tables*: tables, seats/memberships with roles (GM, player, spectator), table
    invitations, scenes, map assets, grid settings, tokens, monster templates, encounters,
    combat state, combat log, fog geometry. Migrations as today; GM-only fields in separate
    columns/tables so filtering is structural.
  - **Real-time channel**: WebSocket (`/api/v1/tables/{id}/live`) with authentication,
    per-recipient views computed on the server (players never receive hidden tokens, fog
    contents or secret rolls). Commands (`move token`, `next turn`, …) carry an operation ID
    and the state revision; the server validates and broadcasts the result. Reconnection
    resumes from a revision or reloads a snapshot.
  - **Web interface** for GMs (shares the React codebase and components with the desktop):
    account, tables, invitations, scene editor, map/grid calibration, monster library,
    encounter builder, combat. Builds on the planned web management (server M25.11).
  - Journal sharing gains the audience *shared with the GM too*; the GM sees nothing else.
- **Desktop (Chronexus)**
  - *Tables* view: join by code, list tables, open the live table; the journal stays next to
    it. Offline: the table shows a reconnecting state; the journal is unaffected.
  - Rendering with a 2D canvas engine (**PixiJS**, MIT, WebGL with canvas fallback) for maps,
    grid, tokens, fog and templates; React for panels (tracker, converter, log).
  - Character link: the player chooses which character values feed their token (name,
    portrait, speed, AC, HP display) — a projection, as today's shared sheet sections.
- **Protocol and data rules**: UUIDs everywhere, revisions on every mutable record, server
  authoritative, idempotent commands, bounded payloads, rate limits per seat.

## 7. Where to take inspiration (concepts, not code)

| Source | What to learn | Licence note |
| --- | --- | --- |
| Roll20 | Layers (map/token/GM), turn order, ruler, token bars, fog drawing | Proprietary — concepts only |
| Foundry VTT | Scenes, tokens linked to actors, combat tracker, measured templates, grid config and calibration, walls/vision | Proprietary — concepts only |
| Owlbear Rodeo | Minimal flows: drop a map, align the grid, play | Concepts; check the licence of any version before reusing code |
| MapTool (RPTools) | Open-source VTT: vision, fog, macros | AGPL — concepts only unless the project chooses AGPL-compatible reuse |
| Universal VTT format | Interchange of maps with grid, walls, doors, lights | Open format — implement an importer |
| D&D 5e SRD 5.1 | Combat chapter: initiative, movement, areas of effect, conditions; monsters | CC BY 4.0 — attribute |
| PixiJS | Fast 2D rendering of maps and tokens | MIT |
| Red Blob Games — hex grids | Hex coordinates, distances, line drawing | Articles; reimplement |

## 8. Milestones (planned, app IDs; server parts in Chronexus-Server's roadmap)

| ID | Milestone | Server | Desktop | Depends on |
| --- | --- | --- | --- | --- |
| M42 | GM accounts, tables and invitations | GM capability, tables, seats, table invitations with sign-up, *shared with the GM* audience enforced | Join a table by code, table list, audience choice per item | M25 |
| M43 | Live table channel and GM web interface | WebSocket with per-recipient views, presence, revisions, reconnect; web app shell for GMs | Live connection, presence, reconnecting state | M42 |
| M44 | Maps, grid, tokens and movement, ft/m everywhere | Scenes, map assets, grid, tokens, move validation, rulers | Table canvas (PixiJS), drag on grid, ruler and templates in ft+m, on-screen converter, unit setting | M43 |
| M45 | Combat tracker | Combat state, initiative, turns, rounds, conditions, log, secret rolls | Tracker panel, own initiative and HP actions, combat log | M44 |
| M46 | Fog of war and vision | Fog geometry, then walls/doors/lights, server-side visibility | Fog rendering, Universal VTT import for walls | M44 |
| M47 | Monster library and encounters | SRD import with attribution, custom monsters, encounters | (GM tools live in the web interface; desktop shows tokens only) | M45 |

### Acceptance for each milestone
- Server-enforced privacy: an automated matrix proves a GM cannot read any player journal
  item without the *shared with the GM* audience, and players never receive hidden tokens,
  fog contents, GM notes or secret rolls (also over the live channel).
- Multi-device scenario extended from `scripts/qa/sync`: one GM in the web interface, three
  players on macOS/Linux/Windows desktops, a full combat (map, grid calibration, initiative,
  three rounds, movement with diagonal rule, templates, fog reveal, a hidden monster revealed).
- Units: every distance in the combat screen shows ft and m; converter correct for both
  conventions in all ten languages; no stored value changes after display.
- Latency target on a LAN: a move reaches the other screens in under 200 ms (measured).
- Localization gate, accessibility (keyboard: select token, move by cell with arrows, tracker
  operable without a mouse; screen-reader summary of the board), reduced motion.
- Backups: a GM's server backup contains tables; a player's `.nodex` backup contains only
  their journal and their table links, never GM-only data.
