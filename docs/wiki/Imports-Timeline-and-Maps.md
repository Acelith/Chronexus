# Imports, timeline and maps

These features are available in the **Campaign overview** in current source.
They are not included in the previously published 0.12.0 installer.

## Bring existing notes into a campaign

Choose an Obsidian/Logseq folder, Kanka JSON export ZIP, or a supported D&D 5e
2014 character JSON file. Review the preview, then choose **Back up and import**
(or **Back up and import character**). Cancelling the backup makes no changes.
The original source files stay immutable, with SHA-256 checksums in backups.
Kanka relationships are imported as unknown, attributed claims. Existing pages
are not merged and an existing character is never replaced.

If an import fails after some writes, restore the displayed pre-import backup to
undo it before trying again. Restore replaces the entire archive. See the
[format guide](../IMPORTS.md) for exact supported fields and bounds.

## Campaign timeline

Open **Campaign timeline** in the overview. Define months as one `name:days` per
line, then comma-separated weekdays and eras. Era order is chronological. Save
before adding dates. Link a date to an existing session, Codex page (including an
event page), or clue. Choose exact, approximate or unknown; no date is inferred
from notes. The list opens the original entry. Editing/removing a date does not
edit the linked note. Calendar changes that invalidate saved dates are refused.

## Maps

Attach a validated PNG/JPEG/WebP image to a Codex page with the **map** role, then
open **Campaign maps** in the overview. Choose an image, label a pin and select
its linked page/session/clue. Click a position or enter horizontal/vertical
percentages, then **Add pin**. Drag a pin to move it, or use **Edit pin** and the
keyboard-editable coordinates. **Open linked entry** navigates to its target;
**Delete pin** asks for confirmation and also removes routes using it.

A route connects two pins on the same image. It is a player-authored navigation
reference, not a factual relationship. Re-importing a map creates a separate
managed image; **Move pins to equal-size map** explicitly transfers the pins and
routes to an image with the same dimensions. Pins use relative coordinates.

All three features remain local. Timeline, calendar, pins and routes are not
sharing items. Backups restore their IDs and map image bytes together; original
campaign text, AI sources and confirmed knowledge are never inferred from them.
