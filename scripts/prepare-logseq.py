"""Extract only campaign Markdown and raster assets; never load Logseq/Git config."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("archive", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
output = args.output.resolve()
workspace = Path(__file__).resolve().parent.parent / ".tools"
if not output.is_relative_to(workspace.resolve()):
    parser.error("Use a new output folder inside this repository's .tools directory.")
entries = []
with zipfile.ZipFile(args.archive) as archive:
    roots = {PurePosixPath(i.filename).parts[0] for i in archive.infolist()
             if len(PurePosixPath(i.filename).parts) >= 3
             and PurePosixPath(i.filename).parts[1] in ("pages", "journals")}
    if len(roots) != 1:
        parser.error("Expected one Logseq graph root containing pages/journals.")
    root = roots.pop()
    selected = []
    total = 0
    names = set()
    for info in archive.infolist():
        path = PurePosixPath(info.filename)
        if path.is_absolute() or ".." in path.parts or "\\" in info.filename:
            parser.error("Unsafe path in archive.")
        if info.is_dir() or len(path.parts) < 3 or path.parts[0] != root:
            continue
        section = path.parts[1]
        suffix = path.suffix.lower()
        if not ((section in ("pages", "journals") and suffix == ".md") or
                (section == "assets" and suffix in (".png", ".jpg", ".jpeg", ".webp"))):
            continue
        relative = PurePosixPath(*path.parts[1:])
        if any(":" in p or p.startswith(".") or p.endswith((".", " ")) for p in relative.parts):
            parser.error("Nonportable selected file name.")
        if stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
            parser.error("Encrypted files and symbolic links are unsupported.")
        if str(relative).casefold() in names or info.file_size > 20 * 1024 * 1024:
            parser.error("Duplicate or oversized campaign file.")
        names.add(str(relative).casefold())
        total += info.file_size
        if total > 512 * 1024 * 1024 or len(selected) >= 5000:
            parser.error("Campaign archive too large.")
        selected.append((info, relative))
    output.mkdir(parents=True, exist_ok=False)
    for info, relative in selected:
        data = archive.read(info)  # ZIP CRC is checked before writing.
        destination = output.joinpath(*relative.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("xb") as file:
            file.write(data)
        entries.append({"path": str(relative), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
manifest = {"formatVersion": 1, "files": entries}
(output / "source-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"files": len(entries), "markdown": sum(e["path"].endswith(".md") for e in entries),
                  "images": sum(not e["path"].endswith(".md") for e in entries), "bytes": total}))
