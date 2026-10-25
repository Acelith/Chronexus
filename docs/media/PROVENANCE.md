# Public screenshots

The five WebP images are captured from an isolated Windows debug profile running
the English-first source version 0.8.1. All campaign content is synthetic: Varek’s
Tower, Oran of Valmora and the Cartographers’ Guild are demonstration fixtures.
No personal campaign, private photo or external campaign archive is used.

Reproduce with `scripts/qa/m20-readme-media.mjs`, then
`scripts/qa/english-public-media.mjs`, using an empty isolated `NODEX_DEV_DATA_DIR`,
CDP port 9224 and `CHRONEXUS_README_QA=isolated`. The scripts refuse an unrelated
campaign. Screenshots are 1440×900, with reduced motion; PNG captures are converted
to WebP quality 82. Current combined image size: 459,016 bytes.

The herald image is a UI illustration using English notes about the real 0.8.0
release. It does not represent an updater offer to the newer 0.8.1 source build,
does not check a remote channel and cannot install an update. All captured
buttons are part of the real component; the illustration binds inert callbacks.
Actual updater signature/backup acceptance is tracked separately in STATUS.
