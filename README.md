# randl-website

Statische Website von **randl.group** (Zeltverleih, CNC-Metallarbeiten, Gashandel, Fotobox).
Dieses Repo ist der **Snapshot des Webroots** auf dem Server (Variante B): Der Server bleibt die
Quelle, weil der Kunde teils im CMS (`randlweb.de/content/cms`) bearbeitet. Das Repo dokumentiert
den Verlauf.

- Kein Build-Schritt: statisches HTML + Vanilla JS, `style.css` geteilt (CSS-Variablen, kein Hardcoding von Hex-Werten)
- Formulare laufen über `contact.php` (Turnstile + SMTP); Secrets liegen in `private/.env` **außerhalb** des Webroots
- Fonts lokal unter `fonts/` (`fonts.css`), kein Google-CDN
- Google Analytics lädt erst nach Einwilligung (`cookie-consent.js`, Event `cc:consent`)

**Nicht im Repo:** `system/` (Basic-Auth-Bereich mit Laufzeitdaten und `.htpasswd`), `private/`, `.env`, Backups.

Aufgaben: OpenProject, Projekt `website` (https://projects.randlweb.de).

## Sync Server → Repo

`tools/sync-to-github.sh` spiegelt den Webroot (ohne `system/`, `private/`, `.env`, Backups) in dieses
Repo und pusht nach GitHub. Läuft als root auf dem Server, Git-Zugriff über einen Deploy-Key
(`~kpssh/.ssh/randl-website-deploy`). Erst Trockenlauf, dann `--apply`; bricht ab, wenn mehr als
15 Dateien gelöscht würden. Details im Kopf des Skripts.

## Kundengalerie `/zelt/galerie/`

Die Bilder kommen aus der Nextcloud (`Photos`, gleicher Server). `tools/build-galerie.py` sortiert Duplikate aus,
wandelt in WebP (Vollbild 2048 px + Vorschau 640 px, ohne EXIF/GPS) und schreibt die Bilder statisch in
`zelt/galerie/index.html` (zwischen den `GALERIE`-Markern) plus `galerie.json`. Alben und Reihenfolge:
`tools/galerie-alben.json`. Die WebP-Dateien (`zelt/galerie/img/`) liegen nur auf dem Server, nicht im Repo.
Neue Fotos in der Nextcloud → Skript erneut laufen lassen (bereits konvertierte Bilder werden übersprungen).
Pflege im Mitarbeiterportal (Bilderverwaltung → Kundengalerie): löschen, hochladen, Kategorie ändern, Kategorien
umbenennen/sortieren, Gesichter verpixeln. Der Stand liegt in `zelt/galerie/.verwaltung.json` und wird vom Skript übernommen.
Gesichtserkennung: lokal mit OpenCV und dem YuNet-Modell in `tools/models/` (`pip install opencv-python-headless`).
