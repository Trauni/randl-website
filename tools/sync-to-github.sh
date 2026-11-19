#!/usr/bin/env bash
# Spiegelt den Server-Webroot in dieses Git-Repo und pusht nach GitHub (Variante B:
# Server = Quelle, Repo = Snapshot mit Historie).
#
# Aufruf (als root, weil public_html radmin gehört und für kpssh nicht lesbar ist):
#   sudo tools/sync-to-github.sh            Trockenlauf: zeigt nur, was sich ändern würde
#   sudo tools/sync-to-github.sh --apply    kopieren, committen, pushen
#
# Einstellbar per Umgebungsvariable:
#   SRC       Webroot            (Default /home/radmin/web/randl.group/public_html)
#   GIT_USER  Benutzer für git   (Default kpssh; leer = aktueller Benutzer)
#   SSH_KEY   Deploy-Key         (Default ~GIT_USER/.ssh/randl-website-deploy)
#   MAX_DEL   Abbruch, wenn mehr Dateien gelöscht würden (Default 15; FORCE=1 hebt auf)
#
# Cron (root, täglich 03:15):
#   15 3 * * * /home/kpssh/randl-website/tools/sync-to-github.sh --apply >> /var/log/randl-sync.log 2>&1
set -euo pipefail

SRC="${SRC:-/home/radmin/web/randl.group/public_html}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
GIT_USER="${GIT_USER-kpssh}"
MAX_DEL="${MAX_DEL:-15}"
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1

command -v rsync >/dev/null || { echo "rsync fehlt (apt install rsync)"; exit 1; }
[ -f "$SRC/index.html" ] || { echo "ABBRUCH: $SRC/index.html nicht gefunden (falscher Pfad?)"; exit 1; }
[ -d "$REPO/.git" ] || { echo "ABBRUCH: $REPO ist kein Git-Repo"; exit 1; }

git_run() {
  if [ -n "$GIT_USER" ]; then
    local key="${SSH_KEY:-$(getent passwd "$GIT_USER" | cut -d: -f6)/.ssh/randl-website-deploy}"
    runuser -u "$GIT_USER" -- env GIT_SSH_COMMAND="ssh -i $key -o IdentitiesOnly=yes" \
      git -C "$REPO" -c user.name='randl-website sync' -c user.email='randl-sync@localhost' "$@"
  else
    git -C "$REPO" -c user.name='randl-website sync' -c user.email='randl-sync@localhost' "$@"
  fi
}

# Nie ins Repo; Dateien, die nur im Repo existieren, werden vor --delete geschützt.
RSYNC_OPTS=(-rlp --checksum --delete --itemize-changes
  --exclude='.git/' --exclude='system/' --exclude='private/' --exclude='node_modules/'
  --exclude='.env' --exclude='*.env' --exclude='*.bak' --exclude='*.bak.*' --exclude='*.bak-*'
  --exclude='*.old' --exclude='*.orig' --exclude='*.bk' --exclude='*~' --exclude='.DS_Store'
  --exclude='/README.md' --exclude='/.gitignore' --exclude='/tools/'
  --exclude='/zelt/galerie/img/')

echo "== Änderungen Server -> Repo:"
CHANGES="$(rsync "${RSYNC_OPTS[@]}" --dry-run "$SRC"/ "$REPO"/ | grep -v '^\.' || true)"
if [ -n "$CHANGES" ]; then
  echo "$CHANGES" | head -25
  TOTAL=$(printf '%s\n' "$CHANGES" | wc -l)
  [ "$TOTAL" -gt 25 ] && echo "... und $((TOTAL - 25)) weitere"
else
  echo "keine"
fi
DELETES=$(printf '%s\n' "$CHANGES" | grep -c '^\*deleting' || true)
if [ "$DELETES" -gt "$MAX_DEL" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "ABBRUCH: $DELETES Dateien würden gelöscht (Limit $MAX_DEL). Mit FORCE=1 trotzdem."; exit 1
fi
[ $APPLY -eq 1 ] || { echo; echo "Trockenlauf – mit --apply ausführen."; exit 0; }
[ -n "$CHANGES" ] || { echo "Nichts zu tun."; exit 0; }

rsync "${RSYNC_OPTS[@]}" "$SRC"/ "$REPO"/ >/dev/null
[ -n "$GIT_USER" ] && chown -R "$GIT_USER": "$REPO" 2>/dev/null || true

git_run add -A
if git_run diff --cached --quiet; then echo "Keine Änderungen für Git."; exit 0; fi
N=$(git_run diff --cached --name-only | wc -l)
git_run commit -q -m "Sync Webroot $(date +%Y-%m-%d\ %H:%M): $N Datei(en) geändert"
git_run push -q origin HEAD
echo "Gepusht: $(git_run log --oneline -1)"
