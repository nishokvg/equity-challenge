#!/usr/bin/env python3
"""Build the independent Northern California baseline from official challenge layers.

No organizer scores or external data enter this computation. Requires duckdb==1.5.4.
Raw files are cached; each download is atomic and content-length checked. The output
includes source URLs and SHA-256 hashes. See docs/methodology.md for assumptions.
"""
from __future__ import annotations
import concurrent.futures, csv, hashlib, json, math, pathlib, urllib.request
from datetime import datetime, timezone
import duckdb

ROOT=pathlib.Path(__file__).resolve().parents[1]
RAW=ROOT/'data/raw'
BASE='https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge/'
FILES=[f'reference/northern-ca/northern-ca-{s}.parquet' for s in ['census-tiger-roads','census-cbp','microsoft-buildings','overture-buildings','overture-roads','overture-pois','hifld-fire-stations','hifld-ems-stations','hifld-schools']]+['reference/northern-ca/northern-ca-sample-submission.csv','strata/northern-ca/northern-ca-census-tracts.parquet','strata/northern-ca/northern-ca-strata-tract-table.parquet']

def fetch(key):
    RAW.mkdir(parents=True,exist_ok=True)
    path=RAW/key.split('/')[-1]
    if not path.exists():
        temp=path.with_suffix(path.suffix+'.part')
        with urllib.request.urlopen(BASE+key,timeout=180) as src, temp.open('wb') as out:
            expected=int(src.headers.get('Content-Length','0'))
            while chunk:=src.read(1024*1024): out.write(chunk)
        if expected and temp.stat().st_size!=expected: raise ValueError(f'Incomplete download: {key}')
        temp.replace(path)
    digest=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
    return {'url':BASE+key,'sha256':digest,'bytes':path.stat().st_size}

def avg(values):
    defined=[x for x in values if x is not None]
    return sum(defined)/len(defined) if defined else None

def gap(pair):
    observed,reference=pair
    if any(not math.isfinite(x) or x<0 for x in pair): raise ValueError(f'Invalid observation {pair}')
    return 1-min(1,observed/reference) if reference else None

def calculate(counts):
    roads,buildings=gap(counts['roads']),gap(counts['buildings'])
    facilities=avg([gap(counts[k]) for k in ['fire','ems','schools']])
    establishments=gap(counts['establishments'])
    places=avg([facilities,establishments])
    return dict(roads=roads,buildings=buildings,places=places,facilities=facilities,establishments=establishments,score=avg([roads,buildings,places]),defined=sum(v is not None for v in [roads,buildings,places]))

def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: sources=list(pool.map(fetch,FILES))
    con=duckdb.connect()
    con.execute("SET memory_limit='2GB'; SET threads=4;")
    con.execute(f"SET extension_directory='{ROOT}/work/duckdb-extensions'")
    con.execute('INSTALL spatial; LOAD spatial;')
    def f(name): return str(RAW/f'northern-ca-{name}.parquet')
    def view(name,source): con.read_parquet(f(source)).create_view(name)
    view('tract_source','census-tracts')
    con.execute('CREATE TABLE tracts AS SELECT * EXCLUDE(geometry), ST_MakeValid(geometry) AS geometry FROM tract_source')
    view('strata','strata-tract-table'); view('cbp','census-cbp')
    sample=list(csv.DictReader((RAW/'northern-ca-sample-submission.csv').open()))
    sample_ids=[r['GEOID'] for r in sample]
    assert len(sample_ids)==len(set(sample_ids))==591 and all(len(x)==11 for x in sample_ids)
    point_counts={}
    categories={'fire':["fire_department"],'ems':["ambulance_and_ems_services"],'schools':["elementary_school","middle_school","high_school","school","private_school","public_school"]}
    for key,source,building,category in [
        ('ob','overture-buildings',True,None),('mb','microsoft-buildings',True,None),
        ('op','overture-pois',False,None),
        *[(f'o{k}','overture-pois',False,values) for k,values in categories.items()],
        ('rfire','hifld-fire-stations',False,None),('rems','hifld-ems-stations',False,None),('rschools','hifld-schools',False,None),
    ]:
        geom='ST_PointOnSurface(ST_MakeValid(geometry))' if building else 'geometry'
        where=' WHERE categories.primary IN ('+','.join("'"+v+"'" for v in category)+')' if category else ''
        sql=f'''WITH features AS (SELECT row_number() OVER () AS feature_id, {geom} AS geometry FROM read_parquet(?) {where}),
            assignments AS (SELECT t.GEOID, x.feature_id FROM features x JOIN tracts t ON ST_Intersects(x.geometry,t.geometry)
                QUALIFY row_number() OVER (PARTITION BY x.feature_id ORDER BY t.GEOID)=1)
            SELECT GEOID,count(*) FROM assignments GROUP BY GEOID'''
        point_counts[key]=dict(con.execute(sql,[f(source)]).fetchall())
        print('Counted',key,sum(point_counts[key].values()),flush=True)
    roads={}
    for key,source,condition in [('or','overture-roads',"class IN ('motorway','trunk','primary','secondary')"),('rr','census-tiger-roads',"MTFCC IN ('S1100','S1200')")]:
        roads[key]=dict(con.execute(f'''SELECT t.GEOID, sum(ST_Length_Spheroid(ST_FlipCoordinates(ST_CollectionExtract(ST_Intersection(t.geometry,r.geometry),2))))
          FROM tracts t JOIN (SELECT geometry FROM read_parquet(?) WHERE {condition}) r
          ON ST_Intersects(t.geometry,r.geometry) GROUP BY t.GEOID''',[f(source)]).fetchall())
        print('Measured',key,sum(roads[key].values()),flush=True)
    rows=con.execute('''SELECT t.GEOID,t.NAMELSAD,t.COUNTYFP,t.pop_total,
      CASE WHEN s.svi_covered AND s.svi_overall BETWEEN 0 AND 1 THEN s.svi_overall ELSE NULL END,
      CASE WHEN s.ruca_covered AND s.ruca_primary BETWEEN 1 AND 10 THEN s.ruca_primary>=4 ELSE NULL END,
      c.cbp_estab,ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geometry,0.002))
      FROM tracts t LEFT JOIN strata s USING(GEOID) LEFT JOIN cbp c USING(GEOID) ORDER BY t.GEOID''').fetchall()
    bbox=con.execute('SELECT min(ST_XMin(geometry)),min(ST_YMin(geometry)),max(ST_XMax(geometry)),max(ST_YMax(geometry)) FROM tracts').fetchone()
    xmin,ymin,xmax,ymax=bbox
    coslat=math.cos(math.radians((ymin+ymax)/2)); w=(xmax-xmin)*coslat;h=ymax-ymin
    scale=min(710/w,480/h); xpad=(800-w*scale)/2; ypad=(550-h*scale)/2
    def svg_path(geo):
        geometry=json.loads(geo)
        polys=[geometry['coordinates']] if geometry['type']=='Polygon' else geometry['coordinates']
        paths=[]
        for polygon in polys:
            for ring in polygon:
                points=[f'{xpad+(x-xmin)*coslat*scale:.2f},{ypad+(ymax-y)*scale:.2f}' for x,y,*_ in ring]
                if points: paths.append('M'+'L'.join(points)+'Z')
        return ''.join(paths)
    byid={}
    for geoid,name,county,pop,svi,rural,estab,geometry in rows:
        if geoid not in sample_ids: continue
        if estab is None: raise ValueError(f'Missing CBP row {geoid}')
        def n(key): return point_counts[key].get(geoid,0)
        counts={'roads':[roads['or'].get(geoid,0),roads['rr'].get(geoid,0)],'buildings':[n('ob'),n('mb')],
          **{k:[n('o'+k),n('r'+k)] for k in categories},'establishments':[n('op'),estab]}
        metrics=calculate(counts)
        if metrics['score'] is None: raise ValueError(f'Scored tract has no reference {geoid}')
        byid[geoid]={'geoid':geoid,'name':name,'county':f'County FIPS 06{county}','population':pop,'svi':svi,'rural':rural,'path':svg_path(geometry),'counts':counts,'metrics':metrics}
    assert set(byid)==set(sample_ids)
    snapshot={'meta':{'region':'Northern California','release':'2026-08-19.0','generated':datetime.now(timezone.utc).isoformat(),'method':'independent-baseline-v1','sources':sources,'bbox':bbox,'notes':[
      'Independent baseline; leaderboard RMSE has not been measured.',
      'Buildings use point-on-surface assignment; boundary ties go to the lowest GEOID.',
      'Road segments are clipped to tracts and measured in geodesic metres.',
      'Shared-boundary road lengths can contribute to both neighboring tracts.',
      'High SVI means ≥0.75; rural means RUCA primary code ≥4. Unknowns are excluded from group comparisons.',
      'Map outlines are simplified for display; calculations use original valid geometry.',
      'This snapshot covers one region, not the complete challenge.']},'sampleIds':sample_ids,'tracts':[byid[i] for i in sorted(byid)]}
    out=ROOT/'data/northern-ca.json';temp=out.with_suffix('.json.tmp');temp.write_text(json.dumps(snapshot,separators=(',',':'),allow_nan=False));temp.replace(out)
    print('Wrote',out,len(byid),'tracts',out.stat().st_size,'bytes',flush=True)
    print('Mean gap',avg([x['metrics']['score'] for x in byid.values()]),'undefined roads',sum(x['metrics']['roads'] is None for x in byid.values()),flush=True)
if __name__=='__main__': main()
