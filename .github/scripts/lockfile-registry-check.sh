#!/usr/bin/env bash
# Compares the integrity of every added or changed npm-registry entry of package-lock.json with
# the integrity the npm registry publishes for that package and version. npm looks a tarball up in
# its cache by integrity first, so an entry pointing at one package with the integrity of another
# cached tarball installs the other one (seen with npm ci): the lockfile alone cannot show it.
# Prints one "!" line per mismatch, failed lookup or unreadable entry, nothing when all match.
# Run before the review, without the model and without secrets; needs network to the registry.
# Usage: lockfile-registry-check.sh old-package-lock.json new-package-lock.json
set -euo pipefail

old="$1"
new="$2"
max_lookups=300
deadline=$((SECONDS + 120))
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# key, name, version, integrity of each entry resolved on the npm registry that is added or whose
# source, integrity, version or name changed (a dev / optional / peer flag alone needs no lookup).
# Tab-separated; control characters and Unicode line separators become "?" (the summary flags
# such a key as an unusual path, and the name or version check below refuses it).
jq -n -r --slurpfile o "$old" --slurpfile n "$new" '
  def packages: if type == "object" and (.packages | type) == "object" then .packages else {} end;
  ($o[0] // {} | packages) as $a
  | ($n[0] // {} | packages) as $b
  | $b | to_entries[]
  | select((.value | type) == "object")
  | select(.value.resolved | type == "string" and startswith("https://registry.npmjs.org/"))
  | select(($a[.key] // {}) as $old
      | [$old.resolved, $old.integrity, $old.version, $old.name]
        != [.value.resolved, .value.integrity, .value.version, .value.name])
  | [.key,
     ((.value.name // (.key | sub("^.*node_modules/"; ""))) | tostring),
     (.value.version // "" | tostring),
     (.value.integrity // "" | tostring)]
  | map(gsub("[\\x00-\\x1f\\x7f\\x{85}\\x{2028}\\x{2029}]"; "?"))
  | @tsv
' > "$work/entries.tsv"

name_ok='^(@[A-Za-z0-9~-][A-Za-z0-9._~-]*/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*$'
version_ok='^[0-9A-Za-z.+-]+$'
count=0
total="$(wc -l < "$work/entries.tsv" | tr -d ' ')"

while IFS=$'\t' read -r key name version integrity; do
  count=$((count + 1))
  if [ "$count" -gt "$max_lookups" ]; then
    echo "! INTÉGRITÉ NON VÉRIFIÉE : $((total - max_lookups)) entrée(s) au-delà de $max_lookups"
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "! INTÉGRITÉ NON VÉRIFIÉE : $((total - count + 1)) entrée(s) non vérifiée(s) (délai dépassé)"
    break
  fi
  label="${key:0:300}"
  if ! [[ "$name" =~ $name_ok ]] || ! [[ "$version" =~ $version_ok ]]; then
    echo "! $label : INTÉGRITÉ NON VÉRIFIÉE (nom ou version illisible)"
    continue
  fi
  manifest="$work/manifest.json"
  if ! curl -fsS --connect-timeout 5 --max-time 15 --retry 2 --retry-max-time 20 -o "$manifest" \
    "https://registry.npmjs.org/${name/\//%2f}/$version" 2> /dev/null; then
    echo "! $label $version : INTÉGRITÉ NON VÉRIFIÉE (registre injoignable ou version inconnue)"
    continue
  fi
  published="$(jq -r '.dist.integrity // empty' "$manifest" 2> /dev/null || true)"
  shasum="$(jq -r '.dist.shasum // empty' "$manifest" 2> /dev/null || true)"
  if [ -n "$published" ] && [ "$integrity" = "$published" ]; then
    continue
  fi
  # A tarball published before integrity existed is locked with the sha1 of dist.shasum.
  if [ -n "$shasum" ] && [[ "$shasum" =~ ^[0-9a-f]{40}$ ]] \
    && [ "$integrity" = "sha1-$(printf '%b' "$(printf '%s' "$shasum" | sed 's/../\\x&/g')" | base64)" ]; then
    continue
  fi
  echo "! $label $version : INTÉGRITÉ DIFFÉRENTE DU REGISTRE (archive d'un autre paquet ou modifiée)"
done < "$work/entries.tsv"
