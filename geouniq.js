#!/usr/bin/env node

var fs = require("fs");

var idProperty = process.argv[2],
    collection = JSON.parse(fs.readFileSync("/dev/stdin")),
    featureIds = {};

collection.features = collection.features.filter(function(feature) {
  var id = feature.properties[idProperty];
  if (id == null) throw new Error("id is required for geouniq");
  if (!(id in featureIds)) {
    featureIds[id] = 1;
    return true;
  }
});

console.log(JSON.stringify(collection))