!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?n(require("d3"),require("d3-hexbin"),require("leaflet")):"function"==typeof define&&define.amd?define(["d3","d3-hexbin","leaflet"],n):n((t=t||self).d3,t.d3.hexbin)}(this,function(t,n){"use strict";var i=null!=t.hexbin?t.hexbin:null!=n?n.hexbin:null;L.HexbinLayer=L.SVG.extend({includes:L.Evented||L.Mixin.Events,options:{radius:12,opacity:.6,duration:200,colorScaleExtent:[1,void 0],radiusScaleExtent:[1,void 0],colorDomain:null,radiusDomain:null,colorRange:["#f7fbff","#08306b"],radiusRange:[4,12],pointerEvents:"all"},initialize:function(n){L.setOptions(this,n),this._fn={lng:function(t){return t[0]},lat:function(t){return t[1]},colorValue:function(t){return t.length},radiusValue:function(t){return Number.MAX_VALUE},fill:function(t){var n=this._fn.colorValue(t);return null!=n?this._scale.color(n):"none"}},this._scale={color:t.scaleLinear(),radius:t.scaleLinear()},this._dispatch=t.dispatch("mouseover","mouseout","click"),this._hoverHandler=L.HexbinHoverHandler.none(),this._hexLayout=i().radius(this.options.radius).x(function(t){return t.point[0]}).y(function(t){return t.point[1]}),this._data=[],this._scale.color.range(this.options.colorRange).clamp(!0),this._scale.radius.range(this.options.radiusRange).clamp(!0)},onAdd:function(t){L.SVG.prototype.onAdd.call(this),this._map=t,t.on({moveend:this.redraw},this),this.redraw()},onRemove:function(t){L.SVG.prototype.onRemove.call(this),this._destroyContainer(),t.off({moveend:this.redraw},this),this._map=null},_initContainer:function(){L.SVG.prototype._initContainer.call(this),this._d3Container=t.select(this._container).select("g")},_destroyContainer:function(){},redraw:function(){var t=this;if(t._map){var n=t._data.map(function(n){var i=t._fn.lng(n),e=t._fn.lat(n);return{o:n,point:t._project([i,e])}}),i=this._d3Container.selectAll("g.hexbin").data([this._map.getZoom()],function(t){return t}),e=i.enter().append("g").attr("class",function(t){return"hexbin zoom-"+t}).merge(i);i.exit().remove(),this._createHexagons(e,n)}},_createHexagons:function(t,n){var i=this,e=i._map.getBounds(),a=i._map.getSize();e=e.pad(2*i.options.radius/Math.max(a.x,a.y));var o=i._hexLayout(n),r=i._getExtent(o,i._fn.colorValue,i.options.colorScaleExtent),s=i._getExtent(o,i._fn.radiusValue,i.options.radiusScaleExtent),l=this.options.colorDomain;null==l&&(l=i._linearlySpace(r[0],r[1],i._scale.color.range().length));var u=this.options.radiusDomain||s;i._scale.color.domain(l),i._scale.radius.domain(u),o=o.filter(function(t){return e.contains(i._map.layerPointToLatLng(L.point(t.x,t.y)))});var c=t.selectAll("g.hexbin-container").data(o,function(t){return t.x+":"+t.y});c.select("path.hexbin-hexagon").transition().duration(i.options.duration).attr("fill",i._fn.fill.bind(i)).attr("fill-opacity",i.options.opacity).attr("stroke-opacity",i.options.opacity).attr("d",function(t){return i._hexLayout.hexagon(i._scale.radius(i._fn.radiusValue.call(i,t)))});var h=c.enter().append("g").attr("class","hexbin-container");h.append("path").attr("class","hexbin-hexagon").attr("transform",function(t){return"translate("+t.x+","+t.y+")"}).attr("d",function(t){return i._hexLayout.hexagon(i._scale.radius.range()[0])}).attr("fill",i._fn.fill.bind(i)).attr("fill-opacity",.01).attr("stroke-opacity",.01).transition().duration(i.options.duration).attr("fill-opacity",i.options.opacity).attr("stroke-opacity",i.options.opacity).attr("d",function(t){return i._hexLayout.hexagon(i._scale.radius(i._fn.radiusValue.call(i,t)))}),h.append("path").attr("class","hexbin-grid").attr("transform",function(t){return"translate("+t.x+","+t.y+")"}).attr("d",function(t){return i._hexLayout.hexagon(i.options.radius)}).attr("fill","none").attr("stroke","none").style("pointer-events",i.options.pointerEvents).merge(c.select("path.hexbin-grid")).on("mouseover",function(t,n){i._hoverHandler.mouseover.call(this,i,t,n),i._dispatch.call("mouseover",this,t,n)}).on("mouseout",function(t,n){i._dispatch.call("mouseout",this,t,n),i._hoverHandler.mouseout.call(this,i,t,n)}).on("click",function(t,n){i._dispatch.call("click",this,t,n)});var d=c.exit();d.select("path.hexbin-hexagon").transition().duration(i.options.duration).attr("fill-opacity",0).attr("stroke-opacity",0).attr("d",function(t){return i._hexLayout.hexagon(0)}),d.transition().duration(i.options.duration).remove()},_getExtent:function(n,i,e){var a=t.extent(n,i.bind(this));return null==a[0]&&(a[0]=0),null==a[1]&&(a[1]=0),null!=e[0]&&(a[0]=e[0]),null!=e[1]&&(a[1]=e[1]),a},_project:function(t){var n=this._map.latLngToLayerPoint([t[1],t[0]]);return[n.x,n.y]},_getBounds:function(t){if(null==t||t.length<1)return{min:[0,0],max:[0,0]};var n=[[999,999],[-999,-999]];return t.forEach(function(t){var i=t.point[0],e=t.point[1];n[0][0]=Math.min(n[0][0],i),n[0][1]=Math.min(n[0][1],e),n[1][0]=Math.max(n[1][0],i),n[1][1]=Math.max(n[1][1],e)}),{min:n[0],max:n[1]}},_linearlySpace:function(t,n,i){for(var e=new Array(i),a=(n-t)/Math.max(i-1,1),o=0;o<i;++o)e[o]=t+o*a;return e},radius:function(t){return arguments.length?(this.options.radius=t,this._hexLayout.radius(t),this):this.options.radius},opacity:function(t){return arguments.length?(this.options.opacity=t,this):this.options.opacity},duration:function(t){return arguments.length?(this.options.duration=t,this):this.options.duration},colorScaleExtent:function(t){return arguments.length?(this.options.colorScaleExtent=t,this):this.options.colorScaleExtent},radiusScaleExtent:function(t){return arguments.length?(this.options.radiusScaleExtent=t,this):this.options.radiusScaleExtent},colorRange:function(t){return arguments.length?(this.options.colorRange=t,this._scale.color.range(t),this):this.options.colorRange},radiusRange:function(t){return arguments.length?(this.options.radiusRange=t,this._scale.radius.range(t),this):this.options.radiusRange},colorScale:function(t){return arguments.length?(this._scale.color=t,this):this._scale.color},radiusScale:function(t){return arguments.length?(this._scale.radius=t,this):this._scale.radius},lng:function(t){return arguments.length?(this._fn.lng=t,this):this._fn.lng},lat:function(t){return arguments.length?(this._fn.lat=t,this):this._fn.lat},colorValue:function(t){return arguments.length?(this._fn.colorValue=t,this):this._fn.colorValue},radiusValue:function(t){return arguments.length?(this._fn.radiusValue=t,this):this._fn.radiusValue},fill:function(t){return arguments.length?(this._fn.fill=t,this):this._fn.fill},data:function(t){return arguments.length?(this._data=null!=t?t:[],this.redraw(),this):this._data},dispatch:function(){return this._dispatch},hoverHandler:function(t){return arguments.length?(this._hoverHandler=null!=t?t:L.HexbinHoverHandler.none(),this.redraw(),this):this._hoverHandler},getLatLngs:function(){var t=this;return this._data.map(function(n){return L.latLng(t.options.lat(n),t.options.lng(n))})},toGeoJSON:function(){return L.GeoJSON.getFeature(this,{type:"LineString",coordinates:L.GeoJSON.latLngsToCoords(this.getLatLngs(),0)})}}),L.HexbinHoverHandler={tooltip:function(n){null==(n=n||{}).tooltipContent&&(n.tooltipContent=function(t){return"Count: "+t.length});var i=t.select("body").append("div").attr("class","hexbin-tooltip").style("z-index",9999).style("pointer-events","none").style("visibility","hidden").style("position","fixed");return i.append("div").attr("class","tooltip-content"),{mouseover:function(e,a){var o=t.event,r=t.mouse(this);i.style("visibility","visible").html(n.tooltipContent(a,e));var s=null;null!=i._groups&&i._groups.length>0&&i._groups[0].length>0&&(s=i._groups[0][0]);var l=s.clientHeight,u=s.clientWidth;i.style("top",""+o.clientY-r[1]-l-16+"px").style("left",""+o.clientX-r[0]-u/2+"px")},mouseout:function(t,n){i.style("visibility","hidden").html()}}},resizeFill:function(){return{mouseover:function(n,i){t.select(this.parentNode).select("path.hexbin-hexagon").attr("d",function(t){return n._hexLayout.hexagon(n.options.radius)})},mouseout:function(n,i){t.select(this.parentNode).select("path.hexbin-hexagon").attr("d",function(t){return n._hexLayout.hexagon(n._scale.radius(n._fn.radiusValue.call(n,t)))})}}},resizeScale:function(n){return null==(n=n||{}).radiusScale&&(n.radiusScale=.5),{mouseover:function(i,e){t.select(this.parentNode).select("path.hexbin-hexagon").attr("d",function(t){return i._hexLayout.hexagon(i._scale.radius.range()[1]*(1+n.radiusScale))})},mouseout:function(n,i){t.select(this.parentNode).select("path.hexbin-hexagon").attr("d",function(t){return n._hexLayout.hexagon(n._scale.radius(n._fn.radiusValue.call(n,t)))})}}},compound:function(t){return null==(t=t||{}).handlers&&(t.handlers=[L.HexbinHoverHandler.none()]),{mouseover:function(n,i){var e=this;t.handlers.forEach(function(t){t.mouseover.call(e,n,i)})},mouseout:function(n,i){var e=this;t.handlers.forEach(function(t){t.mouseout.call(e,n,i)})}}},none:function(){return{mouseover:function(){},mouseout:function(){}}}},L.hexbinLayer=function(t){return new L.HexbinLayer(t)},L.PingLayer=L.SVG.extend({includes:L.Evented||L.Mixin.Events,options:{duration:800,fps:32,opacityRange:[1,0],radiusRange:[3,15]},initialize:function(n){L.setOptions(this,n),this._fn={lng:function(t){return t[0]},lat:function(t){return t[1]},radiusScaleFactor:function(t){return 1}},this._scale={radius:t.scalePow().exponent(.35),opacity:t.scaleLinear()},this._lastUpdate=Date.now(),this._fps=0,this._scale.radius.domain([0,this.options.duration]).range(this.options.radiusRange).clamp(!0),this._scale.opacity.domain([0,this.options.duration]).range(this.options.opacityRange).clamp(!0)},onAdd:function(t){L.SVG.prototype.onAdd.call(this),this._map=t,this._running=!1,t.on({move:this._updateContainer},this)},onRemove:function(t){L.SVG.prototype.onRemove.call(this),this._destroyContainer(),t.off({move:this._updateContainer},this),this._map=null,this._data=null},_initContainer:function(){L.SVG.prototype._initContainer.call(this),this._d3Container=t.select(this._container).select("g")},_updateContainer:function(){this._updatePings(!0)},_destroyContainer:function(){},_getCircleCoords:function(t){var n=this._map.latLngToLayerPoint(t);return{x:n.x,y:n.y}},_addPing:function(t,n){null==this._data&&(this._data=[]);var i=[this._fn.lat(t),this._fn.lng(t)],e=this._getCircleCoords(i),a={data:t,geo:i,ts:Date.now(),nts:0};a.c=this._d3Container.append("circle").attr("class",null!=n?"ping "+n:"ping").attr("cx",e.x).attr("cy",e.y).attr("r",this._fn.radiusScaleFactor.call(this,t)*this._scale.radius.range()[0]),this._data.push(a)},_updatePings:function(t){var n=Date.now();null==this._data&&(this._data=[]);for(var i=-1,e=0;e<this._data.length;e++){var a=this._data[e],o=n-a.ts;if(this.options.duration<o)a.c.remove(),i=e;else if(t||a.nts<n){var r=this._getCircleCoords(a.geo);a.c.attr("cx",r.x).attr("cy",r.y).attr("r",this._fn.radiusScaleFactor.call(this,a.data)*this._scale.radius(o)).attr("fill-opacity",this._scale.opacity(o)).attr("stroke-opacity",this._scale.opacity(o)),a.nts=Math.round(n+1e3/this.options.fps)}}return i>-1&&this._data.splice(0,i+1),this._running=this._data.length>0,this._running&&(this._fps=1e3/(n-this._lastUpdate),this._lastUpdate=n),!this._running},_expirePings:function(){for(var t=-1,n=Date.now(),i=0;i<this._data.length;i++){var e=this._data[i],a=n-e.ts;if(!(this.options.duration<a))break;e.c.remove(),t=i}t>-1&&this._data.splice(0,t+1)},duration:function(t){return arguments.length?(this.options.duration=t,this):this.options.duration},fps:function(t){return arguments.length?(this.options.fps=t,this):this.options.fps},lng:function(t){return arguments.length?(this._fn.lng=t,this):this._fn.lng},lat:function(t){return arguments.length?(this._fn.lat=t,this):this._fn.lat},radiusRange:function(t){return arguments.length?(this.options.radiusRange=t,this._scale.radius().range(t),this):this.options.radiusRange},opacityRange:function(t){return arguments.length?(this.options.opacityRange=t,this._scale.opacity().range(t),this):this.options.opacityRange},radiusScale:function(t){return arguments.length?(this._scale.radius=t,this):this._scale.radius},opacityScale:function(t){return arguments.length?(this._scale.opacity=t,this):this._scale.opacity},radiusScaleFactor:function(t){return arguments.length?(this._fn.radiusScaleFactor=t,this):this._fn.radiusScaleFactor},ping:function(n,i){if(this._addPing(n,i),this._expirePings(),!this._running&&this._data.length>0){this._running=!0,this._lastUpdate=Date.now();var e=this;t.timer(function(){e._updatePings.call(e,!1)})}return this},getActualFps:function(){return this._fps},data:function(){return this._data}}),L.pingLayer=function(t){return new L.PingLayer(t)}});