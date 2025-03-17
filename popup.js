document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    chrome.storage.sync.get({
      removeVerified: true,
      removeVideos: true
    }, function(items) {
      document.getElementById('removeVerified').checked = items.removeVerified;
      document.getElementById('removeVideos').checked = items.removeVideos;
    });
    
    // Save settings when Apply button is clicked
    document.getElementById('apply').addEventListener('click', function() {
      const removeVerified = document.getElementById('removeVerified').checked;
      const removeVideos = document.getElementById('removeVideos').checked;
      
      // Save settings
      chrome.storage.sync.set({
        removeVerified: removeVerified,
        removeVideos: removeVideos
      }, function() {
        // Send message to content script to update filtering
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateSettings",
              removeVerified: removeVerified,
              removeVideos: removeVideos
            });
          }
        });
        
        // Visual feedback
        const button = document.getElementById('apply');
        button.textContent = 'Applied!';
        setTimeout(function() {
          button.textContent = 'Apply Changes';
        }, 1000);
      });
    });
  });