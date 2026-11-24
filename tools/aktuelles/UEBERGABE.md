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
  Marker und Footer-Link und baut die Messe-Bausteine MESSE-2026-v1
  auf der Startseite zurück (581).
- Archiv und Startseite sind getrennt: Ein veröffentlichter Beitrag
  bleibt unter /news/, bis er deaktiviert wird. Teaser (Startseite,
  Sparten-Seite, Kachel oben auf der Startseite) zeigen nur Beiträge
  mit „Auf Startseite“ und laufen mit „Auf Startseite bis“ ab: Der
  Browser blendet sie pünktlich aus (`data-bis`), der stündliche Cron
  (Abschnitt 7) nimmt sie danach aus dem HTML.
- Deaktiviert oder gelöscht: Ordner `news/<slug>/` ist weg, nginx
  leitet die Adresse per 301 auf /news/ um (Abschnitt 6).

## 1. Portal deployen (nach Merge des PR feat/aktuelles)

    cd /home/radmin/web/randlweb.de/public_html/portal
    git pull
    npm --prefix client run build
    pm2 restart randlweb-portal
    pm2 logs randlweb-portal --lines 30 --nostream

Keine DB-Migration, keine neuen Pakete.

## 2. Website, Durchgang 1 (Vorlage, CSS, Marker)

    find /home/radmin/web/randl.group/public_html -name '*.bak*'
    cd /root/randl-website && git pull -q
    cd tools/aktuelles
    python3 deploy.py

Erwartung: 4 Seiten `PATCH` (teaser-css=todo, teaser-marker=todo),
`news/.vorlage.html` = `neu`, footer-link und messe-rueckbau
= `wartet`. Dann:

    BACKUP_ROOT=/home/kpssh/backups python3 deploy.py --apply

## 3. Messe-Beitrag anlegen und bauen

    cd /home/radmin/web/randlweb.de/public_html/portal
    J=/root/randl-website/tools/aktuelles/messe-beitrag.json
    node scripts/aktuelles.js import $J
    node scripts/aktuelles.js liste

Erwartung: 8 Bilder nach `news/img/`, „Angelegt: Hochzeitsmesse
Rosenheim 2026 (veroeffentlicht)“, Build ohne WARNUNG. Der Beitrag
steht danach im Portal und wird dort weiter gepflegt.

## 4. Website, Durchgang 2 (Footer-Link, Messe-Rückbau)

    cd /root/randl-website/tools/aktuelles
    python3 deploy.py
    BACKUP_ROOT=/home/kpssh/backups python3 deploy.py --apply
    cd /home/radmin/web/randlweb.de/public_html/portal
    node scripts/aktuelles.js bauen
    cd /root/randl-website/tools/aktuelles && python3 deploy.py

Erwartung: 12 Seiten `PATCH` (footer-link=todo), index.html dazu
messe-rueckbau=todo mit rund 330 Zeilen weniger. `bauen` füllt den
neuen Marker für die Kachel oben. Letzter Lauf: „Nichts zu tun.“

    P=/home/radmin/web/randl.group/public_html
    grep -c 'MESSE-2026\|data-messe\|id="messe' $P/index.html
    grep -c 'h-tile--akt\|class="akt-card"' $P/index.html

Erwartung: 0 und 6 (Kachel, Karte, vier CSS-Zeilen). Rückgängig (Ordnername steht in der Ausgabe von
`--apply`, Zeile „Rueckgaengig:“, den ganzen Befehl von dort kopieren).

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

## 6. nginx: 301 für deaktivierte Beiträge, Punkt-Dateien sperren

Die Regeln stehen in `tools/aktuelles/nginx-aktuelles.conf` und kommen
als eigene Datei neben die vorhandenen Includes (nichts Bestehendes
wird geändert, rückgängig = Datei löschen):

    D=/home/radmin/conf/web/randl.group
    grep -n 'include' $D/nginx.ssl.conf $D/nginx.conf
    S=/root/randl-website/tools/aktuelles/nginx-aktuelles.conf
    cp $S $D/nginx.ssl.conf_aktuelles
    cp $S $D/nginx.conf_aktuelles
    nginx -t && systemctl reload nginx

Wichtig: Includes laufen über `nginx.ssl.conf_*`. Sicherungen von
nginx-Dateien deshalb nie als `*.bak-…` in diesen Ordner legen,
sie würden mitgeladen. Prüfen:

    U=https://randl.group
    curl -sI $U/news/gibtsnicht/ | grep -i '^HTTP\|^location'
    curl -s -o /dev/null -w '%{http_code}\n' $U/news/.vorlage.html
    curl -s -o /dev/null -w '%{http_code}\n' $U/news/.beitraege.json
    B=$U/news/hochzeitsmesse-rosenheim-2026/
    curl -sI $B | grep -i '^HTTP\|cache-control'

Erwartung: 301 mit `location: https://randl.group/news/`, zweimal
404 (oder 302 auf die Startseite), 200 mit `no-cache`.

## 7. Cron: abgelaufene Teaser stündlich aus dem HTML nehmen

Gleiche root-Crontab wie der Galerie-Lauf (590, 03:30), kein zweites
System. Der Lauf schreibt nur, wenn sich etwas ändert, und meldet nur
Warnungen:

    crontab -l
    N=$(which node)
    P=/home/radmin/web/randlweb.de/public_html/portal
    L=/var/log/aktuelles.log
    Z="1 * * * * cd $P && $N scripts/aktuelles.js bauen --still"
    (crontab -l; echo "$Z >> $L 2>&1") | crontab -
    crontab -l | tail -3

Pünktlich ist der Browser (Teaser tragen `data-bis`), der Cron räumt
spätestens zur Minute 1 der nächsten Stunde das HTML auf.

## 8. Cloudflare leeren, im Browser prüfen

Purge Everything. Dann prüfen: Startseite (Kachel „Aktuell“ oben
statt der Messe-Kachel, keine Sektion Messe mehr, Sektion „Aktuelles“
vor „Über uns“, in den FAQ keine Messe-Frage), /zelt/ (Sektion
„Aktuelles“ vor dem Anfrage-Band), /news/, Beitrag samt Bildern,
Footer. Rich Results Test:
https://search.google.com/test/rich-results mit der Beitrags-URL
(erwartet: Artikel, Veranstaltung, Navigationspfad).

Abnahme Ablauf: im Portal einen Testbeitrag veröffentlichen mit
„Auf Startseite bis“ = jetzt + 5 Minuten, Startseite offen lassen.
Der Teaser verschwindet zur Minute ohne Neuladen, /news/<slug>/
bleibt. Danach den Testbeitrag deaktivieren: Adresse liefert 301.
Zum Schluss löschen.

## 9. Hinweisbalken umstellen (Portal)

Content → Hinweisbalken Website: Link-Ziel von `/#messe` auf
`/news/hochzeitsmesse-rosenheim-2026/` ändern (den Anker `#messe`
gibt es nicht mehr). Der Balken endet am 29.11. 18:00 von selbst.

## 10. Rest aus 581 (löschen erst nach Rückfrage)

Nur anzeigen:

    ls -la /home/radmin/conf/web/randl.group/ | grep -i vorMesse
    ls -d /home/kpssh/backups/messe-2026-*

Nicht löschen: `public_html/messe/`, die nginx-Regel `|messe`, den
Bilder-Tab „Messe“.

## 11. Sync nach GitHub

    cd /root/randl-website && git pull -q
    GIT_USER= ./tools/sync-to-github.sh
    GIT_USER= ./tools/sync-to-github.sh --apply

## Hinweise

- Nach der Messe: Die Teaser laufen am 29.11. 18:00 von selbst ab.
  `/news/hochzeitsmesse-rosenheim-2026/` bleibt. Den Text im Portal
  zum Rückblick umschreiben, die Veranstaltung angehakt lassen (Datum
  bleibt im Schema stehen).
- `/messe/`-Bilder: Der Beitrag nutzt eigene Kopien unter `news/img/`.
  Der Ordner `/messe/` bleibt trotzdem stehen (Vorgabe aus 581).
- Kachel oben auf der Startseite: zeigt den neuesten Beitrag mit
  „Auf Startseite“. Ohne solchen Beitrag ist dort nichts.
- Neue Teaser-Position oder andere Anzahl: Attribute am Marker ändern
  (`max="3"`), dann `node scripts/aktuelles.js bauen`.
- Design der News-Seiten ändern: `tools/aktuelles/vorlage.html`
  anpassen, `deploy.py --apply`, dann `node scripts/aktuelles.js bauen`.
- Slug eines veröffentlichten Beitrags ändern = neue Adresse, die alte
  leitet mit der Regel aus Abschnitt 6 auf /news/ um.
- Sicherungen der Datendatei: `cms-backups/aktuelles/` neben dem
  Portal (letzte 60 Stände), nicht im Webroot.
