#!/usr/bin/env python3
"""
build-galerie.py – Kundengalerie für randl.group/zelt/galerie/ aus dem Nextcloud-Ordner "Photos" bauen.

Was passiert:
  1. Liest alle Bilder (jpg, jpeg, png, heic, webp) aus den Ordnern in tools/galerie-alben.json.
     RAW-Dateien (.dng) werden übersprungen – dazu liegt immer ein JPG daneben.
  2. Entfernt Duplikate:
       - exakt gleiche Dateien (SHA-1)
       - nahezu gleiche Bilder (dHash, z. B. "-2"-Kopien, "(Mittel)"-Verkleinerungen, Serienaufnahmen)
     Aus jeder Gruppe bleibt das Bild mit der höchsten Auflösung.
  3. Wandelt in WebP um: img/full/ (max. 2048 px) und img/thumb/ (640 px breit).
     Alle Metadaten (EXIF, GPS) werden dabei entfernt.
  4. Schreibt galerie.json und rendert die Bilder statisch in index.html
     (zwischen <!-- GALERIE:START --> und <!-- GALERIE:END -->) – gut für SEO, läuft auch ohne JS.
  5. Schreibt /root/galerie-duplikate.csv (außerhalb des Webroots) mit allen aussortierten Dateien.

Die Nextcloud-Originale werden nur gelesen, nie verändert.

Aufruf (als root auf dem Server):
  python3 -m venv /opt/galerie-venv
  /opt/galerie-venv/bin/pip install pillow pillow-heif
  /opt/galerie-venv/bin/python tools/build-galerie.py \
      --src /PFAD/ZU/nextcloud/data/kparzinger/files/Photos \
      --out /home/USER/web/randl.group/public_html/zelt/galerie \
      --dry-run          # erst nur Bericht, dann ohne --dry-run
  danach: chown -R USER:USER .../zelt/galerie/img

Optionen: --threshold N  (dHash-Abstand für "nahezu gleich", Standard 6; höher = strenger aussortieren)
          --prune        (WebP-Dateien löschen, die nicht mehr in der Galerie sind)
"""
import argparse, csv, hashlib, html, json, os, re, sys, unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow fehlt: pip install pillow pillow-heif")
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC = True
except ImportError:
    HEIC = False

Image.MAX_IMAGE_PIXELS = 200_000_000
EXT = {".jpg", ".jpeg", ".png", ".webp"} | ({".heic", ".heif"} if HEIC else set())
FULL_MAX, THUMB_W = 2048, 640
Q_FULL, Q_THUMB = 80, 72


def slugify(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def dhash(img, size=8):
    g = img.convert("L").resize((size + 1, size), Image.LANCZOS)
    px = g.tobytes()
    bits = 0
    for r in range(size):
        for c in range(size):
            bits = (bits << 1) | (px[r * (size + 1) + c] > px[r * (size + 1) + c + 1])
    return bits


def open_img(p):
    img = Image.open(p)
    if img.format == "JPEG":
        img.draft("RGB", (1024, 1024))  # schnelles Laden nur zum Hashen
    img = ImageOps.exif_transpose(img)
    return img


def name_penalty(name):
    """Niedriger = bevorzugt, falls Auflösung gleich: Originale vor Kopien."""
    n = name.lower()
    return sum(k in n for k in ("(mittel)", "-2.", "(2)", "kopie", "copy", "wa0"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--config", default=str(Path(__file__).with_name("galerie-alben.json")))
    ap.add_argument("--threshold", type=int, default=6)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--prune", action="store_true")
    ap.add_argument("--report", default="/root/galerie-duplikate.csv")
    a = ap.parse_args()

    src, out = Path(a.src), Path(a.out)
    cfg = json.loads(Path(a.config).read_text(encoding="utf-8"))
    excl = set(cfg.get("ausschliessen", []))
    if not HEIC:
        print("Hinweis: pillow-heif nicht installiert – HEIC-Bilder werden übersprungen.")

    # ── 1. Einlesen ──────────────────────────────────────────────
    items, skipped = [], []
    for prio, alb in enumerate(cfg["alben"]):
        for folder in alb["ordner"]:
            base = src / folder
            if not base.is_dir():
                print(f"WARNUNG: Ordner fehlt: {base}")
                continue
            for p in sorted(base.rglob("*")):
                if not p.is_file() or any(part in excl for part in p.relative_to(src).parts):
                    continue
                if p.suffix.lower() not in EXT:
                    skipped.append((p, "Format " + p.suffix))
                    continue
                try:
                    raw = p.read_bytes()
                    img = open_img(p)
                    with Image.open(p) as full:  # echte Größe inkl. EXIF-Drehung
                        W, H = full.size
                        if full.getexif().get(0x0112, 1) in (5, 6, 7, 8):
                            W, H = H, W
                    items.append(dict(
                        path=p, album=alb["id"], prio=prio,
                        sub=p.parent.name if p.parent != base else "",
                        sha=hashlib.sha1(raw).hexdigest(), dh=dhash(img),
                        w=W, h=H, pen=name_penalty(p.name), mtime=p.stat().st_mtime))
                except Exception as e:
                    skipped.append((p, f"Fehler: {e}"))
    print(f"Eingelesen: {len(items)} Bilder, übersprungen: {len(skipped)}")

    # ── 2. Duplikate (Union-Find) ────────────────────────────────
    parent = list(range(len(items)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    def union(i, j):
        parent[find(i)] = find(j)
    seen = {}
    for i, it in enumerate(items):
        if it["sha"] in seen: union(i, seen[it["sha"]])
        else: seen[it["sha"]] = i
    for i in range(len(items)):
        ri = items[i]["w"] / items[i]["h"]
        for j in range(i + 1, len(items)):
            rj = items[j]["w"] / items[j]["h"]
            if abs(ri - rj) > 0.08:  # anderes Seitenverhältnis = anderes Motiv/Zuschnitt
                continue
            if bin(items[i]["dh"] ^ items[j]["dh"]).count("1") <= a.threshold:
                union(i, j)
    groups = {}
    for i in range(len(items)):
        groups.setdefault(find(i), []).append(i)

    keep, dupes = [], []
    for g in groups.values():
        g.sort(key=lambda i: (items[i]["prio"], -items[i]["w"] * items[i]["h"], items[i]["pen"], str(items[i]["path"])))
        keep.append(items[g[0]])
        for i in g[1:]:
            dupes.append((items[i], items[g[0]]))
    keep.sort(key=lambda it: (it["prio"], it["sub"], str(it["path"])))
    print(f"Duplikate aussortiert: {len(dupes)} → Galerie: {len(keep)} Bilder")

    # ── 3. Konvertieren ──────────────────────────────────────────
    titles = {al["id"]: al["titel"] for al in cfg["alben"]}
    full_dir, thumb_dir = out / "img" / "full", out / "img" / "thumb"
    if not a.dry_run:
        full_dir.mkdir(parents=True, exist_ok=True); thumb_dir.mkdir(parents=True, exist_ok=True)
    manifest, wanted = [], set()
    for n, it in enumerate(keep, 1):
        caption = it["sub"] if it["sub"] and slugify(it["sub"]) != it["album"] else ""
        fname = f'{it["album"]}-{slugify(caption) + "-" if caption else ""}{it["sha"][:8]}.webp'
        wanted.add(fname)
        fw, fh = it["w"], it["h"]
        s = min(1, FULL_MAX / max(fw, fh)); fw, fh = round(fw * s), round(fh * s)
        tw, th = THUMB_W, round(THUMB_W * it["h"] / it["w"])
        if not a.dry_run and not ((full_dir / fname).exists() and (thumb_dir / fname).exists()):
            im = ImageOps.exif_transpose(Image.open(it["path"])).convert("RGB")
            im.resize((fw, fh), Image.LANCZOS).save(full_dir / fname, "WEBP", quality=Q_FULL, method=6)
            im.resize((tw, th), Image.LANCZOS).save(thumb_dir / fname, "WEBP", quality=Q_THUMB, method=6)
            print(f"  [{n}/{len(keep)}] {fname}")
        alt = f'{titles[it["album"]]}{" – " + caption if caption else ""} | Zeltverleih Dominik Randl'
        manifest.append(dict(file=fname, album=it["album"], caption=caption, alt=alt, w=fw, h=fh, tw=tw, th=th))

    # ── 4. Manifest + statisches HTML ────────────────────────────
    albums = [dict(id=al["id"], titel=al["titel"], anzahl=sum(m["album"] == al["id"] for m in manifest))
              for al in cfg["alben"]]
    albums = [al for al in albums if al["anzahl"]]
    data = dict(erstellt=datetime.now(timezone.utc).isoformat(timespec="seconds"), alben=albums, bilder=manifest)

    figs = []
    for i, m in enumerate(manifest):
        lazy = 'loading="lazy" decoding="async"' if i > 7 else 'fetchpriority="high"' if i == 0 else ""
        figs.append(
            f'<figure class="g-item" data-album="{m["album"]}">'
            f'<a href="img/full/{m["file"]}" data-w="{m["w"]}" data-h="{m["h"]}">'
            f'<img src="img/thumb/{m["file"]}" width="{m["tw"]}" height="{m["th"]}" alt="{html.escape(m["alt"])}" {lazy}></a>'
            + (f'<figcaption>{html.escape(m["caption"])}</figcaption>' if m["caption"] else "")
            + "</figure>")
    chips = ['<button class="g-chip active" data-filter="alle">Alle <span>{}</span></button>'.format(len(manifest))]
    chips += [f'<button class="g-chip" data-filter="{al["id"]}">{html.escape(al["titel"])} <span>{al["anzahl"]}</span></button>'
              for al in albums]
    block = ("<!-- GALERIE:START (automatisch erzeugt von tools/build-galerie.py – nicht von Hand ändern) -->\n"
             f'<div class="g-filter" role="toolbar" aria-label="Galerie filtern">{"".join(chips)}</div>\n'
             f'<div class="g-grid" id="g-grid">\n' + "\n".join(figs) + "\n</div>\n<!-- GALERIE:END -->")

    if a.dry_run:
        print("Trockenlauf – nichts geschrieben.")
    else:
        (out / "galerie.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        page = out / "index.html"
        if page.exists():
            t = page.read_text(encoding="utf-8")
            t2, cnt = re.subn(r"<!-- GALERIE:START.*?<!-- GALERIE:END -->", lambda _: block, t, flags=re.S)
            t2 = re.sub(r'(<span id="g-total">)\d*(</span>)', rf"\g<1>{len(manifest)}\2", t2)
            if cnt: page.write_text(t2, encoding="utf-8"); print("index.html aktualisiert.")
            else: print("WARNUNG: Marker GALERIE:START/END in index.html nicht gefunden.")
        if a.prune:
            for d in (full_dir, thumb_dir):
                for f in d.glob("*.webp"):
                    if f.name not in wanted: f.unlink(); print(f"  gelöscht: {d.name}/{f.name}")

    # ── 5. Bericht ───────────────────────────────────────────────
    rep = Path(a.report)  # bewusst NICHT im Webroot – enthält interne Pfade
    with open(rep, "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f, delimiter=";")
        wr.writerow(["aussortiert", "behalten (bessere Version)", "grund"])
        for d, k in dupes:
            why = "identisch" if d["sha"] == k["sha"] else "nahezu gleich"
            wr.writerow([d["path"].relative_to(src), k["path"].relative_to(src), why])
        for p, why in skipped:
            wr.writerow([p.relative_to(src), "", why])
    print(f"Bericht: {rep}")
    for al in albums: print(f'  {al["titel"]}: {al["anzahl"]}')


if __name__ == "__main__":
    main()
