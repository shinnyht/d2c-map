var client = null;
var map = null;
var sensorInfo = {};
var name2id = {};

var currentPositionMarker = null;
var currentInfoWindow = null;
var states = {
  'isOpened': false
};

/*
 *  PAGE MANAGING FUNCTION
 *
 */
function pagination() {
  if (!states.isOpened) {
    openSidePage();
  }
  else {
    closeSidePage();
  }
}
function openSidePage() {
  $('#result-area').css('z-index', 200);
  states.isOpened = true;
}
function closeSidePage() {
  $('#result-area').css('z-index', 0);
  states.isOpened = false;
}

/*
 *  SEARCHING FUNCTION
 *
 */
function searchEnter() {
  var locationQuery = $('#location-query').val();
  var wordQuery = $('#freewd-query').val();

  if (window.event.keyCode == 13 && locationQuery) {
    $('#location-query').blur();
    $('#loading').fadeIn();
    ajaxGLocAPI(locationQuery);
  }
}
function search() {
  var locationQuery = $('#location-query').val();
  var wordQuery = $('#freewd-query').val();

  if (searchQuery) {
    $('#loading').fadeIn();
    ajaxGLocAPI(locationQuery);
  }
}
function ajaxGLocAPI(searchQuery) {
  var param = {
    query: searchQuery,
    key: API_KEY
  };

  $.ajax({
    url: 'https://d2c.cloud.ht.sfc.keio.ac.jp/proxy.php',
    type: 'GET',
    data: param,
    dataType: 'jsonp',
    jsonp: 'callback',
    success: function(json, status) {
      var results = json.results;
      if (results.length > 0) {
        var lat = results[0].geometry.location.lat;
        var lng = results[0].geometry.location.lng;
        panMap(lat, lng);
        getSensorsByLocation(lat, lng);
      }
    },
    error: function(json, status) {
      alert('ERROR, SEE LOG');
    }
  });
}
function getSensorsByLocation(lat, lng) {
  console.debug(lat + ',' + lng);
  $.ajax({
    url: "https://d2c.cloud.ht.sfc.keio.ac.jp/api/search",
    type: "GET",
    dataType: "json",
    data: {
      lat: lat,
      lng: lng,
      radius: 1000
    },
    success: function(json, status) {
      clearAll();
      updateDic(json.nodelist);
      alert(json.time);
      $('#search-time').html(json.time);
      $('#loading').fadeOut();
      openSidePage();
      setMarker(json.nodelist);
      subscribeDevices(json.nodelist);
    }
  });
}
function radarSearch(pos) {
  $.ajax({
    url: "https://d2c.cloud.ht.sfc.keio.ac.jp/api/search",
    type: "GET",
    dataType: "json",
    data: {
      lat: pos.lat,
      lng: pos.lng,
      radius: 1000
    },
    success: function(json, status) {
      updateDic(json.nodelist);
      alert(json.time);
      $('#search-time').html(json.time);
      $('#loading').fadeOut();
      setMarker(json.nodelist);
      subscribeDevices(json.nodelist);
    }
  });
}

/*
 *  MAP MANAGING FUNCTION
 *
 */
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    mapTypeControl: false,
    center: INIT_MAP_CENTER,
    zoom: 17
  });

  google.maps.event.addListener(map, 'click', function(event) {
    if (currentInfoWindow) {
      closeInfoWindow();
      return;
    }
    if (states.isOpened) {
      closeSidePage();
      return;
    }
  });

  google.maps.event.addListener(map, 'dragend', function() {
    var searchQuery = $('#location-query').val();
    if (searchQuery) {
      $('#loading').fadeIn();
      var mapCenter = map.getCenter();
      radarSearch(mapCenter);
    }
  });

  var set = google.maps.InfoWindow.prototype.set;
  google.maps.InfoWindow.prototype.set = function(key, val) {
    if (key === "map") {
      if (! this.get("noSuppress")) {
        return;
      }
    }
    set.apply(this, arguments);
  }
}
function panMap(lat, lng) {
  map.setZoom(17);
  map.panTo(new google.maps.LatLng(lat, lng));
}
function setMarker(sensors) {
  for (i in sensors) {
    var markerPos = {
      lat: sensors[i].latitude,
      lng: sensors[i].longitude
    };

    var id = sensors[i].id;
    var contentString = '<p>' + sensors[i].nodeid + '</p>';

    if (!sensorInfo[id]) {
      sensorInfo[id] = {};
    }
    sensorInfo[id].infoWindow = new google.maps.InfoWindow({
      content: contentString,
      noSuppress: true
    });
    sensorInfo[id].marker = new google.maps.Marker({
        position: markerPos,
        map: map,
        title: sensors[i].nodeid
    });

    markerEvent(sensorInfo[id].marker, id);
  }
}
function markerEvent(marker, id) {
  marker.addListener('click', function() {
    openSidePage();
    $('.accordion-content').each(function(i, elem) {
      $('.accordion').foundation('up', $(elem));
    });
    $('.accordion').foundation('down', $('#' + id + '-content'), true);
    window.location.href = '/map/#' + id;

    map.panTo(new google.maps.LatLng(marker.position.lat(), marker.position.lng()));
    openInfoWindow(id);
  });

  return;
}
function openInfoWindow(id) {
  if (currentInfoWindow) {
    currentInfoWindow.close();
  }
  sensorInfo[id].infoWindow.open(map, sensorInfo[id].marker);
  currentInfoWindow = sensorInfo[id].infoWindow;

  return;
}
function closeInfoWindow() {
  currentInfoWindow.close();
  currentInfoWindow = null;
  return;
}

/*
 *  SOX FUNCTION
 *
 */
function setSoxClient() {
  client = new SoxClient(BOSHSERVICE, XMPPSERVER);     
  var soxEventListener = new SoxEventListener();
  soxEventListener.connectionFailed = function(soxEvent) {
    console.log('ERR: Connection Failed');
    client.connect();
  };
  soxEventListener.subscriptionFailed = function(soxEvent){
    console.debug(soxEvent);
    var nodeName = soxEvent.device.nodeName;
    var id = name2id[nodeName];
    var dataString = "<li class='result accordion-item' id='" + id + "'>"
      + "<a href='#" + id + "-content' class='accordion-title' onClick=\"accordionTitleClicked('" + id + "')\">" + nodeName + "</a>"
      + "<div id='" + id + "-content' class='accordion-content' data-tab-content><ul>";
    for (i in soxEvent.device.transducers) {
      var dev = soxEvent.device;
      if (dev.transducers[i].id == 'url' || dev.transducers[i].id == 'latitude' ||
        dev.transducers[i].id == 'longitude') {
        // go next
      }
      else {
        dataString += "<li>" + dev.transducers[i].id + ": --";
        var unit =  dev.transducers[i].sensorData.unit;
        if (unit) {
         dataString += ' ' + unit; 
        }
        dataString += "</li>";
      }
    }
    dataString += "</ul></div></li>";

    // convert nodeName to nodeId
    if (!sensorInfo[id]) {
      sensorInfo[id] = {};
    }
    sensorInfo[id].detail = dataString;
    if (document.getElementById(id) != null) {
      $('#' + id).replaceWith(dataString);
    }
    else {
      $('.accordion').append(dataString);
    }
    Foundation.reInit('accordion');
    $('#result-num').html(Object.keys(name2id).length);
  };
  soxEventListener.sensorDataReceived = function(soxEvent){
    // create DOM element
    var nodeName = soxEvent.device.nodeName;
    var id = name2id[nodeName];
    var dataString = "<li class='result accordion-item' id='" + id + "'>"
      + "<a href='#" + id + "-content' class='accordion-title' onClick=\"accordionTitleClicked('" + id + "')\">" + nodeName + "</a>"
      + "<div id='" + id + "-content' class='accordion-content' data-tab-content><ul>";
    for (i in soxEvent.device.transducers) {
      var dev = soxEvent.device;
      if (dev.transducers[i].sensorData != null) {
        if (dev.transducers[i].sensorData.rawValue.lastIndexOf('data:image', 0) === 0) {
          dataString += "<li>" + dev.transducers[i].id  + ": " +
            "<img src='" + dev.transducers[i].sensorData.rawValue + "'/></li>";
        }
        else if (dev.transducers[i].id == 'url' || dev.transducers[i].id == 'latitude' ||
          dev.transducers[i].id == 'longitude') {
          // go next
        }
        else {
          dataString += "<li>" + dev.transducers[i].id + ": " +
            dev.transducers[i].sensorData.rawValue;
          var unit =  dev.transducers[i].sensorData.unit;
          if (unit) {
           dataString += ' ' + unit; 
          }
          dataString += "</li>";
        }
      }
    }
    dataString += "</ul></div></li>";

    // convert nodeName to nodeId
    if (!sensorInfo[id]) {
      sensorInfo[id] = {};
    }
    sensorInfo[id].detail = dataString;
    if (document.getElementById(id) != null) {
      $('#' + id).replaceWith(dataString);
    }
    else {
      $('.accordion').append(dataString);
    }
    Foundation.reInit('accordion');
    $('#result-num').html(Object.keys(name2id).length);
  };

  client.setSoxEventListener(soxEventListener);
  client.connect();
}
function subscribeDevices(sensors) {
  for (i in sensors) {
    var nodeid = sensors[i].nodeid;
    var device = new Device(nodeid);

    if(!client.subscribeDevice(device)){
      status("Couldn't send subscription request: " + device);
    }
  }
}


/*
 *  VARIABLE MANAGING FUNCTION
 *
 */
function clearAll() {
  for (id in sensorInfo) {
    sensorInfo[id].marker.setMap(null);
  }
  sensorInfo = {};
  name2id = {};
  $('.accordion').html('');

  return;
}
function updateDic(nodelist) {
  for (i in nodelist) {
    name2id[nodelist[i].nodeid] = nodelist[i].id;
  }
}
function successCallback(pos) {
  var positionLat = pos.coords.latitude;
  var positionLng = pos.coords.longitude;
  INIT_MAP_CENTER = {
    lat: positionLat,
    lng: positionLng
  };
  currentPositionMarker = new google.maps.Marker({
      position: INIT_MAP_CENTER,
      map: map,
      title: '現在地',
      icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
  });

  panMap(positionLat, positionLng);
}
function errorCallback(error) {
  window.alert('位置情報が読み取れませんでした');
}
function accordionTitleClicked(id) {
  marker = sensorInfo[id].marker;
  map.panTo(new google.maps.LatLng(marker.position.lat(), marker.position.lng()));
  openInfoWindow(id);
}

/*
 *  MAIN FUNCTION
 *
 */
var main = function() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
  }
  $(document).foundation();
  setSoxClient();
};

$(main);


