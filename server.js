var SCRAPERS = [],
    scraper = require('./scraper/scraper.js'),
    fs = require('fs');

// Get all the free Harvey housing from AirBnB
SCRAPERS.push(scraper.addScraper({
    "type": "airbnb",
    "root_domain": "https://www.airbnb.com",
    "start_url": "https://www.airbnb.com/disaster/hurricaneharveyevacuees?test=test",
    "selector": ".listing-img a",
    "extract": "href"
}));