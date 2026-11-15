# Per-package summary of a package-lock.json change, read by the Claude review
# (.github/workflows/claude-code-review.yml), which never sees the lockfile diff.
# Usage: jq -n -r --slurpfile o old.json --slurpfile n new.json -f lockfile-summary.jq
# Lines: "+" added, "-" removed, "~" version or other fields changed, "!" source or
# integrity changed at the same version, an alias added, removed or changed on an
# existing entry, or an unreadable entry. Flags in brackets: an alias (the entry
# installs another package under this name), a source outside the npm registry, a
# registry tarball that is not the one of that package and version. Every value
# comes from the PR: control characters are replaced and each value is cut to 300
# characters, so no value can forge a line. Format lines come first, then every
# "!" or flagged line, then the rest, so the 3000-line cap never hides a flag
# before an unflagged line.

def s: tostring | gsub("[\\x00-\\x1f\\x7f]"; "?") | .[0:300];

def packages: if type == "object" and (.packages | type) == "object" then .packages else {} end;

# Name of the package installed at a lockfile key ("node_modules/a/node_modules/@s/b" -> "@s/b");
# null for the root ("") and workspace keys, which install no package by that name.
def installed_name: if contains("node_modules/") then sub("^.*node_modules/"; "") else null end;

# Flag for the source of an entry: none when it is the registry tarball of this
# package (or of the package it aliases, field "name") at this version.
def source_flag($pkg; $entry):
  $entry.resolved as $url
  | if $url == null then ""
    elif ($url | type) != "string" or ($url | startswith("https://registry.npmjs.org/") | not)
      then " [SOURCE HORS REGISTRE NPM : \($url | s)]"
    else (($entry.name // $pkg) | tostring) as $name
      | "https://registry.npmjs.org/\($name)/-/\($name | split("/") | last)-\($entry.version // "" | tostring).tgz" as $expected
      | if $url == $expected then ""
        else " [ARCHIVE NE CORRESPONDANT PAS AU PAQUET OU À SA VERSION : \($url | s)]" end
    end;

# Flag for an entry that installs another package under this name ("name" field, npm alias).
def alias_flag($pkg; $entry):
  if $pkg != null and $entry.name != null and ($entry.name | tostring) != $pkg
    then " [ALIAS DE : \($entry.name | s)]" else "" end;

def flags($pkg; $entry): "\(alias_flag($pkg; $entry))\(source_flag($pkg; $entry))";

def flagged: startswith("!") or contains(" [");

def format_lines($old; $new):
  if ($new | type) != "object" then
    "FORMAT INATTENDU : le nouveau package-lock.json n'est pas un objet JSON, à vérifier à la main."
  else
    (if ($new.lockfileVersion | IN(2, 3) | not) or (($new.packages | type) != "object") then
       "FORMAT INATTENDU (lockfileVersion \($new.lockfileVersion // "absent" | s), packages de type \($new.packages | type)) : à vérifier à la main."
     else empty end),
    (if ($old | type) == "object" and $old.lockfileVersion != $new.lockfileVersion then
       "FORMAT INATTENDU : lockfileVersion \($old.lockfileVersion // "absent" | s) -> \($new.lockfileVersion // "absent" | s)."
     else empty end)
  end;

def package_lines($old; $new):
  ($old | packages) as $a
  | ($new | packages) as $b
  | ((($a | keys) + ($b | keys)) | unique)[] as $key
  | $a[$key] as $x
  | $b[$key] as $y
  | select($x != $y)
  | (if $key == "" then "(racine)" else ($key | s) end) as $label
  | ($key | installed_name) as $pkg
  | if ($x != null and ($x | type) != "object") or ($y != null and ($y | type) != "object") then
      "! \($label) : entrée illisible"
    elif $x == null then "+ \($label) \($y.version // "?" | s)\(flags($pkg; $y))"
    elif $y == null then "- \($label) \($x.version // "?" | s)"
    elif $pkg != null and $x.name != $y.name then
      "! \($label) \($x.version // "?" | s) -> \($y.version // "?" | s) : alias ajouté, retiré ou changé\(flags($pkg; $y))"
    elif $x.version != $y.version then
      "~ \($label) \($x.version // "?" | s) -> \($y.version // "?" | s)\(flags($pkg; $y))"
    elif $x.resolved != $y.resolved or $x.integrity != $y.integrity then
      "! \($label) \($y.version // "?" | s) : source ou intégrité changée à version égale\(flags($pkg; $y))"
    else "~ \($label) \($y.version // "?" | s) : autres champs modifiés\(flags($pkg; $y))" end;

($o[0] // {}) as $old
| ($n[0] // {}) as $new
| [package_lines($old; $new)] as $packages
| ([format_lines($old; $new)] + ($packages | map(select(flagged)))) as $first
| ($first + ($packages | map(select(flagged | not)))) as $lines
| if ($lines | length) == 0 then
    "package-lock.json modifié hors des paquets (champs de premier niveau) : à vérifier à la main."
  elif ($lines | length) > 3000 then
    ($lines[0:3000][],
     "[… résumé tronqué : \(($lines | length) - 3000) ligne(s) de plus, dont \([($first | length) - 3000, 0] | max) signalée(s)]")
  else $lines[] end
