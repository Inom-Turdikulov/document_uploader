<?php
// Run server
// php -S localhost:8888

$cors_disabled = True;
error_reporting(-1);
ini_set('display_errors', 'On');
header('Content-Type: application/json');

if ($cors_disabled){
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, POST');
  header("Access-Control-Allow-Headers: X-Requested-With");
}

$data = json_decode(file_get_contents('php://input'), true);

// Just for checking (return data to sender)
$output = array(
  "redirectUrl" => "http://crabbr.com/",
  "sendingData" => $data, // need remove this
);

echo json_encode($output);
