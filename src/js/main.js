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

// Global Variables
var $wrapper = $('#points-table'); // Table with results
var $notificationsWrapper = $('.uploader-container > .container:first-child'); // Where show alerts
var $slectPointsSwitcher = $('#slectPointsSwitcher');
var $totalFilesEl = $('#totalFiles');

var $pointsTableForm = $('#pointsTableForm');
var $pointsTableFormCollapse = $('#pointsTableFormCollapse');

var maxFileSize = 0; // JSON file size limit
var $submitButtonTrigger = $('#pointsUpload');

// Init defaults
var totalLoadedFiles = 0;
var _map, _markerCluster;
var globalPointsArray = [];
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
    pointData['review'] = ((point || {})['properties'] || {})['Review Comment'];
    pointData['rating'] = ((point || {})['properties'] || {})['Star Rating'];
    pointData['date'] = ((point || {})['properties'] || {})['Updated'];
    pointData['lat'] = ((((point || {})['properties'] || {})['Location'])['Geo Coordinates'] || {})['Latitude'];
    pointData['long'] = ((((point || {})['properties'] || {})['Location'])['Geo Coordinates'] || {})['Longitude'];

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

    // Add and merge duplicates items from jsonData!
    indexes = $.map(globalPointsArray, function(obj, index) {
      if(obj && obj.lat === pointData['lat'] && obj.long === pointData['long']) {
        return index;
      }
    });

    // Skip "not valid" markers
    var lat = parseFloat(pointData['lat']);
    var long = parseFloat(pointData['long']);
    if (!validCoords(lat, long)){
      invaldPointsNum += 1;
      continue;
    }

    if (indexes.length){
      for (var j = 0, indexesLength = indexes.length; j < indexesLength; j++) {
        $.extend(globalPointsArray[indexes[j]], pointData);


        writeUpdateRow($wrapper.find('tbody'), globalPointsArray[indexes[j]], indexes[j], indexes[j]);
      }
    }
    else{
      globalPointsArray.push(pointData);

      // New marker
      var marker = new google.maps.Marker({position: new google.maps.LatLng(lat, long)});
      _markers.push(marker);

      writeUpdateRow($wrapper.find('tbody'), pointData, globalPointsArray.length - 1)
    }
  }

  if (invaldPointsNum > 0){
    return invaldPointsNum;
  }
  else{
    return 0;
  }
}

function writeUpdateRow($wrapper, pointData, id, index){
  index = typeof index !== 'undefined' ? index : -1;

  // New row
  var $newRow = $('<tr>', {});

  // Checkbox
  $newRow.append($('<td>', {
    append: $('<input>', {
      type: 'checkbox',
      id: 'point-' + id,
      name: 'points[]',
      checked: 'checked'
    })
  }));

  // All items
  for (var tj in pointData) {
    $newRow.append($('<td>').text(pointData[tj]));
  }

  if (index >= 0){
    $wrapper.find('tr').eq(index).replaceWith($newRow);
  }
  else{
    $wrapper.append($newRow);
  }
}

// Main Code
$(function() {
  // Click on $wrapper tr, activates it's checkbox
  $wrapper.on('click', 'tr', function(e) {
    $currentCheckbox = $(this).find('input[type=checkbox]');

    if (! $(e.target).is($currentCheckbox)){
      if ($currentCheckbox.length){
        $currentCheckbox.prop('checked', !$currentCheckbox.prop("checked")).change();
      }
    }
  });

  $slectPointsSwitcher.click(function () {
    $checkboxes = $wrapper.find('input[type=checkbox]');
    $checkboxes.prop('checked', $slectPointsSwitcher.prop("checked")).change();
  });

  $submitButtonTrigger.click(function () {
    var activeCheckboxesLength = $wrapper.find('input[type=checkbox]:checked').length;
    if (activeCheckboxesLength > 0){
      $pointsTableForm.submit();
    }
    else{
      if (dotsInitialized){
        $notificationsWrapper.bs_alert('Failed to load points, please select at least one!', '', 10, 'alert-danger');
      }
      else{
        $notificationsWrapper.bs_alert('Failed to load points, please load some and select at least one!', '', 10, 'alert-danger');
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
