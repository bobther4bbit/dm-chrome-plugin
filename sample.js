/* TODO list
 * Does not work in private mode, can we do anything? (cookies are not shared with the plugin)
 * Check status of download (started successfull or cancelled?)
 */
 
var debug = true;
var QUALITY = "480"; //240, 380, 480, 720
// Sniffed URLs per tabId
/* V1 */
var sniffedMediaUrls = {};
var sniffedThumbnailUrls = {};
/* V2 (usp-ec) */
var f4mUrls = {};

// Listen for any changes to the URL of any tab.
chrome.tabs.onUpdated.addListener(checkForValidUrl);
// To know where a URL is being left
chrome.tabs.onUpdated.addListener(tabUpdated);
// Using Message API only to know when the Popup is closing
chrome.extension.onConnect.addListener(function(port) {
  console.assert(port.name == "popupclosing");
  // onDisconnect will be called when popup is closing
  port.onDisconnect.addListener(function(){
  	console.log("Popup is closing, removing itemReadyCallback")
  	addItemReadyListener(null);
  });
});


// Start sniffing the requests
startSniffing();

// Starts downloading the video present in the page (well, prompt the Save As dialog)
function downloadPageVideo(tab){
	if(sniffedMediaUrls.hasOwnProperty(tab.id)){
		getMediaLocation(sniffedMediaUrls[tab.id], 
			function(videoUrl){
				chrome.downloads.download(
					{url: videoUrl, saveAs: true, filename: tab.title, method: "GET"}, downloadStatus);
			}
		);
		return;
	}
	console.log("Nothing to download for this page");
}

// Show the thumbnail preview (in a new tab)
function showThumbnailPreview(tab){
	if(sniffedThumbnailUrls.hasOwnProperty(tab.id)){
		getMediaLocation(sniffedThumbnailUrls[tab.id], 
			function(videoUrl){
				var modifiedUrl = videoUrl.match(/video.*_mp4/i);
				if(modifiedUrl != null){
					modifiedUrl = modifiedUrl[0];
					modifiedUrl = modifiedUrl.substring(0, modifiedUrl.length-4); //removing the _
					modifiedUrl = "http://static2.dmcdn.net/static/" + modifiedUrl + ":jpeg_preview_contact.jpg";
					console.log("thumbnail url is: " + modifiedUrl);
					chrome.tabs.create({url: modifiedUrl});
				}
			}
		);
		
	}
}

// Called when the url of a tab changes.
function checkForValidUrl(tabId, changeInfo, tab) {
	// if(debug) // if in debug mode, show the pageAction on all tabs
	// 	chrome.pageAction.show(tabId);
	if (tab.url.substr(0,33) == "http://www.dailymotion.com/video/") {
    	// ... show the page action.
    	chrome.pageAction.show(tabId);
  	}
};

// Starts sniffing for targeted URLs
function startSniffing(){
	console.log("We have started to sniff requests to dailymotion");
	/*
     * Can contain URL pattern, tab id or window id
     * http://developer.chrome.com/extensions/webRequest.html
	 */
	var filter = {urls: ["http://www.dailymotion.com/cdn/manifest/video/*",
						 "http://usp-ec.dmcloud.net/*f4m*", "http://*.dmcdn.net/static/video/*large*"]}
	var opt_extraInfoSpec = [];
	chrome.webRequest.onBeforeRequest.addListener(sniffMediaUrls, filter, opt_extraInfoSpec);
}

// Called when a targeted URL is being sniffed
function sniffMediaUrls(details){
	if(details.tabId > 0){
		if(details.url.substr(0,45) == "http://www.dailymotion.com/cdn/manifest/video"){
			// Video URL
			sniffedMediaUrls[details.tabId] = details.url;
			sniffedThumbnailUrls[details.tabId] = details.url; // thumbnail is ready too then
			triggerItemReadyCallback();
			if(debug)
				console.log("Adding URL for tab "+ details.tabId+": " + details.url);	
		} else if(details.url.substr(0,25) == "http://usp-ec.dmcloud.net"){
			// This is one of the new videos then
			// detail.url is f4m (because that's the only one we have registered)
			console.log("f4m url: " + details.url);
			var f4m = new F4mUrl(details.url);
			console.log(f4m.getBeginning());
			console.log(f4m.objectId);
			console.log(f4m.getEnd());

			var videoObjectId = details.url.substr(51, 24);
			console.log("videoObjectId = " + videoObjectId);
			f4mUrls[details.tabId] = details.url;
			// TODO create an class for that full url, first part, last part, objectId
		} else {
			// Thumbnail URL
			sniffedThumbnailUrls[details.tabId] = details.url;
			triggerItemReadyCallback();
			if(debug)
				console.log("Adding thumbnail URL for tab "+ details.tabId+": " + details.url);
		}
	}
}

// Extracts usefull info from http://www.dailymotion.com/sequence/full/
function extractFromSequenceFull(videoId){
	var fullSeqUrl = "http://www.dailymotion.com/sequence/full/";
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(){ // To be executed when request is done
  		if(this.readyState == this.DONE) {
    		if(this.status == 200 && this.responseText != null) {
	      		// success!
	      		console.log(this.responseText);
	      		var sequence = JSON.parse(this.responseText);
	      		var videoUrl = "";
	      		for(var i=0; i < manifest.alternates.length; i++){
	      			console.log("name" + manifest.alternates.name);
	      			if(manifest.alternates[i].name == QUALITY){
	      				videoUrl = manifest.alternates[i].template;
	      				break;
	      			}
	      		}
	      		videoUrl = videoUrl.replace(".mnft",".mp4");
      		} else {
	    		// something went wrong
	    		console.log("Something went wrong when fetching full sequence url");
    		}
    	}
  	}
	xhr.open("GET", fullSeqUrl, true);
	xhr.send();
}

// Constructs the request and get real media location from server
function getMediaLocation(secureUrl, callback){
	// Unsecure the URL, i.e. remove cell=secure-vod& from URL
	var unsecureUrl = secureUrl; //.replace("cell=secure-vod&","");
	// GET it
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(){ // To be executed when request is done
  		if(this.readyState == this.DONE) {
    		if(this.status == 200 && this.responseText != null) {
	      		// success!
	      		console.log(this.responseText);
	      		var manifest = JSON.parse(this.responseText);
	      		var videoUrl = "";
	      		for(var i=0; i<manifest.alternates.length; i++){
	      			console.log("name" + manifest.alternates.name);
	      			if(manifest.alternates[i].name == QUALITY){
	      				videoUrl = manifest.alternates[i].template;
	      				break;
	      			}
	      		}
	      		videoUrl = videoUrl.replace(".mnft",".mp4");
	      		if(debug)
	      			console.log("We are going to fetch: " +videoUrl);
	      		callback(videoUrl); // callback the function that call me with the url as argument
      		} else {
	    		// something went wrong
	    		console.log("Something went wrong when fetching unsecure url");
    		}
    	}
  	}
	xhr.open("GET", unsecureUrl, true);
	xhr.send();
}

// Callback function for download
function downloadStatus(downloadId){
	if(downloadId != null)
		console.log("Download has started");
	else
		console.log("Download cancelled by user");
}

// For the popup to log things in the console
function logFromPopup(text){
	console.log(text)
}

// Stop sniffing any URLs
function stopSniffing(){
	chrome.webRequest.onBeforeRequest.removeListener(sniffMediaUrls);
 	console.log("We have stopped sniffing requests to dailymotion");
}

// Called when a tab is updated (url change, tab pinned, etc)
function tabUpdated(tabId, changeInfo, tab) {
	/*  if URL has changed, remove the URL we might have logged for this tab
		url ( optional string )
		The tab's URL if it has changed.
	*/
	if(changeInfo.url != null){
		if(sniffedMediaUrls.hasOwnProperty(tabId))
			delete sniffedMediaUrls[tabId];
		if(sniffedThumbnailUrls.hasOwnProperty(tabId))
			delete sniffedThumbnailUrls[tabId];
	}
}

/* UI STUFFS*/
var BUTTON_DOWNLOAD_ID = "download";
var BUTTON_STARTSTOP_ID = "startstop";
var BUTTON_SHOWTHUMBNAIL_ID = "showThumbnail";

var itemReadyCallback = null;

// For popup to register to the URL ready event (and refresh its buttons)
function addItemReadyListener(callback){
	itemReadyCallback = callback;
}

// Trigger the callback if any
function triggerItemReadyCallback(){
	if(itemReadyCallback != null){
		itemReadyCallback();
	}
}

/** F4mUrl
 *  represents a v2 (usp-ec) DM url pointing to a f4m file
 */
function F4mUrl (fullUrl) {
    this.fullUrl = fullUrl;
    this.objectId = fullUrl.substr(51, 24);
}
 
F4mUrl.prototype.getBeginning = function() {
    return this.fullUrl.substr(0, 51);
};

F4mUrl.prototype.getEnd = function(){
	return this.fullUrl.substr(75);
}

F4mUrl.prototype.increment = function(){}