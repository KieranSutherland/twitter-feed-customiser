let settings = {
    removeVerified: true,
    removeVideos: false
};

// Track processing state
let processingInProgress = false;
let lastProcessedTime = 0;
const THROTTLE_DELAY = 300; // ms
const processedElements = new WeakSet(); // More efficient than Set for DOM elements

// Track if the tab is active
let isTabActive = true;
let currentURL = window.location.href;
let observer = null;
let isFilteringActive = false;

// Add visibility change listener
document.addEventListener('visibilitychange', function () {
    isTabActive = document.visibilityState === 'visible';
    console.log(`Twitter Feed Customiser: Tab visibility changed. Is active: ${isTabActive}`);
});

// Check if we're on the Twitter home page
function isTwitterHomePage() {
    return window.location.href.includes('twitter.com/home') ||
        window.location.href.includes('x.com/home');
}

// Handle URL changes
function handleURLChange() {
    const newURL = window.location.href;

    // If URL has changed
    if (newURL !== currentURL) {
        console.log(`Twitter Feed Customiser: URL changed from ${currentURL} to ${newURL}`);
        currentURL = newURL;

        // Always check current state when URL changes
        checkAndUpdateFilteringState();
    }
}

// Check current page and update filtering state accordingly
function checkAndUpdateFilteringState() {
    if (isTwitterHomePage()) {
        console.log("Twitter Feed Customiser: On Twitter home, should be filtering");

        // Only initialize if not already active
        if (!isFilteringActive) {
            initializeFiltering();
        } else {
            // Even if already active, run once to catch new content
            filterContent();
        }
    } else {
        console.log("Twitter Feed Customiser: Not on Twitter home, stopping filtering");
        stopFiltering();
    }
}

// Setup URL change detection 
function setupURLChangeDetection() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
        originalPushState.apply(this, arguments);
        setTimeout(handleURLChange, 100); // Small delay to ensure DOM is updated
    };

    history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        setTimeout(handleURLChange, 100); // Small delay to ensure DOM is updated
    };

    // For back/forward browser buttons
    window.addEventListener('popstate', function () {
        setTimeout(handleURLChange, 100); // Small delay to ensure DOM is updated
    });

    // Additional checks
    window.addEventListener('hashchange', function () {
        setTimeout(handleURLChange, 100); // Small delay to ensure DOM is updated
    });

    // Periodic check as a safety net (every 2 seconds)
    setInterval(function () {
        if (currentURL !== window.location.href) {
            handleURLChange();
        }
    }, 2000);
}

// Load settings when content script initializes
chrome.storage.sync.get({
    removeVerified: true,
    removeVideos: true
}, function (items) {
    settings = items;

    // Initial check
    checkAndUpdateFilteringState();

    // Set up URL change detection
    setupURLChangeDetection();
});

function initializeFiltering() {
    console.log("Twitter Feed Customiser: Initializing filtering");
    isFilteringActive = true;

    // Clean up any existing observer first
    if (observer) {
        observer.disconnect();
        observer = null;
    }

    // Initial run
    filterContent();

    // Set up mutation observer with throttling
    observer = new MutationObserver(() => {
        // Only run if tab is active and we're on Twitter home
        if (isTabActive && isTwitterHomePage()) {
            throttledFilterContent();
        }
    });

    // Start observing document changes
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log("Twitter Feed Customiser: Observer started");
}

function stopFiltering() {
    // Disconnect observer to stop processing
    if (observer) {
        observer.disconnect();
        observer = null;
        console.log("Twitter Feed Customiser: Observer stopped");
    }
    isFilteringActive = false;
}

// Throttle function to avoid excessive processing
function throttledFilterContent() {
    // Don't process if tab is not active or not on Twitter home
    if (!isTabActive || !isTwitterHomePage()) {
        return;
    }

    const now = Date.now();
    if (processingInProgress || now - lastProcessedTime < THROTTLE_DELAY) {
        return;
    }

    lastProcessedTime = now;
    processingInProgress = true;

    // Use setTimeout with 0 delay for more reliable execution
    setTimeout(() => {
        filterContent();
        processingInProgress = false;
    }, 0);
}

// Listen for settings changes from popup
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.action === "updateSettings") {
        settings.removeVerified = message.removeVerified;
        settings.removeVideos = message.removeVideos;

        // Only run if tab is active and on Twitter home
        if (isTabActive && isTwitterHomePage()) {
            throttledFilterContent();
        }

        sendResponse({ status: "Settings updated" });
    } else if (message.action === "checkStatus") {
        // Allow popup to check current status
        sendResponse({
            isActive: isFilteringActive,
            isTwitter: isTwitterHomePage(),
            currentURL: window.location.href
        });
    }
    return true;
});

function filterContent() {
    // Safety check - don't process if tab is not active or not on Twitter home
    if (!isTabActive || !isTwitterHomePage()) {
        return;
    }

    try {
        const elementsToProcess = [];

        // Gather verified elements
        if (settings.removeVerified) {
            const verifiedSelectors = [
                '[aria-label*="verified"]',
                '[data-testid*="verified"]',
                '.verified-badge'
            ];

            verifiedSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!processedElements.has(element)) {
                        elementsToProcess.push({ element, type: 'verified' });
                    }
                });
            });
        }

        // Gather video elements
        if (settings.removeVideos) {
            const videoSelectors = [
                'video',
                '.video-player',
                '[data-testid*="videoPlayer"]',
                '[role="video"]',
                '[data-media-type="video"]'
            ];

            videoSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!processedElements.has(element)) {
                        elementsToProcess.push({ element, type: 'video' });
                    }
                });
            });
        }

        // Process found elements
        if (elementsToProcess.length > 0) {
            console.log(`Twitter Feed Customiser: Found ${elementsToProcess.length} items to process`);
            for (const { element, type } of elementsToProcess) {
                findAndRemoveCellInnerDiv(element, type);
                processedElements.add(element);
            }
        }
    } catch (error) {
        console.error("Twitter Feed Customiser: Error during filtering", error);
    }
}

function findAndRemoveCellInnerDiv(element, type) {
    // Skip if element is no longer in DOM
    if (!element || !document.contains(element)) return false;

    let current = element;

    // Traverse up the DOM tree to find cellInnerDiv
    for (let i = 0; i < 20 && current && current.getAttribute && current !== document.body; i++) {
        if (current.getAttribute('data-testid') === 'cellInnerDiv') {
            console.log(`Twitter Feed Customiser: Removing ${type} post`);
            current.style.display = 'none';
            return true;
        }
        current = current.parentElement;
    }

    return false;
}