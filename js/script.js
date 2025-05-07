// js/script.js

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
    const detailDstStatus = document.getElementById('detail-dst-status');
    // Add elements for other detailed info if you add a data source

    // --- State Variables ---
    let allTimezones = []; // Array to store all timezone identifiers
    let filteredTimezones = []; // Timezones matching the current search
    const itemsPerPage = 60; // Number of timezones to load per batch
    let currentPage = 0;
    let isLoading = false;
    let timeUpdateInterval = null; // To store the interval ID for time updates
    let lastScrollTop = 0; // To track scroll direction
    let isNavSearchExpanded = false; // State of the nav search bar

    // --- Constants ---
    const SCROLL_THRESHOLD = 100; // Scroll distance before showing/hiding nav


    // --- Utility Functions ---

    /**
     * Formats date, time, offset, and basic DST status for a given timezone
     * based on user preferences.
     * @param {string} timezone - The IANA timezone identifier (e.g., 'America/New_York').
     * @returns {{date: string, time: string, offset: string, dstStatus: string}} Formatted timezone information.
     */
    function formatTimezoneDateTime(timezone) {
        // Use userPreferences from settings.js
        // Ensure settings module is loaded before accessing preferences
        const prefs = window.timezoneExplorerSettings ? window.timezoneExplorerSettings.getPreferences() : { timeFormat: '12', dateLocale: 'en-US' };


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
                hour12: prefs.timeFormat === '12' // Use 12-hour format if preferred
            };

            const offsetOptions = {
                timeZone: timezone,
                timeZoneName: 'shortOffset' // Request short offset name (+HH:MM or -HH:MM)
            };

            // Use Intl.DateTimeFormat with error handling and fallback
            let formattedDate = 'N/A';
            try {
                 formattedDate = new Intl.DateTimeFormat(prefs.dateLocale, dateOptions).format(now);
            } catch (e) {
                 console.warn(`Could not format date for locale "${prefs.dateLocale}" for timezone "${timezone}":`, e);
                 formattedDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now); // Fallback to English
            }

             let formattedTime = 'N/A';
             try {
                 formattedTime = new Intl.DateTimeFormat(prefs.dateLocale, timeOptions).format(now); // Use user locale for time format too
             } catch (e) {
                 console.warn(`Could not format time for locale "${prefs.dateLocale}" for timezone "${timezone}":`, e);
                 formattedTime = new Intl.DateTimeFormat('en-US', timeOptions).format(now); // Fallback to English
             }


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

    /**
     * Filters the timezone list based on the current search input value.
     */
    function filterTimezones() {
        const searchTerm = timezoneSearchInput.value.toLowerCase().trim();
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

    // --- Sticky Nav Functions ---

    /**
     * Shows the sticky navigation bar.
     */
    function showStickyNav() {
         stickyNav.classList.add('visible');
         mainControls.classList.add('hidden'); // Hide main search controls
         mainSettingsIcon.classList.add('hidden'); // Hide main settings icon

         // Move the search input to the nav bar
         if (!navSearchInputContainer.contains(timezoneSearchInput)) {
             navSearchInputContainer.appendChild(timezoneSearchInput);
             // Ensure the input is visible and styled correctly in the nav
             timezoneSearchInput.classList.add('in-nav');
         }
    }

    /**
     * Hides the sticky navigation bar.
     */
    function hideStickyNav() {
        stickyNav.classList.remove('visible');
        mainControls.classList.remove('hidden'); // Show main search controls
        mainSettingsIcon.classList.remove('hidden'); // Show main settings icon

        // Collapse the nav search bar if it was expanded
        navSearchBar.classList.remove('expanded');
        isNavSearchExpanded = false;

         // Move the search input back to the main controls
         const mainSearchContainer = mainControls.querySelector('.search-container');
         if (mainSearchContainer && !mainSearchContainer.contains(timezoneSearchInput)) { // Check if the container exists and input is not already there
             mainSearchContainer.appendChild(timezoneSearchInput);
              // Remove nav styling from input
             timezoneSearchInput.classList.remove('in-nav');
         }
    }

    /**
     * Toggles the expanded state of the navigation search bar.
     */
    function toggleNavSearchBar() {
        isNavSearchExpanded = !isNavSearchExpanded;
        if (isNavSearchExpanded) {
            navSearchBar.classList.add('expanded');
            // Focus the search input after animation (slight delay)
            setTimeout(() => timezoneSearchInput.focus(), 300);
        } else {
            navSearchBar.classList.remove('expanded');
             // Optional: Blur the input when collapsing if needed
             // timezoneSearchInput.blur();
        }
    }


    // --- Event Handlers ---

    // Handle search input (attached to the single input element)
    timezoneSearchInput.addEventListener('input', filterTimezones);


    // Handle infinite scrolling and sticky nav visibility
    const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Check if settings modal is currently open
        // Use the exposed function from settings.js
        const isSettingsModalOpen = window.timezoneExplorerSettings ? window.timezoneExplorerSettings.isModalOpen() : false;

        if (!isSettingsModalOpen) { // Only update nav visibility if modal is closed
             // Show/hide sticky nav based on scroll position
             if (scrollTop > SCROLL_THRESHOLD) {
                  showStickyNav();
             } else {
                 hideStickyNav();
             }
        }


        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // For Mobile or negative scrolling

        // Only trigger load more if in grid view and not in a modal
        if (gridView.classList.contains('hidden') || isSettingsModalOpen) return;

        const { scrollHeight, clientHeight } = document.documentElement;

        // Check if user is near the bottom of the page (e.g., within 400px - increased threshold)
        if (scrollTop + clientHeight >= scrollHeight - 400 && !isLoading) {
            loadMoreTimezones();
        }
    };
    window.addEventListener('scroll', handleScroll);

    // Listen for the custom settingsChange event from settings.js
    document.addEventListener('settingsChange', updateVisibleCardTimes);


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
                 filterTimezones(); // Use the filter function to re-populate based on current input
             }
        }
    });

    // Handle nav search icon click
    navSearchIcon.addEventListener('click', toggleNavSearchBar);
     // Allow nav search icon to be toggled by Enter or Space key when focused
     navSearchIcon.addEventListener('keydown', (event) => {
         if (event.key === 'Enter' || event.key === ' ') {
             event.preventDefault(); // Prevent default scroll/click
             toggleNavSearchBar();
         }
     });


    // Handle main settings icon click
    mainSettingsIcon.addEventListener('click', () => {
        // Call the exposed openModal function from settings.js
        if (window.timezoneExplorerSettings) {
            window.timezoneExplorerSettings.openModal();
        }
    });
     // Allow main settings icon to be opened by Enter or Space key when focused
     mainSettingsIcon.addEventListener('keydown', (event) => {
         if (event.key === 'Enter' || event.key === ' ') {
             event.preventDefault(); // Prevent default scroll/click
              // Call the exposed openModal function from settings.js
             if (window.timezoneExplorerSettings) {
                 window.timezoneExplorerSettings.openModal();
             }
         }
     });

     // Handle nav settings icon click
     if (navSettingsIcon) {
         navSettingsIcon.addEventListener('click', () => {
              // Call the exposed openModal function from settings.js
             if (window.timezoneExplorerSettings) {
                 window.timezoneExplorerSettings.openModal();
             }
         });
          navSettingsIcon.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                   // Call the exposed openModal function from settings.js
                  if (window.timezoneExplorerSettings) {
                      window.timezoneExplorerSettings.openModal();
                  }
              }
          });
     }


    // --- Initialization ---

    /**
     * Initializes the application: loads timezones, checks URL for detail view.
     * Settings initialization is handled by settings.js loading.
     */
    function initialize() {
         if (Intl.supportedValuesOf) {
            // Load all timezones
            allTimezones = Intl.supportedValuesOf('timeZone').sort();

            // Settings initialization (loads preferences and applies theme)
            // is handled by the IIFE in settings.js upon script load.

            // Check if a specific timezone is requested in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const requestedTimezone = urlParams.get('timezone');

            // Check if the requested timezone is valid before showing detail view
            if (requestedTimezone && allTimezones.includes(requestedTimezone)) {
                showDetailView(requestedTimezone);
            } else {
                // Default to grid view - DO NOT open modal on load
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

        // Initial check for sticky nav visibility (in case page loads scrolled)
        handleScroll();
    }

    // Initialize the main script
    initialize();
});
