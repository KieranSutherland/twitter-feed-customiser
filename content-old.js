let settings = {
    removeVerified: true,
    removeVideos: true
};

// Load settings when content script initializes
chrome.storage.sync.get({
    removeVerified: true,
    removeVideos: true
}, function (items) {
    settings = items;
    // Wait for tweets to be present before starting
    waitForTweetsAndFilter();
});

function areTweetsPresent() {
    const elements = document.querySelectorAll('[data-testid="cellInnerDiv"]');
    if (elements && elements.length > 0) {
        return true;
    }
    return false;
}

// Wait for tweets to be present before starting filtering
function waitForTweetsAndFilter() {
    if (areTweetsPresent()) {
        console.log("Tweets detected, starting filtering");
        filterContent();
        startObserver();
    } else {
        console.log("No tweets detected yet, waiting...");
        setTimeout(waitForTweetsAndFilter, 300);
    }
}

// Listen for settings changes from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "updateSettings") {
        settings.removeVerified = message.removeVerified;
        settings.removeVideos = message.removeVideos;
        // Re-run filtering with new settings
        filterContent();
        sendResponse({ status: "Settings updated" });
    }
    return true;
});

function filterContent() {
    // Remove verified posts
    if (settings.removeVerified) {
        const verifiedSelectors = [
            '[aria-label*="verified"]',
            '[data-testid*="verified"]',
            '.verified-badge',
        ];

        verifiedSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(badge => {
                findAndRemoveCellInnerDiv(badge);
            });
        });
    }

    // Remove posts with videos
    if (settings.removeVideos) {
        const videoSelectors = [
            'video',
            '.video-player',
            '[data-testid*="videoPlayer"]',
            '[role="video"]',
            '.gif-player',
            '[data-media-type="video"]',
            '.video-container',
            '.media-video',
            '[data-testid="videoComponent"]',
            '.tWeCl',
            '.kvgmc6g5',
            '.tiktok-embed',
            'iframe[src*="youtube.com"]',
            'iframe[src*="youtu.be"]'
        ];

        videoSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(videoElement => {
                findAndRemoveCellInnerDiv(videoElement);
            });
        });
    }
}

// Helper function to find and remove the cellInnerDiv parent
function findAndRemoveCellInnerDiv(element) {
    // Final safety check right before deletion
    if (!areTweetsPresent()) {
        console.log("There are no tweets to delete");
        return false;
    }

    let current = element;

    // Traverse up the DOM tree to find cellInnerDiv
    while (current && current !== document.body) {
        if (current.getAttribute('data-testid') === 'cellInnerDiv') {
            current.style.display = 'none';
            return true;
        }
        current = current.parentElement;
    }

    return false;
}

// Function to set up the mutation observer
function startObserver() {
    console.log("Starting observer");
    const observer = new MutationObserver(function (mutations) {
        // Only run filtering if tweets are present
        if (areTweetsPresent()) {
            filterContent();
        }
    });

    // Start observing document changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}