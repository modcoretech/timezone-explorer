// js/script.js - Combined Main App Logic and Settings Module

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridView = document.getElementById('grid-view');
    const detailView = document.getElementById('detail-view');
    const timezonesGrid = document.getElementById('timezones-grid');
    const loadingMessage = document.querySelector('.loading-message');
    const loadingMoreIndicator = document.querySelector('.loading-more');
    const endOfListIndicator = document.querySelector('.end-of-list');

    // Main Search Input (Single element, moved between containers)
    const timezoneSearchInput = document.getElementById('timezone-search');
    const mainControls = document.getElementById('main-controls'); // Original container
    const navSearchInputContainer = document.getElementById('nav-search-input-container'); // Nav container

    // Sticky Nav Elements
    const stickyNav = document.getElementById('sticky-nav');
    const navSearchIcon = document.getElementById('nav-search-icon');
    const navSearchBar = document.getElementById('nav-search-bar');
    const navSettingsIcon = document.getElementById('nav-settings-icon'); // Settings icon in nav

    // Main Settings Icon (Hidden when nav is visible)
    const mainSettingsIcon = document.getElementById('main-settings-icon');

    // Detail View Elements
    const detailTimezoneName = document.getElementById('detail-timezone-name');
    const detailDisplayDate = document.getElementById('detail-display-date');
    const detailDisplayTime = document.getElementById('detail-display-time');
    const detailDisplayOffset = document.getElementById('detail-display-offset');
    // const detailCountries = document.getElementById('detail-countries'); // Not implemented in this version
    const detailDstStatus = document.getElementById('detail-dst-status');

    // Settings Modal Elements (Now within script.js scope)
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseButton = document.getElementById('settings-close-button');
    const tabButtons = settingsModal.querySelectorAll('.tabs-sidebar .tab-button');
    const tabContents = settingsModal.querySelectorAll('.tab-content-area .tab-content');

    // Settings Form Elements (Now within script.js scope)
    const timeFormatSelect = document.getElementById('time-format');
    const dateLocaleSelect = document.getElementById('date-locale'); // Renamed label in HTML, but ID remains
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const clearCacheButton = document.getElementById('clear-cache-button');


    // --- State Variables ---
    let allTimezones = []; // Full list of timezones
    let filteredTimezones = []; // Timezones currently displayed or to be displayed
    const timezonesPerPage = 20; // Number of timezones to load at once
    let currentPage = 0; // Current page for infinite scrolling
    let isLoading = false; // To prevent multiple loads
    let timeUpdateInterval = null; // Interval for updating times

    // --- Settings State (Now within script.js scope) ---
    let userPreferences = {
        timeFormat: '12', // '12' or '24'
        dateLocale: 'en-US', // Corresponds to Date Display Format
        isDarkMode: false // Simplified to a boolean
    };

    // --- Constants ---
    const LOCAL_STORAGE_KEY = 'timezoneExplorerPreferences';


    console.log("script.js initialized.");


    // --- Utility Functions ---

    /**
     * Formats a Date object for a specific timezone based on user preferences.
     * @param {Date} date - The Date object representing the current moment.
     * @param {string} timezone - The IANA timezone string (e.g., 'America/New_York').
     * @param {string} timeFormat - '12' or '24'.
     * @param {string} dateLocale - Locale string (e.g., 'en-US').
     * @returns {object} - Object containing formatted date and time strings.
     */
    function formatDateTime(date, timezone, timeFormat, dateLocale) {
        const optionsDate = {
            weekday: 'long', // e.g., Monday
            year: 'numeric', // e.g., 2023
            month: 'long', // e.g., December
            day: 'numeric', // e.g., 25
            timeZone: timezone // Use the correct timezone string
        };

        const optionsTime = {
            hour: 'numeric', // e.g., 1, 13
            minute: '2-digit', // e.g., 01, 30
            second: '2-digit', // e.g., 05, 59
            hour12: timeFormat === '12', // true for 12-hour format, false for 24-hour
            timeZone: timezone // Use the correct timezone string
        };

        try {
            const formattedDate = new Intl.DateTimeFormat(dateLocale, optionsDate).format(date);
            const formattedTime = new Intl.DateTimeFormat(dateLocale, optionsTime).format(date);
            return { formattedDate, formattedTime };
        } catch (error) {
            console.error(`Error formatting date or time for timezone ${timezone} with locale ${dateLocale}:`, error);
             // Fallback to a simpler format if locale or timezone is invalid
             // Use 'UTC' as a safe fallback timezone and undefined locale for system default
             const fallbackDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
             const fallbackTime = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12', timeZone: 'UTC' });
             return { formattedDate: fallbackDate, formattedTime: fallbackTime };
        }
    }


    /**
     * Gets the UTC offset for a given timezone.
     * @param {string} timezone - The IANA timezone string.
     * @returns {string} - The UTC offset string (e.g., "UTC-05:00").
     */
    function getUtcOffset(timezone) {
         try {
             // Use Intl.DateTimeFormat to get the timezone name, which often includes the offset
             const now = new Date();
             const options = {
                 timeZoneName: 'shortOffset', // e.g., "GMT-5" or "UTC+1"
                 timeZone: timezone // Use the correct timezone string
             };
             const formatter = new Intl.DateTimeFormat('en-US', options); // Use a consistent locale
             const parts = formatter.formatToParts(now);
             const timeZoneNamePart = parts.find(p => p.type === 'timeZoneName');

             if (timeZoneNamePart) {
                 let offset = timeZoneNamePart.value;
                 // Clean up common formats like GMT-5 to UTC-05:00
                 if (offset.startsWith('GMT')) {
                     offset = offset.replace('GMT', 'UTC');
                     // Add leading zero if needed (e.g., UTC-5 becomes UTC-05)
                     if (/UTC[+-]\d$/.test(offset)) {
                         offset = offset.replace(/([+-])(\d)$/, '$10$2');
                     }
                     // Add ':00' if only hour is present (e.g., UTC-05 becomes UTC-05:00)
                     if (/UTC[+-]\d{2}$/.test(offset)) {
                         offset += ':00';
                     }
                 }
                  return offset;
             } else {
                 // Fallback if shortOffset is not available
                 // Attempt to use longOffset and parse
                 const longOffset = now.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
                 const offsetMatch = longOffset.match(/UTC([+-]\d{1,2}):?(\d{2})?/);
                 if (offsetMatch && offsetMatch[1]) {
                     const sign = offsetMatch[1].charAt(0);
                     const hours = parseInt(offsetMatch[1], 10);
                     const minutes = offsetMatch[2] ? parseInt(offsetMatch[2], 10) : 0;
                     const paddedHours = String(Math.abs(hours)).padStart(2, '0');
                     const paddedMinutes = String(minutes).padStart(2, '0');
                     return `UTC${sign}${paddedHours}:${paddedMinutes}`;
                 }
             }

         } catch (error) {
             console.error("Error getting UTC offset for timezone", timezone, ":", error);
         }
         return 'UTC Offset N/A'; // Fallback
    }


    /**
     * Gets the DST status for a given timezone.
     * @param {string} timezone - The IANA timezone string.
     * @returns {string} - The DST status (e.g., "Observing DST", "Standard Time").
     */
    function getDstStatus(timezone) {
        try {
             const now = new Date();
             // Use Intl.DateTimeFormat to get the long timezone name, which often indicates DST
             const options = {
                 timeZoneName: 'long', // e.g., "Central European Standard Time", "Central European Summer Time"
                 timeZone: timezone // Use the correct timezone string
             };
             const formatter = new Intl.DateTimeFormat('en-US', options); // Use a consistent locale
             const parts = formatter.formatToParts(now);
             const timeZoneNamePart = parts.find(p => p.type === 'timeZoneName');

             if (timeZoneNamePart) {
                 const name = timeZoneNamePart.value;
                 // Simple check for common DST indicators in the name
                 if (name.toLowerCase().includes('summer') || name.toLowerCase().includes('daylight')) {
                     return 'Observing DST';
                 } else if (name.toLowerCase().includes('standard')) {
                     return 'Standard Time';
                 }
                 return name; // Return the full name if no specific indicator found
             }
        } catch (error) {
             console.error("Error getting DST status for timezone", timezone, ":", error);
        }
        return 'DST Status N/A'; // Fallback
    }


    /**
     * Creates a timezone card element.
     * @param {string} timezone - The IANA timezone string.
     * @returns {HTMLElement} - The created card element.
     */
    function createTimezoneCard(timezone) {
        const card = document.createElement('div');
        card.classList.add('timezone-card');
        card.dataset.timezone = timezone; // Store timezone string in data attribute

        const now = new Date(); // Get current local time
        // Pass the timezone string to formatDateTime
        const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
        const offset = getUtcOffset(timezone);

        card.innerHTML = `
            <h3>${timezone.replace(/_/g, ' ')}</h3>
            <p><strong>Current Date:</strong> <span class="display-date">${formattedDate}</span></p>
            <p><strong>Current Time:</strong> <span class="display-time">${formattedTime}</span></p>
            <p><strong>UTC Offset:</strong> <span class="display-offset">${offset}</span></p>
        `;

        card.addEventListener('click', () => {
            showDetailView(timezone);
        });

        return card;
    }

    /**
     * Appends a batch of timezone cards to the grid.
     */
    function appendTimezoneCards() {
        if (isLoading) return;
        isLoading = true;
        loadingMoreIndicator.classList.remove('hidden');
        // Show the loading icon within the message
        loadingMoreIndicator.querySelector('.loading-icon').style.display = 'inline-block';


        const start = currentPage * timezonesPerPage;
        const end = start + timezonesPerPage;
        const timezonesToLoad = filteredTimezones.slice(start, end);

        if (timezonesToLoad.length === 0) {
            loadingMoreIndicator.classList.add('hidden');
            endOfListIndicator.classList.remove('hidden');
            isLoading = false;
            return;
        }

        // Use a small delay to simulate loading and allow UI to update
        setTimeout(() => {
            timezonesToLoad.forEach(timezone => {
                const card = createTimezoneCard(timezone);
                timezonesGrid.appendChild(card);
            });

            currentPage++;
            isLoading = false;
            loadingMoreIndicator.classList.add('hidden');
             // Hide the loading icon
            loadingMoreIndicator.querySelector('.loading-icon').style.display = 'none';


            // Check if there are more timezones to load
            if (currentPage * timezonesPerPage >= filteredTimezones.length) {
                 endOfListIndicator.classList.remove('hidden');
            } else {
                 endOfListIndicator.classList.add('hidden');
            }

             // Update times on newly added cards immediately
             updateVisibleCardTimes();

        }, 300); // Simulate network delay
    }

    /**
     * Updates the displayed time on all visible timezone cards and the detail view.
     */
    function updateVisibleCardTimes() {
        const now = new Date(); // Get current local time once

        // Update grid view cards
        const visibleCards = timezonesGrid.querySelectorAll('.timezone-card');
        visibleCards.forEach(card => {
            const timezone = card.dataset.timezone;
            // Pass the current Date object and timezone string to formatDateTime
            const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
            card.querySelector('.display-date').textContent = formattedDate;
            card.querySelector('.display-time').textContent = formattedTime;
            // Offset is static, no need to update here
        });

        // Update detail view if visible
        if (!detailView.classList.contains('hidden')) {
            const timezone = detailTimezoneName.dataset.timezone; // Get timezone from detail view element
            if (timezone) {
                 // Pass the current Date object and timezone string to formatDateTime
                const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
                detailDisplayDate.textContent = formattedDate;
                detailDisplayTime.textContent = formattedTime;
                // Offset and DST status are static, no need to update here
            }
        }
    }


    // --- View Switching ---

    /**
     * Shows the grid view and hides the detail view.
     */
    function showGridView() {
        gridView.classList.remove('hidden');
        detailView.classList.add('hidden');
        // Ensure main controls are visible when in grid view
        mainControls.classList.remove('hidden');
        // Ensure main settings icon is visible when in grid view (if nav is not sticky)
         if (!stickyNav.classList.contains('visible')) {
             mainSettingsIcon.classList.remove('hidden');
         } else {
             mainSettingsIcon.classList.add('hidden');
         }
         // Hide nav search bar when switching back to grid view from detail
         navSearchBar.classList.remove('expanded');
         // Move search input back to main controls
         if (timezoneSearchInput.parentElement === navSearchInputContainer) {
             mainControls.querySelector('.search-container').appendChild(timezoneSearchInput);
             timezoneSearchInput.classList.remove('in-nav');
         }

        // Reset and load the first batch of timezones
        timezonesGrid.innerHTML = ''; // Clear existing cards
        currentPage = 0;
        endOfListIndicator.classList.add('hidden');
        loadingMessage.classList.remove('hidden'); // Show initial loading message
        // Show the loading icon within the initial message
        loadingMessage.querySelector('.loading-icon').style.display = 'inline-block';
        appendTimezoneCards(); // Load the first batch

        // Re-attach scroll listener for infinite scrolling
        window.addEventListener('scroll', handleScroll);
    }

    /**
     * Shows the detail view for a specific timezone and hides the grid view.
     * @param {string} timezone - The IANA timezone string to display details for.
     */
    function showDetailView(timezone) {
        gridView.classList.add('hidden');
        detailView.classList.remove('hidden');
        // Hide main controls and main settings icon in detail view
        mainControls.classList.add('hidden');
        mainSettingsIcon.classList.add('hidden');

        // Remove infinite scroll listener when in detail view
        window.removeEventListener('scroll', handleScroll);

        // Populate detail view
        detailTimezoneName.textContent = timezone.replace(/_/g, ' ');
        detailTimezoneName.dataset.timezone = timezone; // Store timezone for updates
        const now = new Date(); // Get current local time
        // Pass the current Date object and timezone string to formatDateTime
        const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
        detailDisplayDate.textContent = formattedDate;
        detailDisplayTime.textContent = formattedTime;
        detailDisplayOffset.textContent = getUtcOffset(timezone);
        detailDstStatus.textContent = getDstStatus(timezone); // Populate DST status

        // Update the time in the detail view every second
        // The main timeUpdateInterval already handles this if detailView is visible
    }


    // --- Search Functionality ---

    /**
     * Filters the list of timezones based on the search query.
     * @param {string} query - The search string.
     */
    function filterTimezones(query) {
        const lowerCaseQuery = query.toLowerCase();
        filteredTimezones = allTimezones.filter(timezone =>
            timezone.toLowerCase().includes(lowerCaseQuery)
        );

        // Reset and re-render the grid with filtered results
        timezonesGrid.innerHTML = '';
        currentPage = 0;
        endOfListIndicator.classList.add('hidden');
         loadingMessage.classList.remove('hidden'); // Show loading message while filtering/re-rendering
         loadingMessage.querySelector('.loading-icon').style.display = 'inline-block'; // Show icon
        appendTimezoneCards();
    }


    // --- Infinite Scrolling ---

    /**
     * Handles scroll events for infinite scrolling and sticky navigation.
     */
    function handleScroll() {
        // Infinite Scrolling Logic
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoading && gridView.classList.contains('hidden') === false) {
            // Load more timezones if scrolled near the bottom and not already loading
            appendTimezoneCards();
        }

        // Sticky Navigation Logic
        const scrollTopThreshold = 50; // Pixels scrolled before nav becomes sticky
        if (scrollTop > scrollTopThreshold) {
            stickyNav.classList.add('visible');
            mainSettingsIcon.classList.add('hidden'); // Hide main settings icon when nav is sticky
            // Move search input to nav if not already there
            if (timezoneSearchInput.parentElement !== navSearchInputContainer && navSearchBar.classList.contains('expanded')) {
                 navSearchInputContainer.appendChild(timezoneSearchInput);
                 timezoneSearchInput.classList.add('in-nav');
            }
        } else {
            stickyNav.classList.remove('visible');
             // Show main settings icon when nav is not sticky, only if in grid view
             if (gridView.classList.contains('hidden') === false) {
                mainSettingsIcon.classList.remove('hidden');
             }
            // Move search input back to main controls if in nav and nav is not sticky
            if (timezoneSearchInput.parentElement === navSearchInputContainer && !navSearchBar.classList.contains('expanded')) {
                 mainControls.querySelector('.search-container').appendChild(timezoneSearchInput);
                 timezoneSearchInput.classList.remove('in-nav');
            }
        }
    }


    // --- Settings Module (Integrated) ---

    /**
     * Loads user preferences from local storage.
     */
    function loadPreferences() {
        console.log("Attempting to load preferences from local storage.");
        const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedPreferences) {
            try {
                 const parsedPreferences = JSON.parse(savedPreferences);
                 console.log("Parsed preferences:", parsedPreferences);
                 // Validate loaded preferences or apply defaults if invalid/missing
                 userPreferences.timeFormat = ['12', '24'].includes(parsedPreferences.timeFormat) ? parsedPreferences.timeFormat : '12';
                 userPreferences.dateLocale = (typeof parsedPreferences.dateLocale === 'string' && parsedPreferences.dateLocale.length >= 2) ? parsedPreferences.dateLocale : 'en-US';
                 userPreferences.isDarkMode = typeof parsedPreferences.isDarkMode === 'boolean' ? parsedPreferences.isDarkMode : false;
                 console.log("Successfully loaded and validated preferences:", userPreferences);

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
                 console.warn("Invalid preferences found, resetting to defaults and clearing local storage.");
            }
        } else {
            console.log("No saved preferences found in local storage. Using defaults.");
        }
    }

    /**
     * Saves user preferences to local storage.
     */
    function savePreferences() {
        console.log("Attempting to save preferences:", userPreferences);
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPreferences));
             console.log("Successfully saved preferences.");
        } catch (e) {
            console.error("Error saving preferences to local storage:", e);
            console.warn("Could not save preferences. Local storage might be disabled or full.");
        }
    }

    /**
     * Applies the current theme preference (dark mode) to the body.
     */
    function applyTheme() {
        console.log("Applying theme. Dark mode enabled:", userPreferences.isDarkMode);
        // Remove the dark-mode class first
        document.body.classList.remove('dark-mode');

        // Apply the dark-mode class if enabled
        if (userPreferences.isDarkMode) {
             document.body.classList.add('dark-mode');
        }

         // Trigger a custom event to notify parts of the script that might need it (though less necessary now)
         const event = new CustomEvent('themeChange'); // Using a more specific event name
         document.dispatchEvent(event);
         console.log("Dispatched 'themeChange' event.");
    }


    // --- Settings Modal Functions (Integrated) ---

    /**
     * Opens the settings modal.
     */
    function openSettingsModal() {
        console.log("Opening settings modal.");
        settingsModal.classList.remove('hidden');
        // Add a class to body to prevent scrolling when modal is open (optional but good UX)
        document.body.classList.add('modal-open');

         // Populate settings form with current preferences
         timeFormatSelect.value = userPreferences.timeFormat;
         dateLocaleSelect.value = userPreferences.dateLocale;
         // Set the dark mode toggle state
         darkModeToggle.checked = userPreferences.isDarkMode;
         console.log("Modal form populated with preferences:", userPreferences);

         // Ensure the first tab ('general') is active when opening the modal
         switchTab('general');
          // Add event listener for Escape key when modal is open
         document.addEventListener('keydown', handleModalKeyDown);
          // Trap focus inside the modal (basic)
          // Focus the modal container or the first focusable element
          settingsModal.focus();
          console.log("Settings modal opened.");
    }

    /**
     * Closes the settings modal.
     */
    function closeSettingsModal() {
        console.log("Closing settings modal.");
        settingsModal.classList.add('hidden');
        // Remove the body class that prevents scrolling
        document.body.classList.remove('modal-open');
         // Remove event listener for Escape key
         document.removeEventListener('keydown', handleModalKeyDown);
         console.log("Settings modal closed.");
    }

    /**
     * Switches between tabs in the settings modal.
     * @param {string} tabId - The ID of the tab content to show (e.g., 'general').
     */
    function switchTab(tabId) {
        console.log("Attempting to switch to tab:", tabId);
        // Deactivate all tab buttons and content areas first
        tabButtons.forEach(button => {
            button.classList.remove('active');
            button.setAttribute('aria-selected', 'false');
        });
        tabContents.forEach(content => {
            content.classList.remove('active');
            content.setAttribute('aria-hidden', 'true');
        });

        // Activate the selected tab button and content area
        const targetButton = settingsModal.querySelector(`.tab-button[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(`tab-${tabId}`); // Use getElementById as IDs are unique

        if (targetButton && targetContent) {
            targetButton.classList.add('active');
            targetButton.setAttribute('aria-selected', 'true');
            targetContent.classList.add('active');
            targetContent.setAttribute('aria-hidden', 'false');
            console.log("Successfully switched to tab:", tabId);
        } else {
            console.warn("Could not find tab with ID:", tabId);
        }
    }

    /**
     * Handles changes in the settings form and updates preferences.
     */
    function handleSettingChange() {
        console.log("handleSettingChange called.");
        // Update time format preference
        userPreferences.timeFormat = timeFormatSelect.value;

        // Update date locale preference
        userPreferences.dateLocale = dateLocaleSelect.value;

        // Update dark mode preference from the checkbox
        userPreferences.isDarkMode = darkModeToggle.checked;

        console.log("Updated preferences:", userPreferences);

        savePreferences(); // Save updated preferences
        applyTheme(); // Apply the new theme (dark mode)

        // Re-render visible times with new settings immediately
        updateVisibleCardTimes();
    }

    /**
     * Clears all saved preferences from local storage.
     */
    function clearSavedSettings() {
        console.log("Attempting to clear saved settings.");
        // Use a simple confirmation
        const confirmed = confirm('Are you sure you want to clear all saved settings? This will reset your time/date preferences and disable Dark Mode.');

        if (confirmed) {
            try {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                console.log("Local storage cleared.");
                // Reset preferences to default
                userPreferences = {
                    timeFormat: '12',
                    dateLocale: 'en-US',
                    isDarkMode: false
                };
                console.log("Preferences reset to defaults:", userPreferences);
                applyTheme(); // Apply default theme (light mode)
                // Update settings form to reflect defaults
                timeFormatSelect.value = userPreferences.timeFormat;
                dateLocaleSelect.value = userPreferences.dateLocale;
                darkModeToggle.checked = userPreferences.isDarkMode; // Update checkbox
                console.log("Settings form updated to defaults.");

                // Re-render visible times with default preferences
                updateVisibleCardTimes();

                console.log('Saved settings cleared successfully.');
                // Optionally, display a temporary message on the UI
            } catch (e) {
                 console.error("Error clearing local storage:", e);
                 console.warn("Could not clear saved settings.");
            }
        } else {
            console.log("Clear settings cancelled by user.");
        }
    }


    // --- Event Handlers ---

    // Handle keyboard shortcuts for modal (Escape key and Tab trap)
    function handleModalKeyDown(event) {
        if (event.key === 'Escape') {
            console.log("Escape key pressed.");
            event.preventDefault(); // Prevent default Escape behavior (like closing browser dialogs)
            closeSettingsModal();
        }
         // Basic focus trap - prevent tabbing outside the modal
         if (event.key === 'Tab') {
             // Get all focusable elements within the modal
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


    // --- Main App Event Listeners ---

    // Event listener for the main search input
    timezoneSearchInput.addEventListener('input', (event) => {
        filterTimezones(event.target.value);
    });

    // Event listener for the nav search icon (toggle search bar)
    navSearchIcon.addEventListener('click', () => {
        navSearchBar.classList.toggle('expanded');
        // Move search input between main controls and nav search bar
        if (navSearchBar.classList.contains('expanded')) {
            navSearchInputContainer.appendChild(timezoneSearchInput);
            timezoneSearchInput.classList.add('in-nav');
            timezoneSearchInput.focus(); // Focus the input when expanded
        } else {
             // Only move back if not in detail view (where main controls are hidden)
             if (gridView.classList.contains('hidden') === false) {
                mainControls.querySelector('.search-container').appendChild(timezoneSearchInput);
                timezoneSearchInput.classList.remove('in-nav');
             }
        }
    });

    // Event listener for the main settings icon (open modal)
    mainSettingsIcon.addEventListener('click', openSettingsModal);

    // Event listener for the nav settings icon (open modal)
    navSettingsIcon.addEventListener('click', openSettingsModal);

    // Add scroll listener for infinite scrolling and sticky nav
    window.addEventListener('scroll', handleScroll);


    // --- Settings Modal Event Listeners (Integrated) ---

    // Handle settings modal close button click
    settingsCloseButton.addEventListener('click', () => {
        console.log("Close button clicked.");
        closeSettingsModal();
    });

    // Handle clicking outside the settings modal content to close
    settingsModal.addEventListener('click', (event) => {
        // Check if the click target is the modal overlay itself, not the modal-content or its children
        if (event.target === settingsModal) {
            console.log("Clicked outside modal content.");
            closeSettingsModal();
        }
    });

    // Handle settings tab button clicks (using event delegation)
    // Attach the listener to the tabs-sidebar for better delegation
    settingsModal.querySelector('.tabs-sidebar').addEventListener('click', (event) => {
        const tabButton = event.target.closest('.tab-button');
        if (tabButton) {
            const tabId = tabButton.dataset.tab;
            if (tabId) {
                console.log("Tab button clicked:", tabId);
                switchTab(tabId);
            }
        }
    });

    // Handle changes in settings form (time format, date locale, dark mode toggle)
    // Attach listeners directly to the elements
    timeFormatSelect.addEventListener('change', () => {
        console.log("Time format select changed.");
        handleSettingChange();
    });
    dateLocaleSelect.addEventListener('change', () => {
        console.log("Date locale select changed.");
        handleSettingChange();
    });
    darkModeToggle.addEventListener('change', () => {
        console.log("Dark mode toggle changed.");
        handleSettingChange();
    });

    // Handle clear cache button click
    clearCacheButton.addEventListener('click', () => {
        console.log("Clear cache button clicked.");
        clearSavedSettings();
    });


    // --- Initialization ---

    /**
     * Initializes the application: loads settings, fetches timezones, and sets up the initial view.
     */
    async function initialize() {
        console.log("script.js initializing.");

        // 1. Load settings first
        loadPreferences();
        applyTheme(); // Apply theme based on loaded preferences

        // 2. Fetch timezones and set up the initial view
        // Check if Intl.supportedValuesOf is supported (for getting timezone list)
        if (typeof Intl.supportedValuesOf === 'function') {
            try {
                allTimezones = Intl.supportedValuesOf('timeZone');
                // Sort timezones alphabetically for easier browsing
                allTimezones.sort();
                console.log(`Found ${allTimezones.length} timezones.`);

                // Check for deep links to specific timezones
                const urlParams = new URLSearchParams(window.location.search);
                const requestedTimezone = urlParams.get('timezone');

                if (requestedTimezone && allTimezones.includes(requestedTimezone)) {
                    showDetailView(requestedTimezone);
                } else {
                    // Default to grid view - DO NOT open modal on load
                    filteredTimezones = [...allTimezones]; // Initially filtered list is all timezones
                    loadingMessage.classList.remove('hidden'); // Show initial loading message
                    // Show the loading icon within the initial message
                    loadingMessage.querySelector('.loading-icon').style.display = 'inline-block';
                    // The appendTimezoneCards function will hide the initial message when it starts loading
                    showGridView(); // Show the grid view and load first batch
                }

                // Start the overall time update interval (handles both grid and detail view)
                 if (timeUpdateInterval) clearInterval(timeUpdateInterval);
                 timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000);


            } catch (error) {
                console.error("Error fetching timezones:", error);
                 loadingMessage.textContent = "Could not load timezones.";
                 // Hide the loading icon if loading failed
                 loadingMessage.querySelector('.loading-icon').style.display = 'none';
                 gridView.classList.remove('hidden'); // Ensure grid view is visible to show the message
                 detailView.classList.add('hidden');
                 // Hide loading indicators as we can't load timezones
                 loadingMoreIndicator.classList.add('hidden');
                 endOfListIndicator.classList.add('hidden');
            }

            // Initial check for sticky nav visibility (in case page loads scrolled)
            handleScroll();

        } else {
            // Handle browsers that don't support Intl.supportedValuesOf
            loadingMessage.textContent = "Your browser does not fully support timezone listing.";
            console.error("Intl.supportedValuesOf is not supported in this browser.");
             // Hide the loading icon if not supported
             loadingMessage.querySelector('.loading-icon').style.display = 'none';
             gridView.classList.remove('hidden'); // Ensure grid view is visible to show the message
             detailView.classList.add('hidden');
             // Hide loading indicators as we can't load timezones
             loadingMoreIndicator.classList.add('hidden');
             endOfListIndicator.classList.add('hidden');
        }
         console.log("script.js initialization complete.");
    }

    // Initialize the main script when the DOM is ready
    initialize();
});
