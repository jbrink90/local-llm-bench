import json,glob,re,collections
rows=[]
for f in glob.glob('caxi-results/agentic-{bugfix,exercism,greenfield}-*-r*.json'.replace('{bugfix,exercism,greenfield}','*')):
    b=re.search(r'agentic-(bugfix|exercism|greenfield)-(.+)-r(\d)\.json$',f)
    if not b: continue
    d=json.load(open(f))
    if not d.get('model'): continue
    rows.append((d['model'],b.group(1),int(b.group(3)),d))
m=collections.defaultdict(lambda: collections.defaultdict(dict))
for mod,leg,r,d in rows: m[mod][leg][r]=d
print(f"{'model':32} {'repair':10} {'implement':14} {'build':10} {'pass':>5} {'hours':>6}")
for mod in sorted(m):
    legs=m[mod]
    def s(leg,key,tot):
        return '/'.join(str(legs[leg][r].get(key,'x')) if legs[leg].get(r) else '-' for r in (1,2,3))
    rep='/'.join(('MOD' if legs['bugfix'].get(r,{}).get('reason','').startswith('shipped') else str(legs['bugfix'].get(r,{}).get('tests_passed','-'))) for r in (1,2,3))
    ex='/'.join(str(legs['exercism'].get(r,{}).get('solved','-')) for r in (1,2,3))
    gf='/'.join(str(legs['greenfield'].get(r,{}).get('score','-')) for r in (1,2,3))
    allr=[d for leg in legs.values() for d in leg.values()]
    npass=sum(1 for d in allr if d.get('pass') is True)
    hrs=sum((d.get('loop') or {}).get('wall_ms',0) for d in allr)/3600000
    print(f"{mod:32} {rep:10} {ex:14} {gf:10} {npass:>5} {hrs:>6.2f}")
