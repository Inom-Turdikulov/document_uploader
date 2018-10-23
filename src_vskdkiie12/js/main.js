// generate map
// fit bounds
// var ajv = new Ajv(); // options can be passed, e.g. {allErrors: true}
// var validate = ajv.compile(pointsJsonSchema);
// var valid = validate(jsonData);
// if (!valid) console.log(validate.errors);
// Main keys:
// lat, long
// if exist updata
// else add new
// if exist append
// Load 1 on 2 json files
// Sort by coords (distance)
// Merge equals
// Load json/generate marks
// Center Map
// ....
// Todo onerror
// Todo check json blob
// Todo check fileSize

// Update UI to seperate Found Reviews vs Found Locations. Found Review should only include locations that have a review added. Found Locations should only include locations that do not have reviews added.
// PHP Script to pull all checked locations into a PHP array and print it out (I will hook up from that location)
// Resolve issue with markercluster
// Check uploader in newest versions of Safari, Firefox, Edge, and Chrome to confirm functionality works. (We will not be allowing this page on mobile devices)
// check demo in browsers/fix stuff

// Global Variables
var remoteURL = 'http://localhost:8888/json_parse.php';
var globalDataPoints = [];
var $pointsTableReviews = $('#pointsTableReviews > tbody');
var $pointsTableLocations = $('#pointsTableLocations > tbody');

var $notificationsWrapper = $('.uploader-container > .container:first-child'); // Where show alerts
var $slectPointsSwitchers = $('[data-toggle-checkboxes]');
var $totalFilesEl = $('#totalFiles');

var $pointsTableForm = $('#pointsTableForm');
var $pointsTableFormCollapse = $('#pointsTableFormCollapse');

var maxFileSize = 0; // JSON file size limit
var $submitButtonTrigger = $('#pointsUpload');

var $reviewsElements = $('[data-toggle="found-reviews"]');
var $locationsElements = $('[data-toggle="found-locations"]');
var reviewsElementsShow = false;
var locationsElementsShow = false;

// Init defaults
var totalLoadedFiles = 0;
var _map, _markerCluster;
var _markers = [];
var dotsInitialized = false;

// Base Functions
function initGoogleMap() {
  var center = new google.maps.LatLng(37.4419, -122.1419);
  _map = new google.maps.Map(document.getElementById('google_map'), {
    zoom: 4,
    maxZoom: 4,
    center: center,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  _markerCluster = new MarkerClusterer(_map, null, {imagePath: '../img/m/m'});
}

function getPoints(jsonData) {
  try {
    jsonData = JSON.parse(jsonData); // No JSON schema checker!
  } catch (e) {
    return false;
  }

  if ('type' in jsonData && 'features' in jsonData && $.isArray(jsonData['features'])){
    return jsonData['features'];
  }
  else{
    return false;
  }
}

function parseData(jsonData, filename) {
  var invaldPointsNum = 0;
  var currentPoints = getPoints(jsonData);

  if (!currentPoints){
    $notificationsWrapper.bs_alert('Could not recognize your JSON file ($jsonFile), please check it!'.replace('$jsonFile', filename), '', 10)
    return false;
  }

  for (var i = 0, currentPointsLength = currentPoints.length; i < currentPointsLength; i++) {
    var point = currentPoints[i];
    var pointData = {};
    var indexes = [];

    pointData['name'] = (((point || {})['properties'] || {})['Location'] || {})['Business Name'];
    pointData['address'] = (((point || {})['properties'] || {})['Location'] || {})['Address'];
    pointData['review'] = ((point || {})['properties'] || {})['Review Comment'];
    pointData['rating'] = ((point || {})['properties'] || {})['Star Rating'];
    pointData['date'] = ((point || {})['properties'] || {})['Updated'];
    pointData['lat'] = ((((point || {})['properties'] || {})['Location'])['Geo Coordinates'] || {})['Latitude'];
    pointData['long'] = ((((point || {})['properties'] || {})['Location'])['Geo Coordinates'] || {})['Longitude'];

    if (pointData['review'] && !reviewsElementsShow){
      reviewsElementsShow = true;
      $reviewsElements.removeClass('d-none');
      console.log('reviews')
    }

    if (!pointData['review'] && !locationsElementsShow){
      locationsElementsShow = true;
      $locationsElements.removeClass('d-none');
      console.log('locations')
    }

    // CID specific
    var cid = ((point || "")['properties'] || "")['Google Maps URL'];
    if (cid){
      var cidRegex = cid.match(/cid=([^&]+)/);
      if (cidRegex){
        pointData['cid'] = cidRegex[1];
      }
    }
    else{
      pointData['cid'] = '';
    }

    // Skip "not valid" markers
    var lat = parseFloat(pointData['lat']);
    var long = parseFloat(pointData['long']);
    if (!validCoords(lat, long)){
      invaldPointsNum += 1;
      continue;
    }

    // Check data variable (depending of type)
    // Add and merge duplicates items from jsonData!
    indexes = $.map(globalDataPoints, function(obj, index) {
      if(obj && obj.lat === pointData['lat'] && obj.long === pointData['long']) {
        return index;
      }
    });

    if (indexes.length){
      for (var j = 0, indexesLength = indexes.length; j < indexesLength; j++) {
        if (globalDataPoints[indexes[j]]['review'] && !(pointData['review'])){
          continue // skip if point already have review!
        }

        globalDataPoints[indexes[j]] = pointData;
        writeUpdateRow(globalDataPoints[indexes[j]], indexes[j], indexes[j]);
      }
    }
    else{
      // Just add new item
      globalDataPoints.push(pointData);

      // New marker
      var marker = new google.maps.Marker({position: new google.maps.LatLng(lat, long)});
      _markers.push(marker);

      writeUpdateRow(pointData, globalDataPoints.length - 1)
    }
  }

  if (invaldPointsNum > 0){
    return invaldPointsNum;
  }
  else{
    return 0;
  }
}

function writeUpdateRow(pointData, id, index){
  index = typeof index !== 'undefined' ? index : -1;

  var $wrapper = $pointsTableReviews;
  if (!pointData['review']){
    $wrapper = $pointsTableLocations;
  }

  // New row
  var $newRow = $('<tr>', {});

  // Checkbox
  $newRow.append($('<td>', {
    append: $('<input>', {
      type: 'checkbox',
      id: 'point-' + id,
      'data-id': id,
      name: 'points[]',
      checked: 'checked'
    })
  }));

  // All items
  for (var tj in pointData) {
    $newRow.append($('<td>').text(pointData[tj]));
  }

  if (index >= 0){
    $pointsTableForm.find('#point-' + id).closest('tr').replaceWith($newRow);
  }
  else{
    $wrapper.append($newRow);
  }
}

// Main Code
$(function() {
  // Click on $pointsTableForm tr, activates it's checkbox
  $pointsTableForm.on('click', 'tr', function(e) {
    $currentCheckbox = $(this).find('input[type=checkbox]');

    if (! $(e.target).is($currentCheckbox)){
      if ($currentCheckbox.length){
        $currentCheckbox.prop('checked', !$currentCheckbox.prop("checked")).change();
      }
    }
  });

  $slectPointsSwitchers.each(function () {
    var $slectPointsSwitcher = $(this);

    $slectPointsSwitcher.click(function () {
      $checkboxes = $($(this).data('toggleCheckboxes')).find('input[type=checkbox]');
      $checkboxes.prop('checked', $slectPointsSwitcher.prop("checked")).change();
    });
  });

  $pointsTableForm.submit(function(e){
    e.preventDefault();
  });


  // Here we submit data
  $submitButtonTrigger.click(function (e) {
    e.preventDefault();

    var inactiveCheckboxes = $pointsTableForm.find('input[data-id]').not(':checked');
    var points;

    if (inactiveCheckboxes.length === globalDataPoints.length){
      points = [];
    }
    else if (inactiveCheckboxes.length === 0){
      points = globalDataPoints;
    }
    else{
      points = globalDataPoints.slice(0);

      for (var i = inactiveCheckboxes.length - 1; i >= 0; i--) {
        var index = parseInt($(inactiveCheckboxes[i]).data('id'));
        points.splice( index, 1 );
      }
    }

    if (points.length > 0){
      var request = new XMLHttpRequest();
      request.open('POST', remoteURL, true);

      request.onload = function() {
        if (request.status >= 200 && request.status < 400) {
          $('body').find('.random-result').remove();

          // Success!
          var data = JSON.parse(request.responseText);
          var $result = $('<div>', {'class': 'random-result'});

          $result.append('<p> Redirect to ' + data['redirectUrl'] + ' in 10 seconds</p>');
          $result.append('<code style="font-size: 10px">' + JSON.stringify(data['sendingData'].slice(1, 5)) + '</code>');
          $result.append('<hr>');
          $result.append('<code style="font-size: 10px">' + JSON.stringify(data['sendingData'].slice(-5, -1))  + '</code>');
          $('body').prepend($result);

          window.setTimeout(function (e) {
            window.location.href = data['redirectUrl'];
          }, 10000)
        } else {
          // We reached our target server, but it returned an error
          $notificationsWrapper.bs_alert('Serverside error, pleas try again!', '', 10, 'alert-danger');
        }
      };

      request.onerror = function() {
        // There was a connection error of some sort
        $notificationsWrapper.bs_alert('Some error occurred, pleas try again!', '', 10, 'alert-danger');
      };

      request.send(JSON.stringify(points));
    }
    else{
      if (dotsInitialized){
        $notificationsWrapper.bs_alert('Please select at least one point!', '', 10, 'alert-danger');
      }
      else{
        $notificationsWrapper.bs_alert('Failed to load points, please load and select at least one!', '', 10, 'alert-danger');
      }
    }

  });

  // Google Maps Init
  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDRd-KcWSU0gYkZbjHuC1GzgFr_NNsEpBc&callback=initGoogleMap";
  document.body.appendChild(script);

  // File Drop initialization
  if (window.File && window.FileList && window.FileReader) {
    var $dropContainer = $('[data-toggle="drop-container"]'),
      $jsonDrop        = $("#jsonDrop");

    $jsonDrop.on("dragover", function (e) {
      e.stopPropagation();
      e.preventDefault();
      $dropContainer.addClass('border-danger');
    });

    $jsonDrop.on("dragleave", function (e) {
      e.stopPropagation();
      e.preventDefault();
      $dropContainer.removeClass('border-danger');
    });

    $jsonDrop.on("drop, change", function (e) {
      e.stopPropagation();
      e.preventDefault();

      dotsInitialized = true;

      $pointsTableFormCollapse.collapse('show');

      $dropContainer.removeClass('border-danger');
      var reader = new FileReader();
      reader.onerror = function(e){};

      // fetch FileList object
      var files = e.target.files || e.dataTransfer.files;
      var invalidPointsNum = 0;
      var filesIterator = 0;

      // process all File objects
      for (var i = 0, f; f = files[i]; i++) {
        if (maxFileSize > 0 && f.size > maxFileSize){
          $notificationsWrapper.bs_alert('Your file too big, please check it! Allowed: ' + formatBytes(maxFileSize), '', 10, 'alert-danger');
          break
        }

        var jsonReader = new FileReader();
        jsonReader.onload = function(e) {
          var result = parseData(e.target.result, files[filesIterator].name);

          if (result !== false){
            totalLoadedFiles += 1;
          }

          if (result > 0){
            invalidPointsNum += result;
          }

          // Call when all JSON files loaded
          if (filesIterator === (files.length - 1) && totalLoadedFiles > 0){
            _markerCluster.addMarkers(_markers);
            var bounds = new google.maps.LatLngBounds();
            // Create bounds from markers
            for( var index in _markers ) {
              var latlng = _markers[index].getPosition();
              bounds.extend(latlng);
            }
            _markerCluster.fitMapToMarkers();
            var validPointsNum = _markers.length;
            var msg = "Total: $validPointsNum points".replace("$validPointsNum", validPointsNum)
            if (invalidPointsNum > 0){
              msg = msg + ". Skipped $invalidPointsNum not valid point(s).".replace("$invalidPointsNum", invalidPointsNum)
            }
            $notificationsWrapper.bs_alert(msg, '', 10);

            // Update total files badge

            $totalFilesEl.html('JSON files loaded: <span class="badge badge-secondary">' + totalLoadedFiles + '</span>');
            $totalFilesEl.addClass('show');
          }

          filesIterator += 1;
        };
        jsonReader.readAsText(f);
      }
    });
  }
});
