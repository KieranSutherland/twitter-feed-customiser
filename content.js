let settings = {
    removeVerified: true,
    removeVideos: true
};

// Track processing state
let processingInProgress = false;
let lastProcessedTime = 0;
const THROTTLE_DELAY = 300; // ms
const processedElements = new WeakSet(); // More efficient than Set for DOM elements

// Load settings when content script initializes
chrome.storage.sync.get({
    removeVerified: true,
    removeVideos: true
}, function (items) {
    settings = items;

    // Check if we're on Twitter
    const isTwitterPage = window.location.hostname.includes('twitter.com') ||
        window.location.hostname.includes('x.com');

    if (isTwitterPage) {
        // Wait for page to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeFiltering);
        } else {
            initializeFiltering();
        }
    }
});

function initializeFiltering() {
    console.log("Content Filter: Initializing filtering");

    // Initial run
    setTimeout(() => {
        filterContent();

        // Set up mutation observer with throttling
        const observer = new MutationObserver(() => {
            throttledFilterContent();
        });

        // Start observing document changes
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log("Content Filter: Observer started");
    }, 1000); // Small initial delay to let page render
}

// Throttle function to avoid excessive processing
function throttledFilterContent() {
    const now = Date.now();
    if (processingInProgress || now - lastProcessedTime < THROTTLE_DELAY) {
        return;
    }

    lastProcessedTime = now;
    processingInProgress = true;

    // Use setTimeout with 0 delay instead of requestAnimationFrame for more reliable execution
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
        throttledFilterContent();
        sendResponse({ status: "Settings updated" });
    }
    return true;
});

function filterContent() {
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
            console.log(`Content Filter: Found ${elementsToProcess.length} items to process`);
            for (const { element, type } of elementsToProcess) {
                processedElements.add(element);
                findAndRemoveCellInnerDiv(element, type);
            }
        }
    } catch (error) {
        console.error("Content Filter: Error during filtering", error);
    }
}

function findAndRemoveCellInnerDiv(element, type) {
    // Skip if element is no longer in DOM
    if (!element || !document.contains(element)) return false;

    let current = element;
    let foundCell = false;

    // Traverse up the DOM tree to find cellInnerDiv
    for (let i = 0; i < 20 && current && current !== document.body; i++) {
        if (current.getAttribute('data-testid') === 'cellInnerDiv') {
            foundCell = true;

            console.log(`Content Filter: Removing ${type} post`);

            // Remove the element completely from the DOM
            if (current.parentNode) {
                current.style.display = 'none';
                return true;
            }
            break;
        }
        current = current.parentElement;
    }

    return false;
}