# Read-only audit of catch blocks under src/ (tests excluded).
# Usage: python3 -I .claude/skills/reliability-observability/scripts/audit-catches.py .
# Counts empty catches and catches that neither log, rethrow nor report, by area (api, lib, ui).
# Heuristic regex parser: nested braces deeper than one level are not matched.
import os, re, sys, collections
root = sys.argv[1] if len(sys.argv) > 1 else "."
pat = re.compile(r'catch\s*(\([^)]*\))?\s*\{((?:[^{}]|\{[^{}]*\})*)\}', re.S)
stats = collections.Counter()
samples = collections.defaultdict(list)
for dp, dn, fn in os.walk(os.path.join(root, 'src')):
    if '__tests__' in dp: continue
    for f in fn:
        if not f.endswith(('.ts', '.tsx')): continue
        p = os.path.join(dp, f)
        s = open(p, encoding='utf-8').read()
        rel = os.path.relpath(p, root)
        area = 'api' if rel.startswith('src/app/api') else 'lib' if rel.startswith('src/lib') else 'ui'
        for m in pat.finditer(s):
            body = m.group(2)
            code = re.sub(r'//[^\n]*', '', body)
            code = re.sub(r'/\*.*?\*/', '', code, flags=re.S).strip()
            line = s.count('\n', 0, m.start()) + 1
            stats[(area, 'total')] += 1
            if code == '':
                stats[(area, 'empty')] += 1
                samples[(area, 'empty')].append(f'{rel}:{line} {body.strip()[:80]!r}')
            elif not re.search(r'logger\.|console\.|Sentry\.|handleApiError|throw|apiError|toast|setError|captureException', code):
                stats[(area, 'silent-nonempty')] += 1
                samples[(area, 'silent')].append(f'{rel}:{line} {code[:90]!r}')
            if re.search(r'console\.', code): stats[(area, 'console')] += 1
            if re.search(r'logger\.', code): stats[(area, 'logger')] += 1
            if re.search(r'handleApiError', code): stats[(area, 'handleApiError')] += 1
for k in sorted(stats): print(k, stats[k])
for k in [('api','empty'),('lib','empty'),('api','silent'),('lib','silent')]:
    print('\n==', k, len(samples[k]))
    for x in samples[k][:45]: print('  ', x)
