# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
Desktop Tauri 2 on Windows/macOS/Linux, with a local React interface.
## Users
Role-playing campaign player who records what their character knows.
## Product Purpose
Write notes, manage character sheets, and find connections between sessions, people, places, and objects.
## Capabilities and Constraints
Local SQLite data and real backups; persistent UUIDs; distinct mentions from declared relations. No invention of facts or implicit mutation of notes. Existing campaigns must be preserved.
The user requests a GUI faithful to the reference, settings in the left menu, independent scrolling lists, and both visual and Markdown editors. The response from 24 October 2026 confirms the direct modification of Markdown code.
## Brand Commitments
Chronexus; English by default and offline multilingual, with draft translations and partial invented languages. The image attached on 24 October 2026 is the graphic authority for this revision.
## Evidence on Hand
PROJECT_SPEC.md, ROADMAP.md, real implementation, and testing. Local work reference: .tools/ui-refresh/reference.png. Example names on the screen do not become campaign data.
## Operating Context
The current repository is D:/Development/Chronexus; the copy from C required the reconstruction of dependency links. The user data path does not follow the code folder.
## Product Principles
- Preserve data and provenance.
- Allow understandable actions with mouse and keyboard.
- Make saving and errors evident.
- Separate medieval appearance and predictable behavior.

## M10 language boundary
App settings are global, campaign AI settings remain separate. Language affects
UI labels and formatting, not original notes or sources. Preserve the reference
visual world across RTL/CJK; alternative scripts retain semantic ordinary text,
readable recovery and honest limitations documented in docs/I18N.md.
