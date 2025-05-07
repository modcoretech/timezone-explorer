// js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridView = document.getElementById('grid-view');
    const detailView = document.getElementById('detail-view');
    const timezonesGrid = document.getElementById('timezones-grid');
    const timezoneSearchInput = document.getElementById('timezone-search');
    const loadingMessage = document.querySelector('.loading-message');
    const loadingMoreIndicator = document.querySelector('.loading-more');
    const endOfListIndicator = document.querySelector('.end-of-list');

    // Detail View Elements
    const detailTimezoneName = document.getElementById('detail-timezone-name');
    const detailDisplayDate = document.getElementById('detail-display-date');
    const detailDisplayTime = document.getElementById('detail-display-time');
    const detailDisplayOffset = document.getElementById('detail-display-offset');
    const detailDstStatus = document.getElementById('detail-dst-status');
    // Add elements for other detailed info if you add a data source

    // Settings Modal Elements
    const settingsIcon = document.getElementById('settings-icon');
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseButton = document.getElementById('settings-close-button');
    const tabButtons = settingsModal.querySelectorAll('.tab-button');
    const tabContents = settingsModal.querySelectorAll('.tab-content');

    // Settings Form Elements
    const timeFormatSelect = document.getElementById('time-format');
    const dateLocaleSelect = document.getElementById('date-locale');
    const themeRadioButtons = document.querySelectorAll('input[name="theme"]');
    const clearCacheButton = document.getElementById('clear-cache-button');

    // --- State Variables ---
    let allTimezones = []; // Array to store all timezone identifiers
    let filteredTimezones = []; // Timezones matching the current search
    const itemsPerPage = 60; // Number of timezones to load per batch
    let currentPage = 0;
    let isLoading = false;
    let timeUpdateInterval = null; // To store the interval ID for time updates

    // User Preferences (loaded from localStorage)
    let userPreferences = {
        timeFormat: '12', // '12' or '24'
        dateLocale: 'en-US',
        theme: 'light' // 'light', 'dark', 'blue', etc.
    };

    // --- Constants ---
    const LOCAL_STORAGE_KEY = 'timezoneExplorerPreferences';


    // --- Utility Functions ---

    /**
     * Loads user preferences from local storage.
     */
    function loadPreferences() {
        const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedPreferences) {
            userPreferences = JSON.parse(savedPreferences);
        }
    }

    /**
     * Saves user preferences to local storage.
     */
    function savePreferences() {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPreferences));
    }

    /**
     * Applies the current theme preference to the body.
     */
    function applyTheme() {
        document.body.classList.remove('light', 'dark-mode', 'blue-theme'); // Remove existing theme classes
        document.body.classList.add(`${userPreferences.theme}-theme`); // Add the selected theme class

        // Special handling for default light theme class
        if (userPreferences.theme === 'light') {
             document.body.classList.remove('dark-mode', 'blue-theme'); // Ensure other theme classes are removed
        }
    }

    /**
     * Formats date, time, offset, and basic DST status for a given timezone
     * based on user preferences.
     * @param {string} timezone - The IANA timezone identifier (e.g., 'America/New_York').
     * @returns {{date: string, time: string, offset: string, dstStatus: string}} Formatted timezone information.
     */
    function formatTimezoneDateTime(timezone) {
        try {
            const now = new Date();

            // Date options based on user locale
            const dateOptions = {
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            };

            // Time options based on user format preference
            const timeOptions = {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: userPreferences.timeFormat === '12' // Use 12-hour format if preferred
            };

            const offsetOptions = {
                timeZone: timezone,
                timeZoneName: 'shortOffset' // Request short offset name (+HH:MM or -HH:MM)
            };

            const formattedDate = new Intl.DateTimeFormat(userPreferences.dateLocale, dateOptions).format(now);
            const formattedTime = new Intl.DateTimeFormat(userPreferences.dateLocale, timeOptions).format(now); // Use user locale for time format too


            // Attempt to get UTC offset string using Intl.DateTimeFormat
            const dummyDateString = new Intl.DateTimeFormat('en-US', offsetOptions).format(now); // Use en-US for offset string consistency
            const offsetMatch = dummyDateString.match(/[+-]\d{1,2}(:\d{2})?/);
            const utcOffset = offsetMatch ? offsetMatch[0] : 'N/A';

            // Basic DST status detection (heuristic - may not be 100% accurate)
            const jan1st = new Date(now.getFullYear(), 0, 1);
            const july1st = new Date(now.getFullYear(), 6, 1);
            const janOffsetMatch = jan1st.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);
            const julyOffsetMatch = july1st.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);
            const currentOffsetMatch = now.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);

            let dstStatus = 'Unknown';
            if (janOffsetMatch && julyOffsetMatch && currentOffsetMatch) {
                 if (janOffsetMatch[0] !== julyOffsetMatch[0]) {
                     if (currentOffsetMatch[0] === janOffsetMatch[0]) {
                         dstStatus = 'Not Observing DST';
                     } else if (currentOffsetMatch[0] === julyOffsetMatch[0]) {
                         dstStatus = 'Observing DST';
                     } else {
                         dstStatus = 'Offset varies';
                     }
                 } else {
                     dstStatus = 'Does not observe DST';
                 }
            } else {
                 dstStatus = 'DST status could not be determined';
            }


            return {
                date: formattedDate,
                time: formattedTime,
                offset: utcOffset,
                dstStatus: dstStatus
            };
        } catch (error) {
             console.error(`Error formatting time for ${timezone}:`, error);
             return {
                date: 'Error',
                time: 'Error',
                offset: 'Error',
                dstStatus: 'Error'
             };
        }
    }

    /**
     * Creates a DOM element for a timezone card in the grid view.
     * @param {string} timezone - The IANA timezone identifier.
     * @returns {HTMLElement} The created card element.
     */
    function createTimezoneCard(timezone) {
        const card = document.createElement('div');
        card.classList.add('timezone-card');
        card.dataset.timezone = timezone; // Store timezone identifier

        // Display initial loading state or static info until updated by interval
        const { date, time, offset } = formatTimezoneDateTime(timezone); // Get initial time

        card.innerHTML = `
            <h3>${timezone}</h3>
            <p><strong>Current Date:</strong> <span class="display-date">${date}</span></p>
            <p><strong>Current Time:</strong> <span class="display-time">${time}</span></p>
            <p><strong>UTC Offset:</strong> <span class="display-offset">${offset}</span></p>
        `;
        return card;
    }

    /**
     * Updates the time and info displayed on a single timezone card.
     * @param {HTMLElement} card - The timezone card element.
     */
    function updateCardTime(card) {
         const timezone = card.dataset.timezone;
         if (timezone) {
             const { date, time, offset } = formatTimezoneDateTime(timezone);
             card.querySelector('.display-date').textContent = date;
             card.querySelector('.display-time').textContent = time;
             card.querySelector('.display-offset').textContent = offset;
         }
    }

    /**
     * Updates the time for all visible timezone cards in the grid and the detail view if active.
     */
    function updateVisibleCardTimes() {
        // Update grid card times
        const cards = timezonesGrid.querySelectorAll('.timezone-card');
        cards.forEach(card => updateCardTime(card));

        // Update detail view time if it's active
        if (!detailView.classList.contains('hidden')) {
             const detailTimezone = detailTimezoneName.textContent; // Get timezone from detail title
             // Only update if a valid timezone is displayed in the detail view
             if (detailTimezone && detailTimezone !== 'Loading...') {
                 const { date, time, offset, dstStatus } = formatTimezoneDateTime(detailTimezone);
                 detailDisplayDate.textContent = date;
                 detailDisplayTime.textContent = time;
                 detailDisplayOffset.textContent = offset;
                 detailDstStatus.textContent = dstStatus;
             }
        }
    }

    /**
     * Loads and displays the next batch of timezones for the infinite scroll grid.
     */
    function loadMoreTimezones() {
        if (isLoading) return; // Prevent multiple loads
        // Check if all filtered timezones have been loaded
        if (currentPage * itemsPerPage >= filteredTimezones.length && filteredTimezones.length > 0) {
             endOfListIndicator.classList.remove('hidden');
             loadingMoreIndicator.classList.add('hidden');
             isLoading = false; // Ensure isLoading is false when done
             return;
        }


        isLoading = true;
        loadingMoreIndicator.classList.remove('hidden');
        endOfListIndicator.classList.add('hidden'); // Hide end of list message

        const startIndex = currentPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const batch = filteredTimezones.slice(startIndex, endIndex);

        if (batch.length === 0 && currentPage === 0) {
             // No timezones found for the search term or initially
            loadingMessage.classList.remove('hidden');
            loadingMessage.textContent = 'No timezones found matching your search.';
            loadingMoreIndicator.classList.add('hidden');
            isLoading = false;
            return;
        } else if (batch.length === 0 && currentPage > 0) {
             // Reached the end of the list after loading some items
            loadingMoreIndicator.classList.add('hidden');
            endOfListIndicator.classList.remove('hidden');
            isLoading = false;
            return;
        }

        // Append new cards to the grid
        batch.forEach(tz => {
            const card = createTimezoneCard(tz);
            timezonesGrid.appendChild(card);
        });

        currentPage++;
        isLoading = false;
        loadingMoreIndicator.classList.add('hidden');

         // Check if this was the last batch
        if (endIndex >= filteredTimezones.length) {
            endOfListIndicator.classList.remove('hidden');
        }
    }

    // --- View Management ---

    /**
     * Shows the grid view and hides the detail view.
     */
    function showGridView() {
        gridView.classList.remove('hidden');
        detailView.classList.add('hidden');
        // Clear detail view content to free up memory/prevent stale data
        detailTimezoneName.textContent = '';
        detailDisplayDate.textContent = '';
        detailDisplayTime.textContent = '';
        detailDisplayOffset.textContent = '';
        detailDstStatus.textContent = '';

        // Ensure grid has content if returning from detail view
        if (timezonesGrid.children.length === 0 && filteredTimezones.length > 0) {
            // If grid was cleared, reload the first batch
            currentPage = 0;
            loadMoreTimezones();
        }

        // Restart time updates for grid cards
        if (timeUpdateInterval) clearInterval(timeUpdateInterval);
        timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000);
         // Re-enable scroll listener for infinite scrolling
        window.addEventListener('scroll', handleScroll);
    }

    /**
     * Shows the detail view for a specific timezone and hides the grid view.
     * @param {string} timezone - The IANA timezone identifier to display.
     */
    function showDetailView(timezone) {
        gridView.classList.add('hidden');
        detailView.classList.remove('hidden');
        // Clear grid content to free up memory when navigating away
        timezonesGrid.innerHTML = '';
        // Stop infinite scrolling listener
        window.removeEventListener('scroll', handleScroll);

        // Display loading state for detail view
        detailTimezoneName.textContent = 'Loading...';
        detailDisplayDate.textContent = 'Loading...';
        detailDisplayTime.textContent = 'Loading...';
        detailDisplayOffset.textContent = 'Loading...';
        detailDstStatus.textContent = 'Loading...';


        // Update detail view with selected timezone info
        if (timezone) {
            const { date, time, offset, dstStatus } = formatTimezoneDateTime(timezone);
            detailTimezoneName.textContent = timezone;
            detailDisplayDate.textContent = date;
            detailDisplayTime.textContent = time;
            detailDisplayOffset.textContent = offset;
            detailDstStatus.textContent = dstStatus;
            // Populate other detail fields here if you have more data
        } else {
             // Handle case where timezone is null or invalid
             detailTimezoneName.textContent = 'Error loading timezone details.';
             detailDisplayDate.textContent = '';
             detailDisplayTime.textContent = '';
             detailDisplayOffset.textContent = '';
             detailDstStatus.textContent = '';
        }

         // Start time updates specifically for the detail view
         if (timeUpdateInterval) clearInterval(timeUpdateInterval);
         timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000); // updateVisibleCardTimes also updates the detail view
    }

    // --- Settings Modal Functions ---

    /**
     * Opens the settings modal.
     */
    function openSettingsModal() {
        settingsModal.classList.remove('hidden');
         // Populate settings form with current preferences
         timeFormatSelect.value = userPreferences.timeFormat;
         dateLocaleSelect.value = userPreferences.dateLocale;
         themeRadioButtons.forEach(radio => {
             if (radio.value === userPreferences.theme) {
                 radio.checked = true;
             }
         });
    }

    /**
     * Closes the settings modal.
     */
    function closeSettingsModal() {
        settingsModal.classList.add('hidden');
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
            } else {
                button.classList.remove('active');
            }
        });
    }

    /**
     * Handles changes in the settings form and updates preferences.
     */
    function handleSettingChange() {
        // Update time format preference
        userPreferences.timeFormat = timeFormatSelect.value;

        // Update date locale preference
        userPreferences.dateLocale = dateLocaleSelect.value;

        // Update theme preference
        themeRadioButtons.forEach(radio => {
            if (radio.checked) {
                userPreferences.theme = radio.value;
            }
        });

        savePreferences(); // Save updated preferences
        applyTheme(); // Apply the new theme

        // Re-render visible times with new preferences
        updateVisibleCardTimes();
         // If in grid view, update all currently displayed cards
         if (!gridView.classList.contains('hidden')) {
             const cards = timezonesGrid.querySelectorAll('.timezone-card');
             cards.forEach(card => updateCardTime(card));
         }
         // If in detail view, update the detail view
         if (!detailView.classList.contains('hidden')) {
              const detailTimezone = detailTimezoneName.textContent;
              if (detailTimezone && detailTimezone !== 'Loading...') {
                  const { date, time, offset, dstStatus } = formatTimezoneDateTime(detailTimezone);
                  detailDisplayDate.textContent = date;
                  detailDisplayTime.textContent = time;
                  detailDisplayOffset.textContent = offset;
                  detailDstStatus.textContent = dstStatus;
              }
         }
    }

    /**
     * Clears all saved preferences from local storage.
     */
    function clearSavedSettings() {
        if (confirm('Are you sure you want to clear all saved settings? This will reset your theme and time/date preferences.')) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            // Reset preferences to default
            userPreferences = {
                timeFormat: '12',
                dateLocale: 'en-US',
                theme: 'light'
            };
            applyTheme(); // Apply default theme
            // Update settings form to reflect defaults
            timeFormatSelect.value = userPreferences.timeFormat;
            dateLocaleSelect.value = userPreferences.dateLocale;
             themeRadioButtons.forEach(radio => {
                 radio.checked = (radio.value === userPreferences.theme);
             });
            updateVisibleCardTimes(); // Update times with default preferences
            alert('Saved settings cleared.');
        }
    }


    // --- Event Handlers ---

    // Handle search input
    timezoneSearchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase().trim(); // Trim whitespace
        currentPage = 0; // Reset pagination
        timezonesGrid.innerHTML = ''; // Clear current grid
        endOfListIndicator.classList.add('hidden'); // Hide end of list message
        loadingMessage.classList.add('hidden'); // Hide initial message

        if (searchTerm.length > 0) {
             filteredTimezones = allTimezones.filter(tz =>
                tz.toLowerCase().includes(searchTerm)
            );
        } else {
            // If search is cleared, reset to show initial batch of all timezones
            filteredTimezones = [...allTimezones]; // Copy all timezones
        }

        loadMoreTimezones(); // Load the first batch of filtered results
    });

    // Handle infinite scrolling
    const handleScroll = () => {
        // Only trigger load more if in grid view and not in a modal
        if (gridView.classList.contains('hidden') || !settingsModal.classList.contains('hidden')) return;

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

        // Check if user is near the bottom of the page (e.g., within 400px - increased threshold)
        if (scrollTop + clientHeight >= scrollHeight - 400 && !isLoading) {
            loadMoreTimezones();
        }
    };
    window.addEventListener('scroll', handleScroll);


    // Handle timezone card click to navigate to detail page (using event delegation)
    timezonesGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.timezone-card');
        if (card) {
            const timezone = card.dataset.timezone;
            if (timezone) {
                // Navigate to the detail page URL using history.pushState
                history.pushState({ timezone: timezone }, '', `?timezone=${encodeURIComponent(timezone)}`);
                showDetailView(timezone);
            }
        }
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const requestedTimezone = urlParams.get('timezone');

        // Check if the requested timezone is valid before showing detail view
        if (requestedTimezone && allTimezones.includes(requestedTimezone)) {
            showDetailView(requestedTimezone);
        } else {
            // If no timezone param or invalid, show grid view
            showGridView();
             // Need to re-populate the grid if it was cleared
             if (timezonesGrid.children.length === 0 && filteredTimezones.length > 0) {
                 currentPage = 0; // Reset pagination for grid
                 // Re-apply current search filter if any
                 const searchTerm = timezoneSearchInput.value.toLowerCase().trim();
                 if (searchTerm.length > 0) {
                      filteredTimezones = allTimezones.filter(tz =>
                         tz.toLowerCase().includes(searchTerm)
                     );
                 } else {
                      filteredTimezones = [...allTimezones];
                 }
                 loadMoreTimezones();
             }
        }
    });

    // Handle settings icon click
    settingsIcon.addEventListener('click', openSettingsModal);

    // Handle settings modal close button click
    settingsCloseButton.addEventListener('click', closeSettingsModal);

    // Handle clicking outside the settings modal content to close
    settingsModal.addEventListener('click', (event) => {
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

    // Handle changes in settings form (time format, date locale, theme)
    timeFormatSelect.addEventListener('change', handleSettingChange);
    dateLocaleSelect.addEventListener('change', handleSettingChange);
    themeRadioButtons.forEach(radio => {
        radio.addEventListener('change', handleSettingChange);
    });

    // Handle clear cache button click
    clearCacheButton.addEventListener('click', clearSavedSettings);


    // --- Initialization ---

    /**
     * Initializes the application: loads timezones, applies theme, checks URL for detail view.
     */
    function initialize() {
         if (Intl.supportedValuesOf) {
            // Load all timezones
            allTimezones = Intl.supportedValuesOf('timeZone').sort();

            // Load user preferences
            loadPreferences();

            // Apply saved theme or system preference
            applyTheme();

            // Check if a specific timezone is requested in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const requestedTimezone = urlParams.get('timezone');

            // Check if the requested timezone is valid before showing detail view
            if (requestedTimezone && allTimezones.includes(requestedTimezone)) {
                showDetailView(requestedTimezone);
            } else {
                // Default to grid view
                filteredTimezones = [...allTimezones]; // Initially filtered list is all timezones
                loadingMessage.classList.add('hidden'); // Hide initial loading message
                showGridView(); // Show the grid view and load first batch
            }

            // Start the overall time update interval (handles both grid and detail view)
             if (timeUpdateInterval) clearInterval(timeUpdateInterval);
             timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000);


        } else {
            // Handle browsers that don't support Intl.supportedValuesOf
            loadingMessage.textContent = "Your browser does not fully support timezone listing.";
            console.error("Intl.supportedValuesOf is not supported in this browser.");
             gridView.classList.remove('hidden'); // Ensure grid view is visible to show the message
             detailView.classList.add('hidden');
             // Hide loading indicators as we can't load timezones
             loadingMoreIndicator.classList.add('hidden');
             endOfListIndicator.classList.add('hidden');
        }
    }

    initialize(); // Start the application
});
