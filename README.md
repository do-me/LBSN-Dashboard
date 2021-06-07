# LBSN-Dashboard
A location-based social network dashboard for privacy-aware analysis based on [LBSN structure](https://lbsn.vgiscience.org/), a Docker-based Postgres HyperLogLog implementation from Dunkel, Löchner, Krumpe et al. for LBSN analysis.

![image](https://user-images.githubusercontent.com/47481567/120980725-2faf8600-c777-11eb-9fe9-71ec16272f71.png)

## Content 
- Backend consisting of Python web framework (fastapi) excluding docker containers from [LBSN structure](https://lbsn.vgiscience.org/)
- Frontend ready-to-deploy with plugin options

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
This repository is part of my Master's thesis. For any questions contact [me](mailto:dominik@geo.rocks) or find me on [my blog](geo.rocks).

---

## Handy Misc
- I used [pipreqs](https://github.com/bndr/pipreqs) to export just the packages to requirements.txt that are actually used in a project. Comes in handy when working in global env what you should't do.
