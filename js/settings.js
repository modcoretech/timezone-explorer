// js/settings.js

// Create a global object to expose settings functions to other scripts
window.timezoneExplorerSettings = (function() {
    // --- DOM Elements ---
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseButton = document.getElementById('settings-close-button');
    const tabButtons = settingsModal.querySelectorAll('.tab-button');
    const tabContents = settingsModal.querySelectorAll('.tab-content');

    // Settings Form Elements
    const timeFormatSelect = document.getElementById('time-format');
    const dateLocaleSelect = document.getElementById('date-locale');
    // Changed from radio buttons to a single checkbox for dark mode
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const clearCacheButton = document.getElementById('clear-cache-button');

    // --- State Variables ---
    let userPreferences = {
        timeFormat: '12', // '12' or '24'
        dateLocale: 'en-US',
        isDarkMode: false // Simplified to a boolean
    };

    // --- Constants ---
    const LOCAL_STORAGE_KEY = 'timezoneExplorerPreferences';

    // --- Public API (Functions to be exposed) ---
    return {
        openModal: openSettingsModal,
        closeModal: closeSettingsModal,
        getPreferences: () => ({ ...userPreferences }), // Return a copy to prevent external modification
        isModalOpen: () => !settingsModal.classList.contains('hidden'), // Expose modal state
        initialize: initializeSettings // Expose initialization
    };


    // --- Utility Functions ---

    /**
     * Loads user preferences from local storage.
     */
    function loadPreferences() {
        const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedPreferences) {
            try {
                 const parsedPreferences = JSON.parse(savedPreferences);
                 // Validate loaded preferences or apply defaults if invalid/missing
                 userPreferences.timeFormat = ['12', '24'].includes(parsedPreferences.timeFormat) ? parsedPreferences.timeFormat : '12';
                 userPreferences.dateLocale = (typeof parsedPreferences.dateLocale === 'string' && parsedPreferences.dateLocale.length >= 2) ? parsedPreferences.dateLocale : 'en-US';
                 // Handle the new boolean dark mode preference
                 userPreferences.isDarkMode = typeof parsedPreferences.isDarkMode === 'boolean' ? parsedPreferences.isDarkMode : false;

            } catch (e) {
                 console.error("Error parsing saved preferences:", e);
                 // Reset to default if parsing fails
                 userPreferences = {
                     timeFormat: '12',
                     dateLocale: 'en-US',
                     isDarkMode: false
                 };
                 // Clear invalid data from local storage
                 localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
        }
         console.log("Settings loaded preferences:", userPreferences);
    }

    /**
     * Saves user preferences to local storage.
     */
    function savePreferences() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPreferences));
             console.log("Settings saved preferences:", userPreferences);
        } catch (e) {
            console.error("Error saving preferences to local storage:", e);
            // Use a more user-friendly way to show messages, not alert()
            // alert("Could not save preferences. Local storage might be disabled or full.");
            console.warn("Could not save preferences. Local storage might be disabled or full.");
        }
    }

    /**
     * Applies the current theme preference (dark mode) to the body.
     */
    function applyTheme() {
        // Remove the dark-mode class first
        document.body.classList.remove('dark-mode');

        // Apply the dark-mode class if enabled
        if (userPreferences.isDarkMode) {
             document.body.classList.add('dark-mode');
        }

         console.log("Settings applied dark mode:", userPreferences.isDarkMode);

         // Trigger a custom event to notify other scripts (like main.js) that settings changed
         // This event can now signal any setting change, including theme.
         const event = new CustomEvent('settingsChange');
         document.dispatchEvent(event);
    }


    // --- Settings Modal Functions ---

    /**
     * Opens the settings modal.
     */
    function openSettingsModal() {
        settingsModal.classList.remove('hidden');
        // Add a class to body to prevent scrolling when modal is open (optional but good UX)
        document.body.classList.add('modal-open');

         // Populate settings form with current preferences
         timeFormatSelect.value = userPreferences.timeFormat;
         dateLocaleSelect.value = userPreferences.dateLocale;
         // Set the dark mode toggle state
         darkModeToggle.checked = userPreferences.isDarkMode;

         // Ensure the first tab ('general') is active when opening the modal
         switchTab('general');
          // Add event listener for Escape key when modal is open
         document.addEventListener('keydown', handleModalKeyDown);
          // Trap focus inside the modal (basic)
          settingsModal.focus(); // Focus the modal container
    }

    /**
     * Closes the settings modal.
     */
    function closeSettingsModal() {
        settingsModal.classList.add('hidden');
        // Remove the body class that prevents scrolling
        document.body.classList.remove('modal-open');
         // Remove event listener for Escape key
         document.removeEventListener('keydown', handleModalKeyDown);
         // Return focus to the element that opened the modal (if possible)
         // This requires storing the opening element reference, which is more complex.
         // For now, just ensure focus leaves the modal.
    }

    /**
     * Switches between tabs in the settings modal.
     * @param {string} tabId - The ID of the tab content to show (e.g., 'general').
     */
    function switchTab(tabId) {
        tabContents.forEach(content => {
            if (content.id === `tab-${tabId}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        tabButtons.forEach(button => {
            if (button.dataset.tab === tabId) {
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true'); // Accessibility
            } else {
                button.classList.remove('active');
                 button.setAttribute('aria-selected', 'false'); // Accessibility
            }
        });
         // Set aria-hidden for tab panels
         tabContents.forEach(content => {
             content.setAttribute('aria-hidden', !content.classList.contains('active'));
         });
         console.log("Switched to tab:", tabId); // Log tab switches
    }

    /**
     * Handles changes in the settings form and updates preferences.
     */
    function handleSettingChange() {
        // Update time format preference
        userPreferences.timeFormat = timeFormatSelect.value;

        // Update date locale preference
        userPreferences.dateLocale = dateLocaleSelect.value;

        // Update dark mode preference from the checkbox
        userPreferences.isDarkMode = darkModeToggle.checked;

        savePreferences(); // Save updated preferences
        applyTheme(); // Apply the new theme (dark mode)

        // Notify main script that settings changed so it can update displayed times and theme
        const event = new CustomEvent('settingsChange');
        document.dispatchEvent(event);
        console.log("Settings changed:", userPreferences); // Log setting changes
    }

    /**
     * Clears all saved preferences from local storage.
     */
    function clearSavedSettings() {
        // Use a simple confirmation
        const confirmed = confirm('Are you sure you want to clear all saved settings? This will reset your time/date preferences and disable Dark Mode.');

        if (confirmed) {
            try {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                // Reset preferences to default
                userPreferences = {
                    timeFormat: '12',
                    dateLocale: 'en-US',
                    isDarkMode: false
                };
                applyTheme(); // Apply default theme (light mode)
                // Update settings form to reflect defaults
                timeFormatSelect.value = userPreferences.timeFormat;
                dateLocaleSelect.value = userPreferences.dateLocale;
                darkModeToggle.checked = userPreferences.isDarkMode; // Update checkbox

                 // Notify main script to update times with default preferences
                 const event = new CustomEvent('settingsChange');
                 document.dispatchEvent(event);

                // Use a simple message instead of alert()
                console.log('Saved settings cleared.');
                // Optionally, display a temporary message on the UI
            } catch (e) {
                 console.error("Error clearing local storage:", e);
                 // Use a simple message instead of alert()
                 console.warn("Could not clear saved settings.");
            }
        }
    }


    // --- Event Handlers ---

    // Handle keyboard shortcuts for modal (Escape key and Tab trap)
    function handleModalKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault(); // Prevent default Escape behavior (like closing browser dialogs)
            closeSettingsModal();
        }
         // Basic focus trap - prevent tabbing outside the modal
         if (event.key === 'Tab') {
             const focusableElements = settingsModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
             const firstElement = focusableElements[0];
             const lastElement = focusableElements[focusableElements.length - 1];

             if (event.shiftKey) { // Shift + Tab
                 if (document.activeElement === firstElement) {
                     lastElement.focus();
                     event.preventDefault();
                 }
             } else { // Tab
                 if (document.activeElement === lastElement) {
                     firstElement.focus();
                     event.preventDefault();
                 }
             }
         }
    }


    // Handle settings modal close button click
    settingsCloseButton.addEventListener('click', closeSettingsModal);

    // Handle clicking outside the settings modal content to close
    settingsModal.addEventListener('click', (event) => {
        // Check if the click target is the modal overlay itself, not the modal-content
        if (event.target === settingsModal) {
            closeSettingsModal();
        }
    });

    // Handle settings tab button clicks (using event delegation)
    settingsModal.addEventListener('click', (event) => {
        const tabButton = event.target.closest('.tab-button');
        if (tabButton) {
            const tabId = tabButton.dataset.tab;
            if (tabId) {
                switchTab(tabId);
            }
        }
    });

    // Handle changes in settings form (time format, date locale, dark mode toggle)
    timeFormatSelect.addEventListener('change', handleSettingChange);
    dateLocaleSelect.addEventListener('change', handleSettingChange);
    // Listen for change on the dark mode checkbox
    darkModeToggle.addEventListener('change', handleSettingChange);


    // Handle clear cache button click
    clearCacheButton.addEventListener('click', clearSavedSettings);


    // --- Initialization ---

    /**
     * Initializes the settings module: loads preferences and applies theme.
     */
    function initializeSettings() {
        loadPreferences();
        applyTheme(); // Apply theme immediately on load
        // Note: Main application initialization happens in script.js after this loads.
    }

    // Call the settings initialization function when the script loads
    initializeSettings();

})(); // End of IIFE (Immediately Invoked Function Expression)
