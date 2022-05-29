# LBSN-Dashboard
[![DOI](https://zenodo.org/badge/365174752.svg)](https://zenodo.org/badge/latestdoi/365174752)

Find the supplementary repo [here](https://github.com/do-me/LBSN-Thesis) or watch the [videos](https://github.com/do-me/LBSN-Thesis/tree/main/videos)!

A location-based social network dashboard for privacy-aware analysis based on [LBSN structure](https://lbsn.vgiscience.org/), a Docker-based Postgres HyperLogLog implementation from Dunkel, Löchner, Krumpe et al. for LBSN analysis. More info [here](https://github.com/do-me/LBSN-Thesis).

**Disclaimer: This is a prototype for research purposes and not thought for production (subject to SQL-injection)!**

## WORKING DEMOS
- [Bonn, NRW, Germany](https://geo.rocks/dashboards/bonn)
- [Waynesboro, VA, USA](https://geo.rocks/dashboards/waynesboro)

![image](https://user-images.githubusercontent.com/47481567/120980725-2faf8600-c777-11eb-9fe9-71ec16272f71.png)

## Content 
- Backend consisting of Python web framework (fastapi) excluding docker containers from [LBSN structure](https://lbsn.vgiscience.org/)
- Frontend based on Leaflet and Geoman ready-to-deploy with plugin options (e.g. GeoJSON)

## Data
Use my [Fast-Instagram-Scraper](https://github.com/do-me/fast-instagram-scraper) to retrieve Data e.g. from Instagram. It's fast, easy to use and quickly read into the privacy-aware DB. 

## How to use 
### Preparation
1. Set up LBSN Docker container with pgadmin (good for quickly checking SQL statements but not necessary) and HLL-DB 
2. Download some data from any LBSN such as Instagram. If you use [Fast-Instagram-Scraper](https://github.com/do-me/fast-instagram-scraper) you can use lbsntransform to read the data into the DB with the following command, automatically using `instagram-mapping-for-fast-instagram-scraper.py` (thanks and credits to [Alexander Dunkel](https://github.com/Sieboldianus)!)

```
lbsntransform --origin 13 --input_path_url "path/to/data/fast-instagram-scraper/your-area-of-interest" --file_input --dbpassword_output "eX4mP13p455w0Rd" --dbuser_output "postgres" --dbserveraddress_output "127.0.0.1:25432 " --dbname_output "hlldb" --dbformat_output "hll" --dbpassword_hllworker "eX4mP13p455w0Rd" --dbuser_hllworker "postgres" --dbserveraddress_hllworker "127.0.0.1:25432 " --dbname_hllworker "hlldb" --include_lbsn_objects "origin,post" --file_type "json" --mappings_path "/mappings/" --include_lbsn_bases hashtag,place,date,community,latlng
```
---
### Dashboard 
3. Clone repo
4. Install Python dependencies
5. Start Docker container with HLL-DB
6. Adjust DB connection details in `main.py`, remove my bounding boxes for Bonn
7. Start backend with `python app.py`
8. Go to localhost:8000 

## Contact 
For any questions contact [me](mailto:dominik@geo.rocks) or find me on [my blog](geo.rocks).
