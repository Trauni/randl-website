#!/usr/bin/env python3
"""Aktuelles (/news/): idempotenter Patch fuer randl.group. Marker AKTUELLES-v1.

  python3 deploy.py                     Trockenlauf (schreibt nichts)
  python3 deploy.py --apply             Backup -> Patch -> Verifikation
  python3 deploy.py --rollback <ordner> Backup zurueckspielen

Umgebung: WEBROOT (Default /home/radmin/web/randl.group/public_html),
          BACKUP_ROOT (Default ~/backups).
Nur Standardbibliothek. Ganze Dateien werden nie ersetzt (ausser der
Vorlage news/.vorlage.html): nur Textersetzung mit eindeutigen Ankern.

Zwei Durchgaenge, weil die Seiten unter /news/ erst das Portal erzeugt:
  1. Vorlage, Teaser-CSS und Teaser-Marker (Startseite, /zelt/, /metall/,
     /gas/). Danach im Portal-Ordner: node scripts/aktuelles.js import ...
  2. Footer-Link "Aktuelles" (wartet auf news/index.html) und der Rueckbau
     der Messe-Bausteine MESSE-2026-v1 auf der Startseite (wartet auf den
     Messe-Beitrag; OpenProject 581). An die Stelle der Messe-Kachel kommt
     der Marker fuer die Hero-Kachel. Danach: node scripts/aktuelles.js bauen
"""
import difflib
import json
import os
import shutil
import sys
import time
from collections import Counter
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
WEBROOT = os.environ.get(
    "WEBROOT", "/home/radmin/web/randl.group/public_html")
BACKUP_ROOT = os.environ.get(
    "BACKUP_ROOT", os.path.join(os.path.expanduser("~"), "backups"))
M = "AKTUELLES-v1"
MESSE_SLUG = "hochzeitsmesse-rosenheim-2026"

FOOTER_PAGES = [
    "index.html", "zelt/index.html", "gas/index.html", "metall/index.html",
    "fotobox/index.html", "kontakt/index.html", "impressum/index.html",
    "datenschutz/index.html", "zelt/formular/index.html",
    "metall/formular/index.html", "gas/formular/index.html",
    "zelt/galerie/index.html",
]
# Seite -> (Anker, vor dem der Teaser-Block eingesetzt wird, Marker-Attribute)
TEASER = {
    "index.html": (
        '<section class="content-section" id="ueber-uns">\n',
        'sparte="alle" layout="start" max="3"'),
    "zelt/index.html": (
        '  <section class="cta-band">\n',
        'sparte="zelt" layout="sparte" klasse="section section-alt" max="3"'),
    "metall/index.html": (
        '  <section class="cta-band">\n',
        'sparte="maschinenbau" layout="sparte" klasse="section" max="3"'),
    "gas/index.html": (
        '  <section class="cta-band">\n',
        'sparte="gas" layout="sparte" klasse="section" max="3"'),
}
STYLE_END = "</style>\n"
FOOTER_OLD = '    <a href="/kontakt">Kontakt</a>\n'
FOOTER_NEW = '    <a href="/news/">Aktuelles</a>\n' + FOOTER_OLD
MM = "MESSE-2026-v1"
KACHEL = ('<!-- AKTUELLES:START sparte="alle" layout="kachel" max="1" -->\n'
          '    <!-- AKTUELLES:END -->')


class Abort(Exception):
    pass


def read(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def read_b(path):
    with open(path, "rb") as f:
        return f.read()


def frag(name):
    return read(os.path.join(HERE, name))


def once(text, anchor, name):
    n = text.count(anchor)
    if n != 1:
        raise Abort("%s: Anker kommt %dx vor (erwartet 1x)" % (name, n))


# ---------------------------------------------------------------- Schritte
def step_css(text):
    css = frag("aktuelles.css").rstrip("\n") + "\n"
    if css.strip("\n") in text:
        return text, "done"
    if "/* %s begin */" % M in text:
        raise Abort("teaser-css: Marker vorhanden, Block weicht ab")
    once(text, STYLE_END, "teaser-css")
    return text.replace(STYLE_END, css + STYLE_END, 1), "todo"


def step_marker(text, rel):
    anchor, attrs = TEASER[rel]
    start = "<!-- AKTUELLES:START %s -->" % attrs
    if start in text:
        return text, "done"
    if '<!-- AKTUELLES:START' in text and 'layout="%s"' % (
            "start" if rel == "index.html" else "sparte") in text:
        raise Abort("teaser-marker: Marker mit anderen Attributen")
    once(text, anchor, "teaser-marker")
    block = start + "\n<!-- AKTUELLES:END -->\n\n"
    return text.replace(anchor, block + anchor, 1), "todo"


def step_footer(text):
    if '<a href="/news/">Aktuelles</a>' in text:
        return text, "done"
    if not os.path.isfile(os.path.join(WEBROOT, "news", "index.html")):
        return text, "wartet"
    once(text, FOOTER_OLD, "footer-link")
    return text.replace(FOOTER_OLD, FOOTER_NEW, 1), "todo"


def cut(text, begin, end, name, repl=""):
    """Ersetzt den Bereich begin..end (einschliesslich) samt Zeilenende."""
    once(text, begin, name)
    a = text.index(begin)
    b = text.find(end, a)
    if b < 0:
        raise Abort("%s: Ende-Marker fehlt" % name)
    b += len(end)
    if not repl:
        a = text.rfind("\n", 0, a) + 1          # Einrueckung mitnehmen
        while text[b:b + 1] == "\n":            # Leerzeilen danach auch
            b += 1
    return text[:a] + repl + text[b:]


def step_messe(text):
    """Rueckbau MESSE-2026-v1 (581): Kachel -> Marker fuer die Hero-Kachel,
    Sektion, FAQ-Frage, CSS und Lightbox-JS entfallen."""
    if MM not in text and "data-messe-bis" not in text:
        return text, ("done" if KACHEL in text else "entfaellt")
    post = os.path.join(WEBROOT, "news", MESSE_SLUG, "index.html")
    if not os.path.isfile(post):
        return text, "wartet"
    n = "messe-rueckbau"
    t = cut(text, "<!-- %s tile begin -->" % MM,
            "<!-- %s tile end -->" % MM, n, KACHEL)
    t = cut(t, "<!-- %s section begin -->" % MM,
            "<!-- %s section end -->" % MM, n)
    t = cut(t, "<!-- %s faq begin -->" % MM, "<!-- %s faq end -->" % MM, n)
    t = cut(t, "/* %s begin */" % MM, "/* %s end */" % MM, n)
    js = "<script>\n/* %s " % MM
    t = cut(t, js, "</script>", n)
    once(t, "/* %s */" % MM, n)
    t = t.replace("/* %s */" % MM, "/* %s */" % M, 1)
    if MM in t or "data-messe-bis" in t or 'id="messe' in t:
        raise Abort("%s: Reste von %s gefunden" % (n, MM))
    return t, "todo"


# ------------------------------------------------------------ Verifikation
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}
OPTIONAL = {"p", "li", "dt", "dd", "tr", "td", "th", "option"}


class Balance(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.delta = Counter()

    def handle_starttag(self, tag, attrs):
        if tag not in VOID and tag not in OPTIONAL:
            self.delta[tag] += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag not in VOID and tag not in OPTIONAL:
            self.delta[tag] -= 1


def balance(text):
    p = Balance()
    p.feed(text)
    p.close()
    return {k: v for k, v in p.delta.items() if v}


# --------------------------------------------------------------- Planung
def plan():
    """Berechnet alles, schreibt nichts. Gibt (items, fehler) zurueck."""
    items, errors = [], []
    for rel in FOOTER_PAGES:
        path = os.path.join(WEBROOT, rel)
        if not os.path.isfile(path):
            errors.append("%s: Datei fehlt" % rel)
            continue
        old = read(path)
        new, notes = old, []
        try:
            if rel in TEASER:
                new, s = step_css(new)
                notes.append(("teaser-css", s))
                new, s = step_marker(new, rel)
                notes.append(("teaser-marker", s))
            if rel == "index.html":
                new, s = step_messe(new)
                notes.append(("messe-rueckbau", s))
            new, s = step_footer(new)
            notes.append(("footer-link", s))
            if new != old and balance(old) != balance(new):
                raise Abort("Tag-Balance geaendert: %s -> %s"
                            % (balance(old), balance(new)))
        except Abort as e:
            errors.append("%s: %s" % (rel, e))
            continue
        items.append({"kind": "page", "rel": rel, "path": path,
                      "old": old, "new": new, "notes": notes})
    src = os.path.join(HERE, "vorlage.html")
    dst = os.path.join(WEBROOT, "news", ".vorlage.html")
    if not os.path.exists(dst):
        st = "neu"
    elif read_b(dst) != read_b(src):
        st = "aendern"
    else:
        st = "vorhanden"
    items.append({"kind": "file", "rel": "news/.vorlage.html", "src": src,
                  "path": dst, "state": st})
    return items, errors


def changed(it):
    if it["kind"] == "page":
        return it["new"] != it["old"]
    return it["state"] in ("neu", "aendern")


def waiting(items):
    return any(s == "wartet" for it in items if it["kind"] == "page"
               for _, s in it["notes"])


def diff_size(old, new):
    plus = minus = 0
    for ln in difflib.unified_diff(old.splitlines(), new.splitlines(),
                                   lineterm="", n=0):
        if ln.startswith("+") and not ln.startswith("+++"):
            plus += 1
        elif ln.startswith("-") and not ln.startswith("---"):
            minus += 1
    return "+%d/-%d Zeilen" % (plus, minus)


def report(items, errors):
    for it in items:
        if it["kind"] == "page":
            marks = ", ".join("%s=%s" % (n, s) for n, s in it["notes"])
            flag = "PATCH" if changed(it) else "nichts zu tun"
            print("%-28s %-14s %s" % (it["rel"], flag,
                                      diff_size(it["old"], it["new"])))
            print("    " + marks)
        else:
            print("%-28s %s" % (it["rel"], it["state"]))
    for e in errors:
        print("FEHLER: " + e)


# ------------------------------------------------------------- Schreiben
def set_owner(path, uid, gid):
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        os.chown(path, uid, gid)


def write_atomic(path, data, mode, uid, gid):
    tmp = os.path.join(os.path.dirname(path),
                       ".aktuelles-tmp-%d" % os.getpid())
    try:
        with open(tmp, "wb") as f:
            f.write(data)
        os.chmod(tmp, mode)
        set_owner(tmp, uid, gid)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def apply(items):
    ts = time.strftime("%Y%m%d-%H%M%S")
    bdir = os.path.join(BACKUP_ROOT, "aktuelles-" + ts)
    os.makedirs(bdir, exist_ok=False)
    manifest = {"webroot": WEBROOT, "saved": [], "created": []}
    ref = os.stat(os.path.join(WEBROOT, "index.html"))
    for it in items:
        if not changed(it):
            continue
        p = it["path"]
        if os.path.exists(p):
            b = os.path.join(bdir, it["rel"])
            os.makedirs(os.path.dirname(b), exist_ok=True)
            shutil.copy2(p, b)
            manifest["saved"].append(it["rel"])
        else:
            manifest["created"].append(it["rel"])
    with open(os.path.join(bdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print("Backup: " + bdir)

    for it in items:
        if not changed(it):
            continue
        p = it["path"]
        if os.path.exists(p):
            st = os.stat(p)
            mode, uid, gid = st.st_mode & 0o777, st.st_uid, st.st_gid
        else:
            mode, uid, gid = ref.st_mode & 0o777, ref.st_uid, ref.st_gid
            d = os.path.dirname(p)
            if not os.path.isdir(d):
                os.makedirs(d)
                os.chmod(d, os.stat(WEBROOT).st_mode & 0o777)
                set_owner(d, uid, gid)
        if it["kind"] == "page":
            data = it["new"].encode("utf-8")
        else:
            data = read_b(it["src"])
        write_atomic(p, data, mode, uid, gid)
        print("geschrieben: " + it["rel"])
    return bdir


def verify():
    problems = []
    for dp, _, fns in os.walk(WEBROOT):
        for fn in fns:
            if ".bak" in fn or fn.endswith("~") or "-tmp-" in fn:
                problems.append("Backup-/Temp-Datei im Webroot: "
                                + os.path.join(dp, fn))
    for rel in TEASER:
        t = read(os.path.join(WEBROOT, rel))
        for needle in ("/* %s begin */" % M, "/* %s end */" % M):
            if t.count(needle) != 1:
                problems.append("%s: %r %dx (erwartet 1x)"
                                % (rel, needle, t.count(needle)))
        if t.count("<!-- AKTUELLES:START") != t.count(
                "<!-- AKTUELLES:END -->") or "<!-- AKTUELLES:START" not in t:
            problems.append("%s: Marker AKTUELLES:START/END unpaarig" % rel)
    if not os.path.isfile(os.path.join(WEBROOT, "news", ".vorlage.html")):
        problems.append("fehlt: news/.vorlage.html")
    return problems


def rollback(bdir):
    mf = os.path.join(bdir, "manifest.json")
    if not os.path.isfile(mf):
        sys.exit("Kein manifest.json in " + bdir)
    with open(mf) as f:
        m = json.load(f)
    if m.get("webroot") != WEBROOT:
        print("Hinweis: Backup stammt von %s, Ziel ist %s"
              % (m.get("webroot"), WEBROOT))
    for rel in m["saved"]:
        dst = os.path.join(WEBROOT, rel)
        st = os.stat(dst) if os.path.exists(dst) else None
        mode = os.stat(os.path.join(bdir, rel)).st_mode & 0o777
        write_atomic(dst, read_b(os.path.join(bdir, rel)), mode,
                     st.st_uid if st else os.getuid(),
                     st.st_gid if st else os.getgid())
        print("zurueck: " + rel)
    for rel in m["created"]:
        p = os.path.join(WEBROOT, rel)
        if os.path.exists(p):
            os.remove(p)
            print("entfernt: " + rel)
    print("Hinweis: Seiten unter /news/ erzeugt das Portal. Nach einem "
          "Rollback dort 'node scripts/aktuelles.js bauen' ausfuehren "
          "oder den Ordner news/ von Hand entfernen.")


def main(argv):
    if not os.path.isdir(WEBROOT):
        sys.exit("WEBROOT nicht gefunden: " + WEBROOT)
    if len(argv) == 3 and argv[1] == "--rollback":
        rollback(argv[2])
        return 0
    do_apply = len(argv) == 2 and argv[1] == "--apply"
    if len(argv) > 1 and not do_apply:
        sys.exit(__doc__)
    items, errors = plan()
    report(items, errors)
    if errors:
        print("\nAbbruch: Fehler oben beheben, nichts geschrieben.")
        return 1
    todo = [it for it in items if changed(it)]
    hint = ("\nNoch offen (wartet): erst im Portal-Ordner den Beitrag "
            "importieren bzw. bauen, dann deploy.py erneut ausfuehren.")
    after = ("\nJetzt im Portal-Ordner: node scripts/aktuelles.js bauen "
             "(fuellt die neuen Marker).")
    if not todo:
        print("\nNichts zu tun." + (hint if waiting(items) else ""))
        return 0
    if not do_apply:
        print("\nTrockenlauf: %d Datei(en) wuerden geaendert. "
              "Mit --apply ausfuehren." % len(todo))
        return 0
    bdir = apply(items)
    problems = verify()
    if problems:
        print("\nVERIFIKATION FEHLGESCHLAGEN:")
        for p in problems:
            print("  - " + p)
        print("Rueckgaengig: python3 deploy.py --rollback " + bdir)
        return 1
    print("\nFertig. Rueckgaengig: python3 deploy.py --rollback " + bdir)
    print(after)
    items, _ = plan()
    if waiting(items):
        print(hint)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
