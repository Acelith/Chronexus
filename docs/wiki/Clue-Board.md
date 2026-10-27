# Clue board

The clue board keeps track of what your character is still trying to learn. A
question, lead, suspicion or rumour is a **player note**, even if you mark it
confirmed. It does not add a relationship to the graph or change the note that
inspired it.

Open a campaign and choose **Clue board**. Press **New clue** to write a title and
optional notes. Choose a certainty and status; **Resolved** and **Disproven** can
name the session where you reached that conclusion. **Open** clears that
resolution reference. You can edit or reopen the clue later.

To keep a precise source, place the cursor in a journal or Codex note block and
press **Create clue from selected block**. The new clue starts with that block as
its source. You may also select whole sessions or Codex pages in the form. Source
links return to the note and highlight the block; the note shows backlinks to
clues that cite it. Linked Codex pages use stable IDs, so their links survive a
page rename.

Filter the board by status, linked page or session. Campaign search includes clue
titles and notes. `.nodex` backup and restore preserve clues and their references;
the readable ZIP export has a `clues/` folder and a `clues` array in
`campaign.json`.

Clues start **only on this device**. In **Sharing**, you may choose a private copy
for your own devices or share an individual clue with the party. The referenced
pages and source sessions must be selected for the same audience first. Other
players see an attributed, read-only claim; their journals do not gain a world
fact. The full source note is never uploaded merely because you created a clue.
