# imports
from pydantic import BaseModel
import psycopg2
from fastapi import Request
from fastapi.staticfiles import StaticFiles
import uvicorn
import pandas as pd
import secrets
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from starlette.responses import FileResponse

# sql exclude statements for bonn bounding box and bonn main location id
sql_bonn_envelope = f"""
&& ST_MakeEnvelope(
        7.011021, 7.237651, -- bounding 
        50.643365 , 50.775333, -- box limits (Bonn)
        4326)
"""

sql_exclude_conditions_latlong = f"""
-- bonn bounding box
ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) {sql_bonn_envelope}
--leave out "bonn" location
AND (latitude <> 50.7333 AND longitude <> 7.1) 
"""

sql_exclude_conditions_geom = f"""
-- bonn bounding box
t1.geom_center {sql_bonn_envelope}
--leave out "bonn" location
AND (ST_Y(t1.geom_center) <> 50.7333 AND ST_X(t1.geom_center) <> 7.1) 
"""

# some security
security = HTTPBasic()

# set up postgres connection
db_connection = psycopg2.connect(
    host="localhost",
    port="25432",
    dbname="hlldb",
    user="postgres",
    password="eX4mP13p455w0Rd"
)
db_connection.set_session(readonly=True)  # read only!
cur = db_connection.cursor()

# fastapi app
app = FastAPI()

# serving static files, important for css, js and index.html
app.mount("/map", StaticFiles(directory="static", html=True), name="static")
# main index.html would be accessible by localhost:8000/map
# for security reasons, index.html shouldnt be mounted and be transfered to
# a different directory (like root)

# security
def get_current_username(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, "admin")
    correct_password = secrets.compare_digest(credentials.password, "12345")
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# define other routes
@app.get("/users/me")
def read_current_user(username: str = Depends(get_current_username)):
    return {"username": username}


# main hll_locations
@app.get("/hll_locations")  # , response_class=HTMLResponse)
async def hll_locs():
    db_query = f"""
    SELECT
            ST_Y(t1.geom_center) As "latitude",
            ST_X(t1.geom_center) As "longitude",
            hll_cardinality(hll_union_agg(user_hll))::int as "users",
            hll_cardinality(hll_union_agg(post_hll))::int as "posts",
            hll_cardinality(hll_union_agg(date_hll))::int as "userdays",
            --hll_cardinality(hll_union_agg(utl_hll))::int as utl_hll,
            string_agg(t1.place_guid::text, '; '), --array_agg(t1.place_guid),
            hll_union_agg(user_hll)::text as user_hll,
			hll_union_agg(post_hll)::text as post_hll,
			hll_union_agg(date_hll)::text as date_hll			
        FROM   spatial.place t1
        WHERE  {sql_exclude_conditions_geom}
        GROUP BY latitude, longitude
        ORDER BY latitude DESC
    """
    df = pd.read_sql_query(db_query, db_connection)
    return df.to_csv(index=False, line_terminator="\n")

# hll_locations filter
@app.get("/hll_locations/{q}")  # , response_class=HTMLResponse)
async def hll_locs_filter(q: str = None):
    db_query = f"""
        SELECT
                ST_Y(t1.geom_center) As "latitude",
                ST_X(t1.geom_center) As "longitude",
            hll_cardinality(hll_union_agg(user_hll))::int as "users",
            hll_cardinality(hll_union_agg(post_hll))::int as "posts",
            hll_cardinality(hll_union_agg(date_hll))::int as "userdays",
            --hll_cardinality(hll_union_agg(utl_hll))::int as utl_hll,
            string_agg(t1.place_guid::text, '; '), --array_agg(t1.place_guid),
            hll_union_agg(user_hll)::text as user_hll,
			hll_union_agg(post_hll)::text as post_hll,
			hll_union_agg(date_hll)::text as date_hll	
            FROM   spatial.place t1
            WHERE  {sql_exclude_conditions_geom}
            AND ST_Intersects(t1.geom_center, ST_SetSRID(ST_GeomFromGeoJSON(
            '{q}'        
            ),4326))

            GROUP BY latitude, longitude
            ORDER BY latitude DESC

        """
    df = pd.read_sql_query(db_query, db_connection)
    return df.to_csv(index=False, line_terminator="\n")

# hll union stats, users, posts, userdays, location ids
# due to poor postgis handling cannot accept feature group and needs single geometries, here separated by pipe |
@app.get("/hll_union/{q}")  # , response_class=HTMLResponse)
async def hll_union(q: str = None):
    #q = "%7B%22type%22%3A%22Polygon%22%2C%22coordinates%22%3A%5B%5B%5B6.896667%2C50.673835%5D%2C%5B6.896667%2C50.713852%5D%2C%5B7.341614%2C50.713852%5D%2C%5B7.341614%2C50.673835%5D%2C%5B6.896667%2C50.673835%5D%5D%5D%7D"
    #q = http://localhost:8000/hll_union/{"type":"Polygon","coordinates":[[[7.020582,50.729498],[7.020582,50.738915],[7.225525,50.738915],[7.225525,50.729498],[7.020582,50.729498]]]}|{"type":"Polygon","coordinates":[[[7.129739,50.70613],[7.129739,50.709664],[7.178648,50.709664],[7.178648,50.70613],[7.129739,50.70613]]]}
    # Attention: For workaround with single Polygons, geoman return MultiPolygon and three brackets ([[[[]]]]), must be transformed:
    # 1. [[[[ -> [[[
    # 2. MulitPolygon -> Polygon
    def polytemplate(poly):
        pt =  f"""OR ST_Intersects(t1.geom_center, ST_SetSRID(ST_GeomFromGeoJSON(
        '{"".join(poly)}'        
        ),4326))"""
        return pt

    # this line is necessary to make the function work with both, normal, hand-drawn polygons (would work without as well) AND geojson multipolygons, i.e. Bonn Flächennutzungsplan
    q = q.replace("[[[[","[[[").replace("]]]]","]]]").replace("MultiPolygon", "Polygon")

    polys = q.split("|")
    sqlstring = ""
    if len(polys) == 1:
        sqlstring = f"""AND ST_Intersects(t1.geom_center, ST_SetSRID(ST_GeomFromGeoJSON(
        '{"".join(polys)}'        
        ),4326))"""
    else:
        sqlhelper = ""
        for i in polys[1:-1]: # first and last are different
            sqlhelper += polytemplate(i)

        sqlstring = f""" AND (ST_Intersects(t1.geom_center, ST_SetSRID(ST_GeomFromGeoJSON(
            '{"".join(polys[0])}'        
            ),4326)) {sqlhelper} OR ST_Intersects(t1.geom_center, ST_SetSRID(ST_GeomFromGeoJSON(
            '{"".join(polys[-1])}'        
            ),4326)) )"""

    db_query = f"""
    SELECT
            hll_cardinality(hll_union_agg(user_hll))::int as "users",
            hll_cardinality(hll_union_agg(post_hll))::int as "posts",
            hll_cardinality(hll_union_agg(date_hll))::int as "userdays",
            --hll_cardinality(hll_union_agg(utl_hll))::int as utl_hll,
            string_agg(t1.place_guid::text, '; '), --array_agg(t1.place_guid),
            hll_union_agg(user_hll)::text as user_hll,
			hll_union_agg(post_hll)::text as post_hll,
			hll_union_agg(date_hll)::text as date_hll	
        FROM   spatial.place t1
        WHERE  {sql_exclude_conditions_geom} 
            {sqlstring}
        """
    # doesnt need pandas! 
    # df = pd.read_sql_query(db_query, db_connection)
    # return df.to_csv(index=False, line_terminator="\n")
    cur.execute(db_query)
    return cur.fetchall()[0]


@app.get("/custom_query/{q}")  # , response_class=HTMLResponse)
async def custom_locs(q: str = None):
    t_helper = q.replace(",", "','")
    terms = f"""'{t_helper}'"""

    db_query = f"""
    SELECT latitude,
        longitude,
            hll_cardinality(hll_union_agg(user_hll))::int as "users",
            hll_cardinality(hll_union_agg(post_hll))::int as "posts",
            hll_cardinality(hll_union_agg(date_hll))::int as "userdays",
            --hll_cardinality(hll_union_agg(utl_hll))::int as utl_hll,
            string_agg(t1.term::text, '; '), --array_agg(t1.place_guid),
            hll_union_agg(user_hll)::text as user_hll,
			hll_union_agg(post_hll)::text as post_hll,
			hll_union_agg(date_hll)::text as date_hll	

    FROM topical._term_latlng t1
    WHERE {sql_exclude_conditions_latlong}
        AND term in ({terms})
    GROUP BY latitude,
            longitude
    --ORDER BY latitude DESC
    """

    df = pd.read_sql_query(db_query, db_connection)
    return df.to_csv(index=False, line_terminator="\n")

# term stats
@app.get("/term_stats/{q}")  # , response_class=HTMLResponse)
async def term_stats(q: str = None):
    t_helper = q.replace(",", "','")
    terms = f"""'{t_helper}'"""
    db_query = f"""
    SELECT 
            hll_cardinality(hll_union_agg(user_hll))::int as "users",
            hll_cardinality(hll_union_agg(post_hll))::int as "posts",
            hll_cardinality(hll_union_agg(date_hll))::int as "userdays",
            --hll_cardinality(hll_union_agg(utl_hll))::int as utl_hll,
		string_agg(distinct t1.term, ', ')::text AS terms,
            hll_union_agg(user_hll)::text as user_hll,
			hll_union_agg(post_hll)::text as post_hll,
			hll_union_agg(date_hll)::text as date_hll	

	FROM topical._term_latlng t1
    WHERE {sql_exclude_conditions_latlong}
        AND term in ({terms})
        """
    cur.execute(db_query)
    return cur.fetchall()[0]

# direct queries
@app.get("/q/{q}")
async def read_item(q: str = None):
    try:
        cur.execute("{}".format(q))  # doesnt need semicolon
    except Exception:
        db_connection.rollback()
        return rows  # read only doesnt need commit
    rows = cur.fetchall()  # rows = [i[0] for i in rows]
    return rows

# fetch and parse in js with
#fetch('../q/select * from spatial.place limit 10')
#    .then(response=> response.json())
#    .then(function(text) {
#    e=text
# console.log(e)})

# serve index.html with basic auth
# main route will server index.html 
@app.get("/")
async def read_index(username: str = Depends(get_current_username)):
    return FileResponse('index.html')
