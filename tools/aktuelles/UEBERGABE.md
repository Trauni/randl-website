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
    cd /home/kpssh/randl-website && git pull -q
    cd tools/aktuelles
    python3 deploy.py

Erwartung: 4 Seiten `PATCH` (teaser-css=todo, teaser-marker=todo),
`news/.vorlage.html` = `neu`, footer-link und messe-rueckbau
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

## 4. Website, Durchgang 2 (Footer-Link, Messe-Rückbau)

    cd /home/kpssh/randl-website/tools/aktuelles
    python3 deploy.py
    BACKUP_ROOT=/home/kpssh/backups python3 deploy.py --apply
    cd /home/radmin/web/randlweb.de/public_html/portal
    node scripts/aktuelles.js bauen
    cd /home/kpssh/randl-website/tools/aktuelles && python3 deploy.py

Erwartung: 12 Seiten `PATCH` (footer-link=todo), index.html dazu
messe-rueckbau=todo mit rund 330 Zeilen weniger. `bauen` füllt den
neuen Marker für die Kachel oben. Letzter Lauf: „Nichts zu tun.“

    P=/home/radmin/web/randl.group/public_html
    grep -c 'MESSE-2026\|data-messe\|id="messe' $P/index.html
    grep -c 'h-tile--akt\|class="akt-card"' $P/index.html

Erwartung: 0 und 2. Rückgängig (Ordnername steht in der Ausgabe von
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

## 6. nginx: 301 für deaktivierte Beiträge, Caching

Erst ansehen, nicht blind ändern. Die Ausgabe bitte an Claude geben,
der Block unten wird dann an die vorhandene Konfiguration angepasst:

    D=/home/radmin/conf/web/randl.group
    cat $D/nginx.ssl.conf_imgcache
    grep -n 'root\|proxy_pass\|error_page' $D/nginx.ssl.conf
    curl -sI https://randl.group/news/gibtsnicht/ | head -5

Stand 24.11.2026: Eine nicht vorhandene Adresse liefert 302 auf die
Startseite. Gewünscht ist 301 auf /news/. Vorschlag (gilt nur, wenn
nginx die HTML-Dateien selbst ausliefert, also kein `proxy_pass` für
Seiten; sonst kommt die Regel in die Apache-Konfiguration):

    location ~ ^/news/[a-z0-9-]+/?$ {
        root /home/radmin/web/randl.group/public_html;
        try_files $uri $uri/index.html @news_archiv;
    }
    location @news_archiv {
        return 301 /news/;
    }
    location /news/img/ {
        expires 30d;
    }
    location = /news/news.json {
        add_header Cache-Control "public, max-age=300";
    }

Die Regel gilt für jede nicht vorhandene Adresse /news/<name>/, also
auch für deaktivierte und gelöschte Beiträge, Entwürfe und Tippfehler.
Bilder unter /news/img/ ändern ihren Namen bei neuem Inhalt (Hash).
Beide Dateien anpassen (`nginx.conf_imgcache` und
`nginx.ssl.conf_imgcache`), vorher je eine Kopie `*.bak-20261124`.
Danach `nginx -t`, `systemctl reload nginx` und prüfen:

    curl -sI https://randl.group/news/gibtsnicht/ | head -5
    curl -sI https://randl.group/news/ | head -3

Erwartung: 301 mit `location: https://randl.group/news/`, dann 200.

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

    cd /home/kpssh/randl-website && git pull -q
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
