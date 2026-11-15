# Per-package summary of a package-lock.json change, read by the Claude review
# (.github/workflows/claude-code-review.yml), which never sees the lockfile diff.
# Usage: jq -n -r --slurpfile o old.json --slurpfile n new.json -f lockfile-summary.jq
# Lines: "+" added, "-" removed, "~" version or other fields changed, "!" source or
# integrity changed at the same version, an alias added, removed or changed on an
# existing entry, or an unreadable entry. Flags in brackets: an entry key that is not
# a plain node_modules package path (npm normalises such a key, e.g. one holding "#"
# and "..", onto another install path), an alias (the entry installs another package
# under this name), a source outside the npm registry, a registry tarball that is not
# the one of that package and version. Every value comes from the PR: control
# characters and Unicode line separators are replaced and each value is cut to 300
# characters, so no value can forge a line. Format lines come first, then every
# "!" or flagged line, then the rest, so the 3000-line cap never hides a flag
# before an unflagged line.

def s: tostring | gsub("[\\x00-\\x1f\\x7f\\x{85}\\x{2028}\\x{2029}]"; "?") | .[0:300];

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

# Flag for a key other than the root that is not a plain package path: node_modules/<name>,
# possibly scoped, possibly nested; no ".", "..", "#", "?", "%", space or empty segment.
def path_flag($key):
  if $key == ""
    or ($key | test("^node_modules/(@[A-Za-z0-9~-][A-Za-z0-9._~-]*/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*(/node_modules/(@[A-Za-z0-9~-][A-Za-z0-9._~-]*/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*)*\\z"))
    then "" else " [CHEMIN D'ENTRÉE INHABITUEL]" end;

# Fields npm reads at install time beyond name, version and source: they decide which files are
# linked into node_modules/.bin, which nested packages are installed, and whether a failed optional
# package is removed (npm then deletes its folder, up to the whole project when a regular
# dependency leads to it). `optional` alone is computed by npm and toggles with the graph: it
# matters only on a platform package (os / cpu / libc).
def install_fields:
  ["bin", "bundleDependencies", "bundledDependencies", "inBundle", "optional", "os", "cpu",
   "libc", "link", "hasShrinkwrap", "hasInstallScript"];

# Maps copied from the published package.json: at the same version they never change.
def dependency_maps: ["dependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta"];

def platform($entry): $entry != null and ($entry.os // $entry.cpu // $entry.libc) != null;

def bin_names($entry):
  $entry.bin | if type == "object" then keys elif . == null then [] else [tostring] end;

# Added entry: bin, bundled dependencies, a shrinkwrap, or an optional platform package that no
# entry declares as optional. New version: only a change of the commands it links (the tarball is
# checked against the registry). Same version: every install field (optional only on a platform
# package).
def install_flag($old; $entry; $pkg; $optional_names):
  if $old == null then
    ([("bin", "bundleDependencies", "bundledDependencies", "hasShrinkwrap") as $f
      | select($entry[$f] != null) | $f]
     + (if $entry.optional == true and platform($entry) and ($optional_names | index($pkg)) == null
        then ["optional non déclarée"] else [] end)) as $set
    | if ($set | length) == 0 then ""
      else " [CHAMPS D'INSTALLATION : \($set | join(", "))\(
        if $entry.bin != null then " ; bin : \(bin_names($entry) | join(", ") | s)" else "" end)]"
      end
  elif $old.version != $entry.version then
    if (bin_names($old) | sort) == (bin_names($entry) | sort) then ""
    else " [CHAMPS D'INSTALLATION MODIFIÉS : bin ; bin : \(bin_names($entry) | join(", ") | s)]" end
  else
    ([install_fields[] as $f
      | select($old[$f] != $entry[$f])
      | select($f != "optional" or platform($old) or platform($entry))
      | $f]) as $changed
    | if ($changed | length) == 0 then ""
      else " [CHAMPS D'INSTALLATION MODIFIÉS : \($changed | join(", "))\(
        if $old.bin != $entry.bin then " ; bin : \(bin_names($entry) | join(", ") | s)" else "" end)]"
      end
  end;

# Same version, changed dependency map of an installed package: npm then prunes or links another
# copy than the lockfile shows.
def dependency_flag($old; $entry; $pkg):
  if $pkg == null or $old == null or $old.version != $entry.version then ""
  else
    ([dependency_maps[] as $f | select($old[$f] != $entry[$f]) | $f]) as $changed
    | if ($changed | length) == 0 then ""
      else " [DÉPENDANCES MODIFIÉES À VERSION ÉGALE : \($changed | join(", "))]" end
  end;

def flags($key; $pkg; $old; $entry; $optional_names):
  "\(path_flag($key))\(alias_flag($pkg; $entry))\(source_flag($pkg; $entry))\(
    install_flag($old; $entry; $pkg; $optional_names))\(dependency_flag($old; $entry; $pkg))";

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
  | ([$b[] | objects | (.optionalDependencies // {}) | keys[]] | unique) as $optional_names
  | ((($a | keys) + ($b | keys)) | unique)[] as $key
  | $a[$key] as $x
  | $b[$key] as $y
  | select($x != $y)
  | (if $key == "" then "(racine)" else ($key | s) end) as $label
  | ($key | installed_name) as $pkg
  | if ($x != null and ($x | type) != "object") or ($y != null and ($y | type) != "object") then
      "! \($label) : entrée illisible"
    elif $x == null then "+ \($label) \($y.version // "?" | s)\(flags($key; $pkg; $x; $y; $optional_names))"
    elif $y == null then "- \($label) \($x.version // "?" | s)"
    elif $pkg != null and $x.name != $y.name then
      "! \($label) \($x.version // "?" | s) -> \($y.version // "?" | s) : alias ajouté, retiré ou changé\(flags($key; $pkg; $x; $y; $optional_names))"
    elif $x.version != $y.version then
      "~ \($label) \($x.version // "?" | s) -> \($y.version // "?" | s)\(flags($key; $pkg; $x; $y; $optional_names))"
    elif $x.resolved != $y.resolved or $x.integrity != $y.integrity then
      "! \($label) \($y.version // "?" | s) : source ou intégrité changée à version égale\(flags($key; $pkg; $x; $y; $optional_names))"
    else "~ \($label) \($y.version // "?" | s) : autres champs modifiés\(flags($key; $pkg; $x; $y; $optional_names))" end;

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
