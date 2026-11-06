# Validate db/tick-tile-engine*.sql with pglast: the SQL itself, every plpgsql body, and the
# repo rule that SQL files avoid the words DELETE/ALTER/DROP.
# Usage: python3 scripts/tick-tile-db/validate.py
import glob, re, sys
import pglast
from pglast import parse_plpgsql

bad = 0
for path in sorted(glob.glob('db/tick-tile-engine*.sql')):
    text = open(path).read()
    for w in ('delete', 'alter', 'drop'):
        if re.search(r'\b' + w + r'\b', text, re.I):
            print(path, 'contains', w); bad += 1
    try:
        stmts = pglast.parse_sql(text)
    except Exception as e:
        print(path, 'parse error', e); bad += 1; continue
    n = 0
    for raw in pglast.split(text):
        plpgsql = re.match(r'\s*create\s+or\s+replace\s+(function|procedure)', raw, re.I) and re.search(r'language\s+plpgsql', raw, re.I)
        if plpgsql or re.match(r'\s*do\b', raw, re.I):
            try:
                parse_plpgsql(raw); n += 1
            except Exception as e:
                print(path, 'plpgsql error in', raw[:90].replace('\n', ' '), '->', e); bad += 1
    print('ok' if not bad else '..', path, len(stmts), 'statements,', n, 'plpgsql bodies')
sys.exit(1 if bad else 0)
