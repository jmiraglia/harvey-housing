'use strict';
var noodle = require('noodlejs'),
    json2csv = require('json2csv'),
    fs = require('fs'),
    XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

module.exports = {
    addScraper: addScraper
}

function addScraper(options){
    var scraped = [],       // Scraped pages will go here
        queue = [],                 // Queue of pages
        scraping = [],              // Currently being scraped
        crawler = null,             // Interval loop to process the queue
        PAGE_LOAD_INTERVAL = 300,   // How often to process next queue item
        STORAGE_FILE = "airbnb.csv";// File name to store results in


    function init(){
        // Start out by writing to the destination file to start with an empty file
        fs.writeFile(STORAGE_FILE, '', function(err){
            if(err){
                return console.log(err);
            } else {
                console.log('File was saved!');
            }
        });

        // Add the root URL to load all listings from
        addStartingPoint(options.start_url);

        // Get the number of pages of results
        noodle.query({
            "url": options.start_url,
            "type": "html",
            "selector": ".pagination li a",
            "extract": "html",
            "cache": "false"
        })
            .then(function (results) {
                results = results.results[0].results;

                // Load all paginated listings
                for(var p=2;p<=parseInt(results[results.length-2]);p++){
                // for(var p=2;p<=3;p++){
                    addStartingPoint(options.start_url + '&page=' + p);
                }

                console.log('There are ' + results[results.length-2] + ' paginated pages');
            });

        // Start the crawler processing the queue
        crawler = setInterval(processQueue, PAGE_LOAD_INTERVAL);
    }

    // Scrape a page full of listings
    function addStartingPoint(url){
        console.log('Adding new starting point: ' + url);
        noodle.query({
            "url": url,
            "type": "html",
            "selector": options.selector,
            "extract": "href",
            "cache": "false"
        })
            .then(function (results) {
                // Process the results of listings for individual page load
                processListings(results.results[0].results);
            });
    }

    // Helper function to return only the pagename from a URL
    function getPageName(url){
        return url.replace(/^.*\//, "").replace(/\?.*$/, "");

    }

    // Loop through all provided listings and load the listingInfo for each
    function processListings(pages){
        for(var p=0;p<pages.length;p++){
            getListingInfo(getPageName(pages[p]));
        }
    }

    // Generate task to be pushed to queue
    function getListingInfo(location_id){
        var url = options.api_url + '/v2/listings/' + location_id + '?client_id=3092nxybyb0otqw18e8nh5nty&locale=en-US&currency=USD&_format=v1_legacy_for_p3&number_of_guests=1';

        addToQueue({
            'method': 'GET',
            'url': url,
            'callback': addListing
        });
    }

    // Add a task to the queue
    function addToQueue(prefs){
        var unique = true;

        // Make sure this page isn't already being processed or queued
        for(var i=0;i<scraped.length;i++){
            if(prefs.url == scraped[i]){
                unique = false;
            }
        }
        for(var i=0;i<scraping.length;i++){
            if(prefs.url == scraping[i].url){
                unique = false;
            }
        }
        for(var i=0;i<queue.length;i++){
            if(queue[i].url == prefs.url){
                unique = false;
            }
        }

        if(unique){
            queue.push(prefs);
        }
    }

    // Process the next item in the queue
    function processQueue(){
        // Move forward if there is an item left in the queue, otherwise check to see if we are finished
        if(queue.length > 0) {
            console.log('Processing: ' + scraping.length + ' | Queued: ' + queue.length + ' | Completed: ' + scraped.length);
            // Add last item from pages_to_crawl queue
            scraping.push(queue[queue.length - 1]);

            // Process the last item in the queue
            loadListing(scraping[scraping.length - 1]);

            queue.pop();
        } else if (scraped.length > 30 && scraping.length == 0 && queue.length == 0){
            // console.log('**** FINISHED CRAWLING *****');
            // processResults();
        }
    }

    // Load the listing information using XHR
    function loadListing(prefs){
        var xhr = new XMLHttpRequest();

        function onReadyStateChange(){
            // If xhr is done and response was 200(ok) parse as JSON
            if(xhr.readyState == 4 && xhr.status == 200){
                try{
                    // Execute the callback function, passing the loaded data as well as used preferences
                    prefs.callback(JSON.parse(xhr.responseText), prefs);
                } catch (e){
                    console.error('Invalid Response from Server: ' + e);
                }
            }
        }

        xhr.onreadystatechange = onReadyStateChange;
        xhr.open(prefs.method, prefs.url, true);
        xhr.send();
    }

    // Put resulting data where it needs to go
    function addListing(listing, prefs){
        var show_header = false;

        listing.listing.pets_allowed = 'no';

        for(var n=0;n<listing.listing.amenities.length;n++){
            if(listing.listing.amenities[n] == 'Pets allowed'){
                listing.listing.pets_allowed = 'yes';

                break;
            }
        }

        if(scraped.length == 0 ){
            show_header = true;
        }
        // Add the listing url to the object before converting to CSV
        listing.listing.page_url = prefs.url;
        scraped.push(prefs.url);
        scraping.splice(scraping.indexOf(prefs), 1);

        // Fields to output to CSV
        var fields = ['name','page_url','additional_house_rules','pets_allowed','address','bathrooms','bedrooms','beds','bed_type','calendar_updated_at','city','description','house_rules','lat','lng','map_image_url','person_capacity','price','price_formatted','price_for_extra_person_native','property_type','public_address','notes'],
            field_names = ['Name','Page Url','Addtl House Rules','Pets Allowed','Address','Bathrooms','Bedrooms','Beds','Bed Type','Last Calendar Update','City','Description','House Rules','LAT','LNG','Map URL','Person Capacity','Price','$ Price','Price per Extra Person','Property Type','Public Address','Notes'],
            opts = {
                data: listing.listing,
                fields: fields,
                fieldNames: field_names,
                hasCSVColumnTitle: show_header
            };

        // Convert to CSV
        var csv = json2csv(opts, function(err, csv){
            if(err){
                console.error(err);
            } else {
                // Add this page to the STORAGE_FILE
                fs.appendFile(STORAGE_FILE, csv + '\n', function(err){
                    if(err){
                        return console.log(err);
                    } else {
                        console.log('File was saved!');
                    }});
            }
        });
    }

    // Write results to file
    function processResults(){
        clearInterval(crawler);
    }

    init();
}