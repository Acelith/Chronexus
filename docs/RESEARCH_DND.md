# D&D and Skill Sources — search of 23 October 2026

## API for the wiki

| Source | Verification | Choice |
| --- | --- | --- |
| [Open5e v2](https://open5e.com/api-docs/) | Public REST API with cross-search, creatures, spells, items, and documents with edition/publisher/licenses | Added as optional wiki; distinct source for each entry |
| [D&D 5e API](https://docs.dnd5eapi.co/introduction) | SRD Catalog 2014 already integrated and modifiable in personal imports | Preserved; no replacement of saved spells |
| [Wikidot](https://developer.wikidot.com/doc:api) | Authenticated XML-RPC API of the platform, not an equivalent verified public D&D catalog | M16: public HTML reading of dnd5e.wikidot.com, without API/keys; default source |

Real test: search `magic missile`, opening the SRD entry 5.1, document
`srd-2014`, CC BY 4.0 and OGL licenses declared by the API. The Open5e catalog
includes material from multiple publishers: it does not mean access to all commercial
manuals or full equivalence with Wikidot. Text predominantly in English.

The wiki requires an explicit action. Only public queries and IDs go to the host
`api.open5e.com`, with GET without credentials, redirects forbidden, timeout 12 seconds
and limit 2 MiB. No campaign document sent. Maximum SQLite cache
100 responses, included in the backup; old content visible if refresh fails.
Highlighted HTML results are not rendered; the text is escaped.
Consulting rules does not create knowledge/relations in the graph nor overwrite spells.

## Skill Search

Consulted [skills.sh](https://skills.sh/) and CLI searches
`pnpm dlx skills find "webapp testing"` and `"graph visualization"`.
No global installation; the CLI package was executed via dlx.

- [webapp-testing by Anthropic](https://skills.sh/anthropics/skills/webapp-testing):
  about 186 thousand installations indicated by the catalog, official repository
  with about 183 thousand stars. SKILL.md read from GitHub source; Python workflow
  evaluated, while the automation of this Tauri app remains Playwright JS/CDP already
  in use. Not declared as a new installed Skill nor as an applied workflow.
- Results for AntV G6/React Flow graphs evaluated for relevance: require stack
  different from Cytoscape already present; not adopted solely due to the number of installations.
- Local skills actually read/applied: find-skills (search and verification),
  frontend-design and ui-taste (visual direction and critique),
  vercel-react-best-practices (lazy loading). imagegen used only for
  UI reference with dummy data; no private data sent or asset generated
  requested at runtime. Skill documentation and reference remain in .tools/.


## Update of October 25 2026 — Wikidot and new M16

The next search distinguished the platform's API from the scraping of the site
D&D. [XML-RPC Documentation](https://developer.wikidot.com/doc:api) and
[methods](https://www.wikidot.com/doc:api): authenticated endpoint, operations
pages.select/get_meta/get_one; in the investigation already conducted, an anonymous reading
returned HTTP 401. This does not prove if the D&D site allows APIs to a specific
account, which was not verified with a key.

The [public example page](https://dnd5e.wikidot.com/spell:acid-splash) is
readable via HTML and contains the spell fields. The
[robots.txt](https://dnd5e.wikidot.com/robots.txt) consulted in the investigation did not
generically forbid those pages; it is a dated observation, not a permanent
permission nor a redistribution license. Re-verify before development.

**M16 is only planned:** HTML adapter, Wikidot/Open5e selector in the
app settings, default Wikidot, separate offline cache, and imports
explicit with provenance. No API key required by the HTML flow; no
reading of private content or instruction of pages to be executed.
The public version 0.4.0 continues to use Open5e in the D&D Wiki and the separate
SRD 2014 catalog. This delivery does not implement scraping or modify settings.
The verifications mentioned above belong to the previous investigation, not to new tests
performed during the documentary reorganization. Complete criteria in ROADMAP.md, M16.


### M16 Implementation Verification — 25 October 2026

`robots.txt` rechecked: for all agents, only paginated paths are forbidden
`/*/p/*` and variants, and agent `voltron` is blocked; the pages used (`/spells`, `/`,
`/lineage`, `/wondrous-items` and individual entries) are not forbidden. The footer
declares «CC BY-SA 3.0 unless otherwise indicated»: Chronexus shows this
declaration for every entry without considering it a license for the game content
of the publishers, and does not redistribute catalogs. The site hosts 2014 rules; the
2024 are on a separate, unused wiki. Observed structure: title in
`.page-title`, content in `#page-content`, spells with «Source:», level/
school line and «Casting Time/Range/Components/Duration» paragraph. Real pages
saved only in a temporary folder for the ignored QA test, never in Git.

Update of M16 requirements (planning only): clearable offline cache
by source or entirely, without deleting imported copies/campaign data.
If Wikidot does not return usable information, an explicit question is asked before
switching to Open5e and the new search; refusal/closure maintains Wikidot.
An accepted change is saved in the settings. M15a, epic announcements of
updates, now precedes M16 in the execution order.
