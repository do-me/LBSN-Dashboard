var fnp_bonn
var filtered_group
var hexLayer

// A dictionary for geojson Plugin. Can be ignored or deleted if not needed.
$(document).ready(function () {
    FNP_dict = {
        2: 'Wohnbaufläche',
        3: 'Gemischte Baufläche',
        4: 'Gewerbliche Baufläche',
        5: 'Sonderbaufläche',
        6: 'Sonderbaufläche für Hauptstadteinrichtungen',
        7: 'Sonderbaufläche für Hauptstadteinrichtungen mit parkartigem Charakter',
        8: 'Sonderbaufläche mit parkartigem Charakter',
        9: 'Fläche für Gemeinbedarf',
        10: 'Verkehrsflächen',
        11: 'Fläche für Bahnanlagen',
        14: 'Fläche für Versorgungsanlagen',
        16: 'Grünfläche',
        18: 'Wasserfläche',
        21: 'Fläche für die Land- und Forstwirtschaft',
        22: 'Fläche für die Landwirtschaft',
        23: 'Fläche für die Forstwirtschaft',
        24: 'Schutz Pflege und Entwicklung',
        25: 'Gewerbliche Baufläche mit erhöhtem Grünanteil',
        26: 'Gemischte Baufläche mit erhöhtem Grünanteil'
    }

    for (let key in FNP_dict) {
        i = 0;
        let value = FNP_dict[key];
        $('#FNP_select').append('<option value=' + key + '>' + value + '</option>');
        i++;
    }

    // OSM tile layer - please use fairly and responsibly! Tiles only for test purposes.s
    var osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png',
        osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        osm = L.tileLayer(osmUrl, {
            maxZoom: 18,
            attribution: osmAttrib
        });

    function initialize_map() {
        // initialize the map on the "map" div with a given center and zoom
        map = L.map('map', {
            fullscreenControl: true,
        }).setView([50.708961, 7.10719], 12).addLayer(osm); // Bonn coordinates

        // add leaflet.pm controls to the map
        map.pm.addControls({
            drawControls: true,
            editControls: false,
            optionsControls: true,
            customControls: true,
            oneBlock: true
        })

        // adding some plugins
        L.control.scale().addTo(map);
        L.Control.geocoder().addTo(map);
        L.control.polylineMeasure().addTo(map);
        layerControl = L.control.layers().addTo(map);

        // hiding some geoman controls as not needed (yet)
        $('.leaflet-pm-icon-marker').parent().hide();
        $('.leaflet-pm-icon-circle').parent().hide();
        $('.leaflet-pm-icon-polyline').parent().hide();
        $('.leaflet-pm-icon-circle-marker').parent().hide();
        $('.leaflet-pm-icon-polyline').parent().hide();


    }
    initialize_map()


    var markers;
    var location_csv_max;
    var bonn_strict_locs_markers;
    var location_filter_max;
    var legend;
    query_layer_list = [];

    // function not needed but might be useful to quickly get a geojson for all
    // function generateGeoJson() {
    //     var fg = L.featureGroup();
    //     var layers = findAllLayers(map);
    //     layers.forEach(function (layer) {
    //         fg.addLayer(layer);
    //     });
    //     console.log(fg.toGeoJSON());
    // }

    // function not needed but might be useful to quickly find all geoman layers
    // function findAllLayers() {

    //     var layers = [];
    //     map.eachLayer(layer => {
    //         if (
    //             layer instanceof L.Polyline ||
    //             layer instanceof L.Marker ||
    //             layer instanceof L.Circle ||
    //             layer instanceof L.CircleMarker
    //         ) {
    //             layers.push(layer);
    //         }
    //     });

    //     // filter out layers that don't have the leaflet-geoman instance
    //     layers = layers.filter(layer => !!layer.pm);

    //     // filter out everything that's leaflet-geoman specific temporary stuff
    //     layers = layers.filter(layer => !layer._pmTempLayer);

    //     return layers;
    // }

    // used window. here to make function accessible in frontend, else wouldn't be callable
    // might be hidden for production
    // removes a layer from map and layer control (top right in map)
    window.remove_layer = function (layr) {
        map.removeLayer(layr);
        layerControl.removeLayer(layr)
    }

    function remove_layer_from_layer_control_only(layr) {
        layerControl.removeLayer(layr)
    }

    // adds a layer
    window.add_layer = function (layr, layr_name) {
        map.addLayer(layr);
        layerControl.addOverlay(layr, layr_name);
    }

    // due to annoying different conventions, unfortunately, sometimes switching x y is required
    function switch_xy(item, index, arr) {
        long = arr[index]["geometry"]["coordinates"][0]
        lat = arr[index]["geometry"]["coordinates"][1]

        arr[index]["geometry"]["coordinates"][0] = lat
        arr[index]["geometry"]["coordinates"][1] = long
    }

    // feature collection to simple array converter
    function features_to_array(feat_coll) {
        get_items = coord_item => coord_item["geometry"]["coordinates"];
        coords_array = feat_coll.map(get_items);
        return coords_array
    }

    // reset entire map
    window.simple_reset_map = function () {
        try {
            self_drawn_layer_list.map(remove_layer)
            //remove_layer(self_drawn)
        } catch { } // only remove if exists

        //refresh existing layers
        map.eachLayer(function (layer) {
            if (osmUrl != layer._url) { map.removeLayer(layer) };
        });
        remove_hexlayer();
        layerControl.remove();
        layerControl = null;
        layerControl = L.control.layers().addTo(map);

        draw_heat(location_csv, "Post Heatmap", location_csv_max);
        draw_markers(location_csv);

    }

    // leaflet popup bindings
    function popUp_feature_layer(f, l) {
        var out = [];
        if (f.properties) {
            for (key in f.properties) {
                out.push(key + ": " + f.properties[key]);
            }
            l.bindPopup(out.join("<br />")); // adding html line breaks
        }
    }

    // load locations, only use if location geojson available
    // create empty marker cluster group
    bonn_strict_locs_markers = L.markerClusterGroup()

    window.load_locs = function () {
        bonn_strict_locs = new L.GeoJSON.AJAX("../map/data/bonn_instagram_locs.geojson", { onEachFeature: popUp_feature_layer });
        // when geojson is loaded, add points to marker cluster group and add to map & layer control
        bonn_strict_locs.on('data:loaded', function () {
            bonn_strict_locs_markers.addLayer(bonn_strict_locs);
            add_layer(bonn_strict_locs_markers, "Instagram Location Info")
        });
    }
   

    // used for on click handlers, when retrieving infos about e.g. Instagram locations, displaying further infos in browser popup
    // if no geojson is provided, nothing will be displayed
    function location_replace_space_with_hyperlink(_s4) {
        _s4 = _s4.replace(/;/g, '')
        var _s4_start = "<div class='loc_info'>" // on click handler must be attached to document as elements are dynamically created
        var _s4_end = "</div>"
        var s4 = "Location IDs:" + _s4_start +
            _s4.replace(/ /g, _s4_end + _s4_start) +
            _s4_end
        return s4
    }


    // function for calculating sums of filtered data but ATTENTION: unit would change to unique posts|users|uderdays per locations due to HLL logic
    // instead, better use function below
    // function get_sums_popup_text(fdata) {
    //     if (!fdata.length) { //check for emppty array
    //         return "No Instagram Location within Polygon"
    //     }
    //     else {
    //         var s1 = "User Count: " + fdata.map(item => item[2]).reduce((prev, next) => prev + next) + "<br>";
    //         var s2 = "Post Count: " + fdata.map(item => item[3]).reduce((prev, next) => prev + next) + "<br>";
    //         var s3 = "Userdays Count: " + fdata.map(item => item[4]).reduce((prev, next) => prev + next) + "<br>";

    //         var _s4 = fdata.map(item => item[5]).reduce((prev, next) => prev + " " + next + "<br>")
    //         var s4 = location_replace_space_with_hyperlink(_s4)

    //         var s5 = "Location IDs Count: " + ((s4.match(/ /g) || []).length - 1) + "<br>"; // +1 for missing space but -2 for spaces in "Location IDs: "
    //         var ptitle = s1.concat(s2, s3, s5, s4)
    //         return ptitle
    //     }
    // }

    // get drawn geoman polygon, add to map and layer control and remove previous
    function filter_map_data_by_polygon(in_features, layer_name, selection_layer = false) {

        //refresh self_drawn
        //try { remove_layer(in_features) } catch { } // only remove if exists
        //self_drawn = map.pm.getGeomanDrawLayers(true)

        // delete all previous layers as a list, as multiple layers could be added
        self_selected_layer_list.map(remove_layer)
        self_selected_layer_list = []

        self_selected_layer_list.push(in_features)

        add_layer(in_features, layer_name)

        //refresh existing layers
        remove_layer(heat)
        remove_layer(markers)

        //filter data
        filtered_data = features_to_array(intersect_filter(location_csv, in_features).features) // HIER SQL ABFRAGE MIT POLYGONFILTER STARTEN

        // bind popup with sums
        // one feature 
        // var poly_helper = JSON.stringify(in_features.toGeoJSON().features[0].geometry) // postgis can only take one polygon at a time. feature collection cant be passed ...
        // multiple polygons concat with pipe |
        var poly_helper = in_features.toGeoJSON().features.map((a, i) => `${JSON.stringify(a.geometry)}`).join('|'); // join by pipe

        // route for request: hll_query_geojson_features for geojson selection only, hll_union for self drawn geometries
        var this_route = (selection_layer === true) ? 'hll_query_geojson_features/' :'hll_union/';

        $.get("http://localhost:8000/"+ this_route + poly_helper).done(function (data) {

            // displaying tooltip metrics on click
            var tooltip_text =
                `Users: ${String(data[0])}<br>Posts: ${String(data[1])}<br>Userdays:${String(data[2])}<br>Locations: ${location_replace_space_with_hyperlink(data[3])}`

            in_features.bindPopup(
                tooltip_text
                , {
                    maxHeight: 500,
                    minWidth: 180,
                    maxWidth: 220
                })
        });

        //reset max
        location_filter_max = get_max_value(filtered_data, 2)

        // heat.setLatLngs(filtered_data) // just updating, cant do it here as array needs to be cut to lat,lng,intensity but contains other info as well
        draw_heat(filtered_data, "Filtered Heatmap", location_csv_max);
        draw_markers(filtered_data);

        // hexlayer = hexagonal bin layer
        remove_hexlayer()
        add_hexlayer(filtered_data)

        //fit to bounds
        map.fitBounds(in_features.getBounds());

        // spinner is spinning loading wheel
        $("#spinner").attr('hidden', '');

    }

    // oneliner for determining max of array
    function get_max_value(array, index) {
        return Math.max.apply(Math, array.map(function (o) { return o[index]; }))
    }

    // drawing heatmap
    function draw_heat(locs, layr_title = "Post Heatmap", heat_max) {

        // heat only accepts three keys, lat, lng, intensity. if other keys are passed, breaks
        locs = locs.map(function (p) {
            return [
                parseFloat(p[0]),
                parseFloat(p[1]),
                parseFloat(p[2]) //, p[3], p[4], p[5] // / 5000// / 100 change intensity or comment out 
            ];
        });

        heat = L.heatLayer(locs,
            { //https://github.com/Leaflet/Leaflet.heat
                radius: 25,
                //maxZoom: 15,
                minOpacity: 0.5,
                radius: 11,
                max: heat_max,
                blur: 10,
                gradient: {

                    0: "#000000",
                    0.2: "#570000",
                    0.4: "#ff0000",
                    0.6: "#ffc800",
                    0.8: "#ffff00",
                    1: "#FFFFFF"

                    //0: "#000000",
                    //1: "#ffc800"
                }
            }

        );

        add_layer(heat, layr_title);

        // append to list only if its query
        if (layr_title != "Post Heatmap") {
            query_layer_list.push(heat)
        }

    }

    // for location queries draws locations on map in cluster (can be untoggled thanks to plugin)
    function draw_markers(locs, layr_title = "Instagram Locations") {
        // for unclustered version add normal cluster
        markers = L.markerClusterGroup();

        // metrics
        for (var i = 0; i < locs.length; i++) {
            var a = locs[i];
            var s1 = "User Count: " + a[2] + "<br>"
            var s2 = "Post Count: " + a[3] + "<br>"
            var s3 = "Userdays Count: " + a[4] + "<br>"
            var s4 = location_replace_space_with_hyperlink(a[5])
            var title = s1.concat(s2, s3, s4)

            // adding markers
            var marker = L.marker(new L.LatLng(a[0], a[1]), { title: title });
            marker.bindPopup(title);
            markers.addLayer(marker);
        }

        add_layer(markers, layr_title)

        // append to list only if its query
        if (layr_title != "Instagram Locations") {
            query_layer_list.push(markers)
        }
    }

    // parser function
    function string_to_list(item, index, arr) {
        arr[index] = item.replace(/"/g, '').split(",")
    }

    // intersection
    function intersect_filter(in_point_csv, in_features) { // attention! x y coordinates switched 
        var pointy = in_point_csv.map(function (p) { // location_csv self_drawn
            return [
                parseFloat(p[1]),
                parseFloat(p[0]),
                parseFloat(p[2]), // / 5000// / 100 change intensity or comment out 
                parseFloat(p[3]),
                parseFloat(p[4]),
                p[5],
                // additional raw hll hexstrings for frontend unions
                p[6],
                p[7],
                p[8]

            ]
        })

        //using turf.js plugin to only return points in AOI
        filtered_points = turf.pointsWithinPolygon(turf.points(pointy), in_features.toGeoJSON()) // points, (multi)polygon
        filtered_points["features"].forEach(switch_xy)

        return filtered_points
    }

    // read location data from csv [lat,lng,count] and create heatmap
    // functions for choropleth fnp bonn map 
    // ------------------------------------------------------------------------
    function highlightFeature(e) {
        var ll = e.target;

        ll.setStyle({
            weight: 5,
            //color: '#666',
            // dashArray: '',
            // fillOpacity: 1,
            // opacity: 1
        });

        if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            ll.bringToFront();
        }

        //info.update(layer.feature.properties);
    }

    function resetHighlight(e) {
        //fnp_bonn.resetStyle(e.target);
        //info.update();
        var ll = e.target;

        ll.setStyle({
            weight: 0,
            //color: '#666',
            // dashArray: '',
            // fillOpacity: 1,
            // opacity: 1
        });
    }

    function zoomToFeature(e) {
        map.fitBounds(e.target.getBounds());
    }

    // clumsy popup function - room for performance improvement!
    function popUp_element(e) {
        var ll = e.target; // layer
        var f = ll.feature; // feature
        var out = [];
        if (f.properties) {

            for (key in f.properties) {
                out.push(key + ": " + f.properties[key]);
            }
            e.target.bindPopup(out.join("<br />")).openPopup(); // not optimal as a new popup is bound to the marker each time. without openPopup would not open on first click, but only second when is alrerady bound
        };
        //map.fitBounds(ll.getBounds()); //rather annyoing
    }

    function fnp_onEachFeature(f, l) {
        l.on({
            mouseover: highlightFeature,
            mouseout: resetHighlight,
            click: popUp_element
        });
    }

    // https://medialab.github.io/iwanthue/ or for 20 https://sashamaps.net/docs/resources/20-colors/

    color_palette_25 = ["#410012", "#0260d4", "#004102", "#7cff9a", "#ff6c4e", "#ffaaa8", "#ff93e2", "#bfabff", "#d200cd", "#aaddff", "#504af5", "#563600", "#ff688e", "#00cc39", "#001c31", "#838200", "#00104f", "#755f00", "#0179a9", "#a9001a", "#ffe496", "#009778", "#7f0059", "#eb7b00", "#ffb321"]
    // get color depending on population density value
    window.getColor = function (d) {
        var color_index = d - 2; // - 2] // numbers 2 - 26
        //console.log(color_index)
        return color_palette_25[color_index];
    }

    // fnp = land use plan geojson
    function fnp_style(feature) {
        return {
            weight: 0,
            opacity: 1,
            //color: 'white',
            //dashArray: '3',
            fillOpacity: 0.75,
            fillColor: getColor(feature.properties.LAYER)
        };
    }

    //------------------------------------------------------------------------

    // fetch location csv only one time - will be reused in the frontend, so no unnecessary DB requests avoided
    function add_hll_data() {
        //spinner.removeAttribute('hidden');
        fetch('../hll_locations')
            .then(response => response.text())
            .then(function (text) {
                // custom csv parse
                location_csv = text.replace(/"/, "").split("\\n"); // remove double quotes, split by newline
                location_csv.forEach(string_to_list)
                location_csv.shift() // remove header
                location_csv.pop() // remove last row ("")
                location_csv = location_csv.map(function (p) {
                    return [
                        parseFloat(p[0]), // lat
                        parseFloat(p[1]), // long
                        parseFloat(p[2]), // users / 5000// / 100 change intensity or comment out 
                        parseFloat(p[3]), // posts
                        parseFloat(p[4]), // userdays
                        p[5], // location or other aggregated string info
                        // additional raw hll hexstrings for frontend unions
                        p[6], // users hll
                        p[7], // posts hll
                        p[8] // uderdays hll
                    ];
                });
                location_csv_max = get_max_value(location_csv, 3) //relating to index 2. use this number to switch between users=2|posts=3|userdays=4 metrics
                draw_heat(location_csv, "Post Heatmap", location_csv_max);
                draw_markers(location_csv);

            }).then(function () {
                // remove spinner waiting wheel
                $("#spinner").attr('hidden', '');
            })
    }

    var bonn_strict_locs_dict
    function load_json() {
        $("#spinner").removeAttr('hidden');

        fetch('../map/data/bonn_locs_dict.json')
            .then(response => response.json())
            .then(data => bonn_strict_locs_dict = data);
    }

    // custom term query, default is textarea value
    function custom_query_hex_bins(custom_list = $("#custom_query").val().replace(/ /g, ""), td_append = true) {
        spinner.removeAttribute('hidden');

        // append to table only if non existent
        if (td_append) {
            fetch('../term_stats/' + custom_list)
                .then(response => response.text())
                .then(function (text) {
                    data = JSON.parse(text)
                    if ($('#term-query-table').length === 0) {
                        // appending some html rows
                        $("body").append(`<table id="term-query-table" class="styled-table">
                    <thead> 
                    <tr>
                       <th>Users</th>
                       <th>Posts</th>
                       <th>Userdays</th>
                       <th>Query terms</th>
                       <th>Display on map</th>
                     </tr>
                     </thead>
                     <tbody>
                     </tbody>
                   </table>`)

                        $('#term-query-table > tbody:last-child').append(`<tr><td>${data[0]}</td><td>${data[1]}</td><td>${data[2]}</td><td class="query_td">${data[3]}</td><td><button class="submit_this_query">Submit</button></td></tr>`)
                    }
                    else {
                        $('#term-query-table > tbody:last-child').append(`<tr><td>${data[0]}</td><td>${data[1]}</td><td>${data[2]}</td><td class="query_td">${data[3]}</td><td><button class="submit_this_query">Submit</button></td></tr>`)
                    }
                })
        }

        // custom term query
        fetch('../custom_query/' + custom_list)
            .then(response => response.text())
            .then(function (text) {
                // custom csv parse, no need for additional plugins such as papaparse
                query_csv = text.replace(/"/, "").split("\\n"); // remove double quotes, split by newline
                query_csv.forEach(string_to_list)
                query_csv.shift() // remove header
                query_csv.pop() // remove last row ("")
                query_csv = query_csv.map(function (p) {
                    return [
                        parseFloat(p[0]),
                        parseFloat(p[1]),
                        parseFloat(p[2]), // / 5000// / 100 change intensity or comment out 
                        parseFloat(p[3]),
                        parseFloat(p[4]),
                        p[5],
                        // additional raw hll hexstrings for frontend unions
                        p[6],
                        p[7],
                        p[8]
                    ];
                });
                query_csv_max = get_max_value(query_csv, 3) //relating to index 3

                draw_heat(query_csv, "Post Heatmap for: " + custom_list, query_csv_max);
                draw_markers(query_csv, "Instagram Locations containing: " + custom_list);
                add_hexlayer(query_csv)

            }).then(function () {
                $("#spinner").attr('hidden', '');
            })
    }

    function remove_query_hex_bins() {
        remove_hexlayer()
        query_layer_list.map(remove_layer)
        query_layer_list = []
    }

    function add_hexlayer(data_csv) {

        // Make a reusable color scale array
        var colorRange = ['#f7fbff', '#08306b'];

        d3.select('.info.legend.leaflet-control').remove()

        try { legend = null }
        catch { }

        var legend = L.control({ position: 'bottomright' });
        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend')
            //div.innerHTML //= legend_below
            return div;
        };

        legend.addTo(map);

        // Create the legend to illustrate the color scale being divergent
        var legend_intervals = 10 // 0-10: 10%, 20% etc.
        var leg_arr = [...Array(legend_intervals).keys()]
        leg_arr.push(legend_intervals)
        leg_arr = leg_arr.map(function (e) { return parseInt((e / legend_intervals) * 100) })
        var legendEntries = leg_arr.map(function (e) { return String(e) + "%" })

        var colorScale = d3.scaleLinear().domain([0, legend_intervals]).range(colorRange); // scaleQuantile() possible
        var legend_below = d3.select('.legend').selectAll('.legend-entry').data(legendEntries).enter().append('div').attr('class', 'legend-entry');
        legend_below.append('div').attr('class', 'color-tile').style('background-color', function (d, i) { return colorScale(i); });
        legend_below.append('div').attr('class', 'description').text(function (d) { return d; });

        function tooltip_function(d) {
            //console.log(d)
            //hll.fromHexString(temp1[0]["o"][6].replace(/\\\\/g,"/")).hllSet; // js needs escaped backslashes!
            //user 6, post 7, date 8
            var hexsum1 = d.reduce(function (first, second) { return first.union(hll.fromHexString(second["o"][6].replace(/\\\\/g, "/")).hllSet) }, new hll.HLL(11, 5)).cardinality();
            var hexsum2 = d.reduce(function (first, second) { return first.union(hll.fromHexString(second["o"][7].replace(/\\\\/g, "/")).hllSet) }, new hll.HLL(11, 5)).cardinality();
            var hexsum3 = d.reduce(function (first, second) { return first.union(hll.fromHexString(second["o"][8].replace(/\\\\/g, "/")).hllSet) }, new hll.HLL(11, 5)).cardinality();
            //var hexsum3 = d.reduce(function (first, second) { return first.union(hll.fromHexString(second["o"][8].replace(/\\\\/g,"/")).hllSet)}, new hll.HLL(11, 5)).cardinality();
            // var hexsum1 = d.reduce(function (acc, obj) { return acc + obj["o"][2]; }, 0);
            // var hexsum2 = d.reduce(function (acc, obj) { return acc + obj["o"][3]; }, 0);
            // var hexsum3 = d.reduce(function (acc, obj) { return acc + obj["o"][4]; }, 0);
            //console.log(d)

            var tooltip_text =
                `Users: ${String(hexsum1)}<br>Posts: ${String(hexsum2)} (color)<br>Userdays:${String(hexsum3)}<br>Locations: ${String(d.length)}`

            return tooltip_text
        }

        hexLayer = null
        hexLayer = L.hexbinLayer({
            colorRange: colorRange,
            colorScaleExtent: [undefined, undefined],
            colorScale: colorScale,
            duration: 200,
            radiusRange: [5, 20]                        // for bin resizing uncomment this and .radius value
        })
            .radiusValue(function (d) {
                // see https://geo.rocks/post/hexbins-js-hll/ for further explanation!

                //standard summation, simply summing up all the values
                //var hexsum = d.reduce(function (acc, obj) { return acc + obj["o"][2]; }, 0);
                //console.log(d)
                // performing hll summation based on the hexstrings passed in array
                var hexsum = d.reduce(function (first, second) {
                    return first.union(
                        hll.fromHexString(second["o"][6]
                            .replace(/\\\\/g, "/"))
                            .hllSet)
                }, new hll.HLL(11, 5))
                    .cardinality();

                return hexsum

            })

            .colorValue(function (d, i) {

                                // d is an array of the points plus value in heaxbins
                                return d.length;

            })
            .hoverHandler(L.HexbinHoverHandler.compound({
                handlers: [
                    L.HexbinHoverHandler.resizeFill(),
                    L.HexbinHoverHandler.tooltip({ tooltipContent: tooltip_function })
                ]
            }
            ));

        // switch x y again...
        var location_csv_switched = data_csv.map(function (p) {
            return [
                parseFloat(p[1]),
                parseFloat(p[0]),
                parseFloat(p[2]), // / 5000// / 100 change intensity or comment out 
                parseFloat(p[3]),
                parseFloat(p[4]),
                p[5],
                p[6],
                p[7],
                p[8]
            ];
        });

        hexLayer.data(location_csv_switched);

        add_layer(hexLayer, "Hexbins")
    }

    function remove_hexlayer() {
        try {
            remove_layer_from_layer_control_only(hexLayer)
            $(".hexbin").parent("g").remove() // cant simply remove layer but do it manually
            //$(".legend").children().remove()
            d3.select('.info.legend.leaflet-control').remove()
        }
        catch { }
    }


    window.load_fnp = function () {

        // spinner here only relevant for poor bandwidth
        $("#spinner").removeAttr('hidden');

        setTimeout(
            function () {
                fnp_bonn = new L.GeoJSON.AJAX("../map/data/FNP-Bonn.geojson", {
                    style: fnp_style,
                    onEachFeature: fnp_onEachFeature
                }).addTo(map)

                layerControl.addOverlay(fnp_bonn, "FNP Bonn");
                $("#spinner").attr('hidden', '');
            }, 50);

        //$("#spinner").attr('hidden', '');
        //setTimeout(function(){ add_layer(fnp_bonn, "FNP Bonn") }, 3000);

    }

    window.color_selected_features = function (laynum) {

        filtered_group = null
        filtered_group = L.featureGroup()

        //reset all color to default
        fnp_bonn.eachLayer(function (layer) {
            var lay_color = getColor(layer.feature.properties.LAYER)
            layer.setStyle({
                fillColor: lay_color, fillOpacity: 0.75, weight: 0,
                opacity: 1
            })
        })

        fnp_bonn.eachLayer(function (layer) {
            //console.log(layer)
            if (layer.feature.properties.LAYER == laynum) {
                layer.setStyle({
                    fillColor: "#c20000", // change the red color to something else if needed
                     fillOpacity: 0.75, weight: 0,
                    opacity: 1
                }
                );
                filtered_group.addLayer(layer);
            }
            else {
                layer.setStyle({
                    fillOpacity: 0, weight: 0,
                    opacity: 0,
                })
            }
        }
        );
    }


    window.reset_colors = function () {

        // this function could be optimized by changning load_fnp like load_locs
        self_selected_layer_list.map(remove_layer)
        self_selected_layer_list = []

        remove_layer(fnp_bonn)
        load_fnp()

        map.fitBounds(fnp_bonn.getBounds());
        // fnp_bonn.eachLayer(function (layer) {
        //     var lay_color = getColor(layer.feature.properties.LAYER)
        //     layer.setStyle({
        //         fillColor: lay_color, fillOpacity: 0.75, weight: 0,
        //         opacity: 1
        //     })
        // }
        // );

        // // click two times to refresh for some reason
        // $(".leaflet-control-layers-selector").click()
        // $(".leaflet-control-layers-selector").click()

        //remove any previously added selection layer
        //remove_layer(filtered_group)

    }

    window.points_in_selection = function () {

        var pointy = location_csv.map(function (p) {
            return [
                parseFloat(p[1]),
                parseFloat(p[0]),
                parseFloat(p[2]),
                parseFloat(p[3]),
                parseFloat(p[4]),
                p[5]

            ]
        })

        filtered_points = turf.pointsWithinPolygon(turf.points(pointy), filtered_group.toGeoJSON()) // points, (multi)polygon

        filtered_points["features"].forEach(switch_xy)
        return filtered_points
    }

     // fix for hexbin layer control
        L.HexbinLayer.prototype.onRemove = function(map) {
        L.SVG.prototype.onRemove.call(this);
        // Destroy the svg container
        this._destroyContainer();
        // Remove events
        map.off({ 'moveend': this.redraw }, this);
        this._map = null;
        // Explicitly will leave the data array alone in case the layer will be shown again
        //this._data = [];
        d3.select(this._container).remove();
      };

    load_json()
    add_hll_data()

    // click handlers
    // when layer is drawn, add to self drawn and append to list
    self_drawn_layer_list = []

    // geoman polygon creation handler
    map.on('pm:create', ({ workingLayer }) => {
        //remove_layer(self_drawn)
        self_drawn = map.pm.getGeomanDrawLayers(true)

        //try{layerControl.removeLayer(self_drawn)} catch{}
        //layerControl.removeLayer(self_drawn)

        // delete from layer control, otherwise every time a new polygon is drawn, a new layer will be added to layer control only not individually but 1, 1+2, 1+2+3 etc.
        if (self_drawn_layer_list.length > 0) {
            self_drawn_layer_list.map(remove_layer_from_layer_control_only)
        }

        self_drawn_layer_list.push(self_drawn)
        filter_map_data_by_polygon(self_drawn, "Filter Polygon")
    });


    // on click handlers
    $("#cluster_toggle").click(function () { return (this.tog = !this.tog) ? markers.disableClustering() : markers.enableClustering(); });
    $("#flyto").on("click", function () { map.flyTo([50, 8], 16); });
    $("#reset_map").on("click", simple_reset_map);
    $("#load_locs").on("click", load_locs);
    $("#load_fnp").on("click", function () { load_fnp(); $("#FNP_Selector").removeAttr('hidden') }); // display select options for FNP
    $("#reset_fnp_colors").on("click", reset_colors);
    $("#remove_self_drawn").on("click", function () { remove_layer(self_drawn) });
    $("#submit_query").on("click", function () { custom_query_hex_bins() });
    $("#remove_query").on("click", remove_query_hex_bins);
    $("#add_hexbins").on("click", function () { add_hexlayer(location_csv) });
    $("#remove_hexbins").on("click", remove_hexlayer);


    self_selected_layer_list = []
    $("#FNP_select").on("change", function () {
        var that = this.value
        var that_name = FNP_dict[that]

        $("#spinner").removeAttr('hidden')

        //remove any previously added layer

        // timeout needed for some reason
        // when...done didn't work
        // without spinner doesn't show up 
        setTimeout(
            function () {
                color_selected_features(that);
                filter_map_data_by_polygon(filtered_group, that_name, selection_layer = true) //, add_to_map = false)
            }, 50);
    })

    // alert with Instagram location info
    $(document).on('click', '.loc_info', function () { alert(JSON.stringify(bonn_strict_locs_dict[parseInt($(this).text())])) })

    $(document).on('click', '.submit_this_query', function () {
        custom_query_hex_bins($(this).closest('td').siblings(".query_td").text().replace(/ /g, ""), td_append = false)
    })
}) 
