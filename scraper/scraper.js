'use strict';
var noodle = require('noodlejs'),
    fs = require('fs'),
    json2csv = require('json2csv');

module.exports = {
    addScraper: addScraper
}

function addScraper(options){
    var completed_pages = [],
        pages_to_crawl = [],
        pages_crawling = [],
        crawler = null,
        PAGE_LOAD_INTERVAL = 2000,
        STORAGE_FILE = "airbnb.json";

    function init(){
        fs.writeFile(STORAGE_FILE, '', function(err){
            if(err){
                return console.log(err);
            } else {
                console.log('File was saved!');
            }
        });

        addStartingPoint(options.start_url);

        // Get the maximum page of results
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
                for(var p=2;p<parseInt(results[results.length-2]);p++){
                    addStartingPoint(options.start_url + '&page=' + p);
                }

                console.log('There are ' + results[results.length-2] + ' paginated pages');
            });

        crawler = setInterval(crawlPage, PAGE_LOAD_INTERVAL);
    }

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
                crawlPages(results.results[0].results);
            });
    }

    function crawlPages(pages){
        // Add new pages to the queue to be crawled`
        for(var i=0;i<pages.length;i++){
            var duplicate = false;

            // Make sure we aren't already queued to crawl this page
            for(var c=0;c<pages_to_crawl.length;c++){
                if(pages_to_crawl[c] == pages[i]){
                    duplicate = true;
                }
            }

            for(var c=0;c<pages_crawling.length;c++){
                if(pages_crawling[c] == pages[i]){
                    duplicate = true;
                }
            }

            if(!duplicate){
                pages_to_crawl.push(pages[i]);
            }
        }
    }

    function crawlPage(){
        if(pages_to_crawl.length > 0){
            var page = pages_to_crawl[pages_to_crawl.length - 1];
            pages_crawling.push(page);
            pages_to_crawl.pop();

            console.log("Pages crawling: " + pages_crawling.length + " | pages to crawl: " + pages_to_crawl.length);

            noodle.query({
                "url": options.root_domain + page,
                "type": "html",
                "selector": "script",
                "extract": "html",
                "cache": "false"
            })
                .then(function (results) {
                    var target = null;
                    results = results.results[0].results;

                    if (options.type === 'airbnb'){
                        // Loop through the scripts to find the boostrap data containing the listing information
                        for(var n=0;n<results.length;n++){
                            if(results[n].search("bootstrapData") >= 0){
                                target = JSON.parse(results[n].replace("<!--","").replace("-->",""));
                            }
                        }

                        // Identify the data we want to store from this page
                        target = target.bootstrapData.listing;
                        target.page_url = page;

                        // Add newly parsed page
                        completed_pages.push(target);
                        // Remove this page from the queue
                        pages_crawling.splice(pages_crawling.indexOf(page), 1);

                        var fields = ["additional_house_rules","bathroom_label","bedroom_label","bedrooms","bed_label","beds","description","guest_label","house_rules","id","listing_amenities","listing_amenities_business_travel_rank_order","listing_expectations","listing_rooms","market","name","other_property_types","p3_subject","p3_summary_address","p3_summary_title","person_capacity","photos","primary_host","property_type_id","room_and_property_type","room_type_category","sectioned_description","space_interface","star_rating","summary","tier_id","user","book_it_url","calendar_last_updated_at","cancellation_policy","cancellation_policy_category","guest_controls","has_new_cancellation_policy","localized_minimum_nights_description","min_nights","native_currency","price_interface","should_show_complex_datepicker_prompt","show_policy_details","is_business_travel_ready","additional_hosts","alternate_sectioned_description_for_p3","description_locale","has_vendor_description","initial_description_author_type","localized_city","localized_listing_expectations","localized_room_type","machine_translation_source_language","city","city_guidebook","country","country_code","host_guidebook","lat","lng","location_title","neighborhood_community_tags","neighborhood_id","state","p3_event_data_logging","paid_growth_remarketing_listing_ids","commercial_host_info","disaster_id","disaster_name","license","p3_listing_flag_options","requires_license","flag_info","guest_country","is_viewer_korean","number_of_guests_hosted_from_country","should_hide_action_buttons","should_show_business_details","show_edit_mode","eligible_to_promote_reviews","p3_display_review_summary","p3_review_flag_options","review_details_interface","sorted_reviews","visible_review_count","cover_photo_primary","cover_photo_secondary","cover_photo_vertical","host_interaction","layout","nearby_airport_distance_descriptions","select_listing_tenets","space_type","hide_from_search_engines","instant_bookable_for_embed","p3_neighborhood_breadcrumb_details","p3_seo_breadcrumb_details","p3_seo_property_search_url","price_formatted_for_embed","seo_features","share_links","wishlisted_count_cached"];

                        var csv = json2csv({
                            data: target,
                            fields: fields
                        });

                        console.log('Finished crawling page: ' + page);
                        fs.appendFile(STORAGE_FILE, csv, function(err){
                            if(err){
                                return console.log(err);
                            } else {
                                console.log('File was saved!');
                            }});
                    }
                });
        } else if (pages_to_crawl.length == 0 && pages_crawling.length == 0 && completed_pages.length > 0){
            console.log('**** FINISHED CRAWLING *****');
            console.log(completed_pages);
            clearInterval(crawler);
        }
    }

    init();

    return this;
}