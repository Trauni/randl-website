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
