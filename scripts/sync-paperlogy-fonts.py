"""Copy the verified supplied fonts unchanged, together with provenance.

Run manually with Python 3. No downloads or third-party packages are needed.
"""
from hashlib import sha256
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parent.parent
FONTS = [
    (400, "Paperlogy-4Regular.ttf", "05e1021e3de620dddc97875342e2be1a94c5f8e9b9f792bd16c4c1d0085343b3"),
    (500, "Paperlogy-5Medium.ttf", "f3c97ace885bb7d2a53a73dc71d832fa79988d5f546c2562abbb87aa07492f4b"),
    (600, "Paperlogy-6SemiBold.ttf", "ca92034a1c4602a57c55434dfdbf8428a0bb88ac84a99a5effec1a41f0118127"),
    (700, "Paperlogy-7Bold.ttf", "7effb892621474e9c2a9112f482eb87dd25b65a470e5ae5971be5a68d89ad89b"),
    (800, "Paperlogy-8ExtraBold.ttf", "fb0324f8ac057e50f4f4632331617e347bfe5a04184f7b0db514be682fb6b25c"),
]
target = ROOT / "public/fonts/paperlogy"
license_path = ROOT / "public/fonts/Paperlogy-OFL.txt"
license_bytes = license_path.read_bytes()
if b"SIL OPEN FONT LICENSE Version 1.1" not in license_bytes:
    raise ValueError("Paperlogy OFL notice is missing")

# Check every source before copying any files. Original source files stay intact.
verified = []
for weight, filename, expected in FONTS:
    source = ROOT / "Paperlogy" / filename
    raw = source.read_bytes()
    if sha256(raw).hexdigest() != expected:
        raise ValueError(f"Unverified font source: {filename}")
    verified.append((weight, source, raw, expected))

target.mkdir(parents=True, exist_ok=True)
entries = []
for weight, source, raw, expected in verified:
    destination = target / source.name
    shutil.copyfile(source, destination)
    if destination.read_bytes() != raw:
        raise ValueError(f"Font copy mismatch: {source.name}")
    entries.append({"family": "Paperlogy", "weight": weight,
                    "source": source.relative_to(ROOT).as_posix(),
                    "publicPath": destination.relative_to(ROOT / "public").as_posix(),
                    "bytes": len(raw), "sha256": expected})

manifest = {"date": "2026-10-08", "license": "SIL OFL 1.1",
            "licensePath": "fonts/Paperlogy-OFL.txt",
            "licenseSha256": sha256(license_bytes).hexdigest(),
            "method": "Byte-identical copies of user-supplied verified TTFs; no subsetting or conversion",
            "fonts": entries}
(ROOT / "docs/FONT_ASSETS_20261008.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"fonts": len(entries), "bytes": sum(x["bytes"] for x in entries),
                  "verified": True}))
