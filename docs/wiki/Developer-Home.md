# Developer home

Chronexus is a **Tauri 2** desktop app: a **Rust** backend that owns a local **SQLite**
archive, and a **React + TypeScript (strict)** interface built with **Vite**. No web
service is needed at runtime.

| Page | Contents |
| --- | --- |
| [Architecture](Architecture) | Layers, data flow, invariants |
| [Repository map](Repository-Map) | Where things live |
| [Data and migrations](Data-and-Migrations) | Schema, migrations, backups, compatibility |
| [Sync client](Sync-Client) | How the app talks to Chronexus Server |
| [Localization workflow](Localization-Workflow) | The mandatory i18n gate |
| [Build and test](Build-and-Test) | Prerequisites, commands, checks |
| [Container builds](Container-Builds) | Linux and Windows packages in Docker |
| [QA scenarios](QA-Scenarios) | Real-app and multi-device tests |
| [Release process](Release-Process) | Versions, signing, publication |
| [Contributing](Contributing) | Rules, commits, review |

**Canonical sources.** This wiki explains; the repository holds the authoritative detail:
`PROJECT_SPEC.md` (product), `ROADMAP.md` (milestones), `AGENTS.md` (engineering rules),
`docs/STATUS.md` (verified state), `docs/DECISIONS.md` (architecture decisions) and the
topic files in `docs/`. Code and tests win over stale prose.

> Chronexus is developed with AI coding agents following the maintainer's instructions;
> `AGENTS.md` is the contract they — and you — follow.
