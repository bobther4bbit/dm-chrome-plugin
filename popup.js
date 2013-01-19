var bgPage = chrome.extension.getBackgroundPage();

window.onload = chrome.extension.getBackgroundPage().console.log('Popup loading')

// Add listener for button click
// **** IMPORTANT ****
// inline scripts and inline event handlers like onclick() DO NOT WORK ANYMORE!
document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#' + bgPage.BUTTON_DOWNLOAD_ID).addEventListener('click', clickOnDownload);
  document.querySelector('#' + bgPage.BUTTON_STARTSTOP_ID).addEventListener('click', clickOnStartStop);
  document.querySelector('#' + bgPage.BUTTON_SHOWTHUMBNAIL_ID).addEventListener('click', clickOnShowThumbnail);
});

// Update the buttons' state once if needed
refreshButtonsState();
// To let know when a popup is being closed (and remove the listener)
var port = chrome.extension.connect({name: "popupclosing"});
// Add listener for when a button state might have change
bgPage.addItemReadyListener(refreshButtonsState);


// Refresh the html buttons based on the readyness of the URLs
function refreshButtonsState(){
  getActiveTab(function(tab){
      if(bgPage.sniffedMediaUrls.hasOwnProperty(tab.id)){
        document.querySelector('#' + bgPage.BUTTON_DOWNLOAD_ID).disabled = false;
      } else {
        document.querySelector('#' + bgPage.BUTTON_DOWNLOAD_ID).disabled = true;
      }

      if(bgPage.sniffedThumbnailUrls.hasOwnProperty(tab.id))
        document.querySelector('#' + bgPage.BUTTON_SHOWTHUMBNAIL_ID).disabled = false;
      else
        document.querySelector('#' + bgPage.BUTTON_SHOWTHUMBNAIL_ID).disabled = true;
  });
}

// Called when user click the show thumbnail button
function clickOnShowThumbnail(){
  getActiveTab( function(tab){
    var bgPage = chrome.extension.getBackgroundPage()
    bgPage.showThumbnailPreview(tab);
  });
}

// Called when button "Download" is clicked
function clickOnDownload(e){
  // Get current tab and call download
  getActiveTab( function(tab){
    startDownload(tab);
  });
}

// Retrieve the active tab, i.e. the one where the popup is currently visible
function getActiveTab(callback){
  chrome.tabs.query({active: true}, function(arrayOfTabs) {
    if(arrayOfTabs.length > 0){
      // it should be only one...
      callback(arrayOfTabs[0]);
    }
  });
}

// Called when Start/Stop button is called
var areWeSniffing = true
function clickOnStartStop(){
  var bgPage = chrome.extension.getBackgroundPage()
  var text = "Stop sniffing"
  if(areWeSniffing){
    // Then button says Stop sniffing, and should be changed
    text = "Start sniffing";
    bgPage.stopSniffing();
  } else 
    bgPage.startSniffing
  
  document.querySelector('#' + BUTTON_STARTSTOP_ID).textContent = text;
  areWeSniffing = !areWeSniffing
}

// Start the download from background page
function startDownload(tab) {
  var bgPage = chrome.extension.getBackgroundPage()
  bgPage.downloadPageVideo(tab);
}


