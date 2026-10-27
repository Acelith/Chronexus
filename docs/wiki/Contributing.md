# Contributing

- Read `AGENTS.md` first: it is the rulebook for humans and agents alike.
- One coherent, tested change per commit. Conventional Commit title in English
  (`feat(sync): …`) and a body with *Reason*, *Changes*, *Validation* and *Compatibility
  and limitations*.
- Add focused tests with every domain change; fix what your change breaks before
  committing.
- Never commit secrets, databases, backups, personal notes, images, generated output or
  `node_modules`.
- Respect the product invariants: offline-first, player knowledge, mention ≠ fact, no
  silent overwrite, explicit network actions only.
- Update the user part of this wiki in the same change as any visible behaviour, and
  `docs/STATUS.md` after meaningful milestones.
- Report bugs and ideas in the [issues](https://github.com/Acelith/Chronexus/issues).
  Never attach personal backups.
