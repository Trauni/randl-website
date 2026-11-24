# Übergabe: Aktuelles /news/ (OpenProject 74)

Alle Zeilen unter 80 Zeichen, keine Heredocs. Reihenfolge einhalten.
Server-Befehle als root.

## Wie es zusammenhängt

- Pflege: Portal → Content → Aktuelles (ab Portal v1.40.0).
- Daten: `news/.beitraege.json` (Punkt-Datei, von außen gesperrt).
- Design: `news/.vorlage.html` (Quelle: `tools/aktuelles/vorlage.html`).
- Das Portal erzeugt beim Speichern: `news/<slug>/index.html`,
  `news/index.html`, `news/news.json`, die Einträge in `sitemap.xml`
  und die Teaser auf Startseite, `/zelt/`, `/metall/`, `/gas/`
  (jeweils zwischen `AKTUELLES:START` und `AKTUELLES:END`).
- Bilder: `news/img/full` (2048 px) und `news/img/thumb` (640 px).
- `deploy.py` (Marker AKTUELLES-v1) setzt nur Vorlage, Teaser-CSS,
  Marker, Footer-Link und die Messe-Kurzfassung.

## 1. Portal deployen (nach Merge des PR feat/aktuelles)

    cd /home/radmin/web/randlweb.de/public_html/portal
    git pull
    npm --prefix client run build
    pm2 restart randlweb-portal
    pm2 logs randlweb-portal --lines 30 --nostream

Keine DB-Migration, keine neuen Pakete.

## 2. Website, Durchgang 1 (Vorlage, CSS, Marker)

    find /home/radmin/web/randl.group/public_html -name '*.bak*'
    cd /home/kpssh/randl-website && git pull -q
    cd tools/aktuelles
    python3 deploy.py

Erwartung: 4 Seiten `PATCH` (teaser-css=todo, teaser-marker=todo),
`news/.vorlage.html` = `neu`, footer-link und messe-kurzfassung
= `wartet`. Dann:

    BACKUP_ROOT=/home/kpssh/backups python3 deploy.py --apply

## 3. Messe-Beitrag anlegen und bauen

    cd /home/radmin/web/randlweb.de/public_html/portal
    J=/home/kpssh/randl-website/tools/aktuelles/messe-beitrag.json
    node scripts/aktuelles.js import $J
    node scripts/aktuelles.js liste

Erwartung: 8 Bilder nach `news/img/`, „Angelegt: Hochzeitsmesse
Rosenheim 2026 (veroeffentlicht)“, Build ohne WARNUNG. Der Beitrag
steht danach im Portal und wird dort weiter gepflegt.

## 4. Website, Durchgang 2 (Footer-Link, Messe-Kurzfassung)

    cd /home/kpssh/randl-website/tools/aktuelles
    python3 deploy.py
    BACKUP_ROOT=/home/kpssh/backups python3 deploy.py --apply
    python3 deploy.py

Erwartung: 12 Seiten `PATCH` (footer-link=todo), index.html dazu
messe-kurzfassung=todo. Letzter Lauf: „Nichts zu tun.“ Rückgängig:

    BACKUP_ROOT=/home/kpssh/backups python3 deploy.py \
      --rollback /home/kpssh/backups/aktuelles-<ts>

## 5. Prüfen

    U=https://randl.group
    curl -s -o /dev/null -w '%{http_code}\n' $U/news/.beitraege.json
    curl -s -o /dev/null -w '%{http_code}\n' $U/news/.vorlage.html
    curl -s -o /dev/null -w '%{http_code}\n' $U/news/
    curl -s $U/news/hochzeitsmesse-rosenheim-2026/ | grep -c '<h1>'
    curl -s $U/sitemap.xml | grep -c '/news/'
    curl -sI $U/news/news.json | head -12

Erwartung: 403 oder 404, 403 oder 404, 200, 1, 2. Liefert eine der
ersten beiden Zeilen 200, sind Punkt-Dateien unter /news/ NICHT
gesperrt: dann sofort melden, bevor Entwürfe angelegt werden.

## 6. nginx-Caching (erst ansehen, nicht blind ändern)

    D=/home/radmin/conf/web/randl.group
    cat $D/nginx.ssl.conf_imgcache

Vorschlag, an den Stil der vorhandenen Blöcke anpassen. Bilder unter
/news/img/ ändern ihren Namen bei neuem Inhalt (Hash im Namen):

    location /news/img/ {
        expires 30d;
    }
    location = /news/news.json {
        add_header Cache-Control "public, max-age=300";
    }

Danach `nginx -t` und `systemctl reload nginx`.

## 7. Cloudflare leeren, im Browser prüfen

Purge Everything. Dann prüfen: Startseite (Sektion Messe ist kurz und
verlinkt den Beitrag, Sektion „Aktuelles“ vor „Über uns“), /zelt/
(Sektion „Aktuelles“ vor dem Anfrage-Band), /news/, Beitrag, Footer.
Rich Results Test: https://search.google.com/test/rich-results mit
der Beitrags-URL (erwartet: Artikel, Veranstaltung, Navigationspfad).

## 8. Hinweisbalken umstellen (Portal)

Content → Hinweisbalken Website: Link-Ziel von `/#messe` auf
`/news/hochzeitsmesse-rosenheim-2026/` ändern.

## 9. Sync nach GitHub

    cd /home/kpssh/randl-website && git pull -q
    GIT_USER= ./tools/sync-to-github.sh
    GIT_USER= ./tools/sync-to-github.sh --apply

## Hinweise

- Nach der Messe (581, 01.12.): Der Rückbau betrifft nur Startseite und
  Hinweisbalken. `/news/hochzeitsmesse-rosenheim-2026/` bleibt. Den
  Text im Portal zum Rückblick umschreiben, die Veranstaltung
  angehakt lassen (Datum bleibt im Schema stehen).
- `/messe/`-Bilder: Der Beitrag nutzt eigene Kopien unter `news/img/`.
  Der Ordner `/messe/` kann beim Rückbau weg.
- Neue Teaser-Position oder andere Anzahl: Attribute am Marker ändern
  (`max="3"`), dann `node scripts/aktuelles.js bauen`.
- Design der News-Seiten ändern: `tools/aktuelles/vorlage.html`
  anpassen, `deploy.py --apply`, dann `node scripts/aktuelles.js bauen`.
- Slug eines veröffentlichten Beitrags ändern = neue Adresse, die alte
  liefert 404 (keine automatische Weiterleitung).
- Sicherungen der Datendatei: `cms-backups/aktuelles/` neben dem
  Portal (letzte 60 Stände), nicht im Webroot.
