// js/script.js - Combined Main App Logic and Settings Module

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed.");

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Corrected path for GitHub Pages subfolder hosting
            navigator.serviceWorker.register('/timezone-explorer/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }

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
    const detailDstStatus = document = document.getElementById('detail-dst-status');

    // Settings Modal Elements (Now within script.js scope)
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseButton = document.getElementById('settings-close-button');
    const tabButtons = settingsModal ? settingsModal.querySelectorAll('.tabs-sidebar .tab-button') : []; // Check if modal exists
    const tabContents = settingsModal ? settingsModal.querySelectorAll('.tab-content-area .tab-content') : []; // Check if modal exists

    // Settings Form Elements (Now within script.js scope)
    const timeFormatSelect = document.getElementById('time-format');
    const dateLocaleSelect = document.getElementById('date-locale'); // Corresponds to Date Display Format
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const clearCacheButton = document.getElementById('clear-cache-button');


    // --- State Variables ---
    let allTimezones = []; // Full list of timezones
    let filteredTimezones = []; // Timezones currently displayed or to be displayed
    const timezonesPerPage = 20; // Number of timezones to load at once
    let currentPage = 0; // Current page for infinite scrolling
    let isLoading = false; // To prevent multiple loads
    let timeUpdateInterval = null; // Interval for updating times
    let isInitialLoad = true; // Flag for the very first load


    // --- Settings State (Now within script.js scope) ---
    let userPreferences = {
        timeFormat: '12', // '12' or '24'
        dateLocale: 'en-US', // Corresponds to Date Display Format
        isDarkMode: false, // Simplified to a boolean
        favoriteTimezones: [] // Array to store favorited timezone strings
    };

    // --- Constants ---
    const LOCAL_STORAGE_KEY = 'timezoneExplorerPreferences';
    const SKELETON_COUNT = 6; // Number of skeleton cards to show initially


    console.log("script.js starting execution.");


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
     * Gets the UTC offset for a given timezone for display.
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
                 // Clean up common formats like GMT-5 to UTC-05:00 if possible
                 if (offset.startsWith('GMT')) {
                     offset = offset.replace('GMT', 'UTC');
                 }
                 // Add leading zero if needed (e.g., UTC-5 becomes UTC-05)
                 if (/UTC[+-]\d$/.test(offset)) {
                     offset = offset.replace(/([+-])(\d)$/, '$10$2');
                 }
                 // Add ':00' if only hour is present (e.g., UTC-05 becomes UTC-05:00)
                 if (/UTC[+-]\d{2}$/.test(offset) && !/UTC[+-]\d{2}:\d{2}$/.test(offset)) {
                     offset += ':00';
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

        // Check if this timezone is a favorite
        const isFavorite = userPreferences.favoriteTimezones.includes(timezone);
        if (isFavorite) {
            card.classList.add('favorite');
        }

        const now = new Date(); // Get current local time

        // Pass the timezone string to formatDateTime
        const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
        const offset = getUtcOffset(timezone); // Use getUtcOffset for display string

        card.innerHTML = `
            <h3>${timezone.replace(/_/g, ' ')}</h3>
            <p><strong>Current Date:</strong> <span class="display-date">${formattedDate}</span></p>
            <p><strong>Current Time:</strong> <span class="display-time">${formattedTime}</span></p>
            <p><strong>UTC Offset:</strong> <span class="display-offset">${offset}</span></p>
            <span class="favorite-icon-container" aria-label="Toggle Favorite">
                <span class="favorite-icon-svg" aria-hidden="true"></span>
            </span>
            <span class="detail-arrow-icon" aria-label="View Details"></span>
        `;
        return card;
    }


    /**
     * Populates the grid with timezone cards.
     * @param {Array<string>} timezonesToDisplay - Array of timezone strings.
     * @param {boolean} append - Whether to append to existing cards or replace.
     */
    function populateTimezonesGrid(timezonesToDisplay, append = false) {
        if (!append) {
            timezonesGrid.innerHTML = ''; // Clear existing cards
            // Show skeletons only on initial load or full reload
            if (isInitialLoad) {
                for (let i = 0; i < SKELETON_COUNT; i++) {
                    const skeletonCard = createSkeletonCard();
                    timezonesGrid.appendChild(skeletonCard);
                }
            }
        }

        if (timezonesToDisplay.length === 0 && !isInitialLoad) {
            loadingMessage.textContent = "No timezones found for your search.";
            loadingMessage.classList.remove('hidden');
            if (loadingMoreIndicator) loadingMoreIndicator.classList.add('hidden');
            if (endOfListIndicator) endOfListIndicator.classList.add('hidden');
            return;
        }

        // Hide message if content is being loaded
        if (loadingMessage) loadingMessage.classList.add('hidden');


        // Remove skeleton cards once real content is ready to be appended
        if (!append && isInitialLoad) {
            // A slight delay ensures skeletons are visible for a moment
            setTimeout(() => {
                document.querySelectorAll('.skeleton-card').forEach(skeleton => skeleton.remove());
                addTimezonesToGrid(timezonesToDisplay);
                isInitialLoad = false; // Initial load complete
            }, 500); // Adjust delay as needed
        } else {
             addTimezonesToGrid(timezonesToDisplay);
        }
    }

    /**
     * Helper function to add timezone cards to the grid.
     * @param {Array<string>} timezonesToAdd - Array of timezone strings to add.
     */
    function addTimezonesToGrid(timezonesToAdd) {
        // Sort favorites to the top if they are present in the current filter/page
        const favoritesInCurrentBatch = timezonesToAdd.filter(tz => userPreferences.favoriteTimezones.includes(tz));
        const nonFavoritesInCurrentBatch = timezonesToAdd.filter(tz => !userPreferences.favoriteTimezones.includes(tz));

        favoritesInCurrentBatch.sort((a, b) => {
            const nameA = a.split('/').pop();
            const nameB = b.split('/').pop();
            return nameA.localeCompare(nameB);
        });
        nonFavoritesInCurrentBatch.sort((a, b) => {
            const nameA = a.split('/').pop();
            const nameB = b.split('/').pop();
            return nameA.localeCompare(nameB);
        });

        [...favoritesInCurrentBatch, ...nonFavoritesInCurrentBatch].forEach(timezone => {
            const card = createTimezoneCard(timezone);
            timezonesGrid.appendChild(card);
        });

        // Add event listeners for new cards
        addCardEventListeners();
    }


    /**
     * Creates a skeleton loading card.
     * @returns {HTMLElement} - The created skeleton card element.
     */
    function createSkeletonCard() {
        const card = document.createElement('div');
        card.classList.add('timezone-card', 'skeleton-card');
        card.innerHTML = `
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text"></div>
        `;
        return card;
    }


    /**
     * Filters timezones based on search input.
     * @param {string} searchTerm - The text to search for.
     */
    function filterTimezones(searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filteredTimezones = allTimezones.filter(timezone =>
            timezone.toLowerCase().includes(lowerCaseSearchTerm)
        );
        currentPage = 0; // Reset pagination for new search
        populateTimezonesGrid(filteredTimezones.slice(0, timezonesPerPage));
        checkEndOfList(); // Check if all results fit on one page
    }


    /**
     * Loads more timezones for infinite scrolling.
     */
    function loadMoreTimezones() {
        if (isLoading) return; // Prevent multiple simultaneous loads
        isLoading = true;

        if (loadingMoreIndicator) loadingMoreIndicator.classList.remove('hidden');

        // Simulate network delay
        setTimeout(() => {
            currentPage++;
            const startIndex = currentPage * timezonesPerPage;
            const endIndex = startIndex + timezonesPerPage;
            const newTimezones = filteredTimezones.slice(startIndex, endIndex);

            if (newTimezones.length > 0) {
                addTimezonesToGrid(newTimezones);
            }

            isLoading = false;
            if (loadingMoreIndicator) loadingMoreIndicator.classList.add('hidden');
            checkEndOfList();
        }, 300); // Short delay for smoother loading indication
    }


    /**
     * Checks if all available timezones have been loaded and displays end message.
     */
    function checkEndOfList() {
        if (endOfListIndicator) {
            if (currentPage * timezonesPerPage >= filteredTimezones.length) {
                endOfListIndicator.classList.remove('hidden');
                if (loadingMoreIndicator) loadingMoreIndicator.classList.add('hidden');
            } else {
                endOfListIndicator.classList.add('hidden');
            }
        }
    }


    /**
     * Updates the displayed date and time for all cards and the detail view.
     */
    function updateAllCardTimes() {
        const now = new Date();
        document.querySelectorAll('.timezone-card').forEach(card => {
            const timezone = card.dataset.timezone;
            if (timezone) {
                const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
                const offset = getUtcOffset(timezone);

                const displayDateElement = card.querySelector('.display-date');
                const displayTimeElement = card.querySelector('.display-time');
                const displayOffsetElement = card.querySelector('.display-offset');

                if (displayDateElement) {
                    displayDateElement.textContent = formattedDate;
                } else {
                    console.warn(`Element .display-date not found for timezone: ${timezone}`);
                }
                if (displayTimeElement) {
                    displayTimeElement.textContent = formattedTime;
                } else {
                    console.warn(`Element .display-time not found for timezone: ${timezone}`);
                }
                if (displayOffsetElement) {
                    displayOffsetElement.textContent = offset;
                } else {
                    console.warn(`Element .display-offset not found for timezone: ${timezone}`);
                }
            }
        });

        // Update detail view if it's active
        if (detailView && !detailView.classList.contains('hidden') && detailView.dataset.timezone) {
            const detailTimezone = detailView.dataset.timezone;
            const { formattedDate, formattedTime } = formatDateTime(now, detailTimezone, userPreferences.timeFormat, userPreferences.dateLocale);
            const offset = getUtcOffset(detailTimezone);
            const dstStatus = getDstStatus(detailTimezone);

            if (detailTimezoneName) detailTimezoneName.textContent = detailTimezone.replace(/_/g, ' ');
            if (detailDisplayDate) detailDisplayDate.textContent = formattedDate;
            if (detailDisplayTime) detailDisplayTime.textContent = formattedTime;
            if (detailDisplayOffset) detailDisplayOffset.textContent = offset;
            if (detailDstStatus) detailDstStatus.textContent = dstStatus;
        }
    }


    /**
     * Toggles the favorite status of a timezone.
     * @param {string} timezone - The IANA timezone string.
     * @param {HTMLElement} cardElement - The card HTML element.
     */
    function toggleFavorite(timezone, cardElement) {
        const index = userPreferences.favoriteTimezones.indexOf(timezone);
        if (index > -1) {
            userPreferences.favoriteTimezones.splice(index, 1); // Remove
            cardElement.classList.remove('favorite');
            console.log(`Removed ${timezone} from favorites.`);
        } else {
            userPreferences.favoriteTimezones.push(timezone); // Add
            cardElement.classList.add('favorite');
            console.log(`Added ${timezone} to favorites.`);
        }
        savePreferences();
        // Re-populate grid to bring favorites to top if currently visible
        filterTimezones(timezoneSearchInput.value || ''); // Re-filter with current search term
    }


    /**
     * Displays the detail view for a specific timezone.
     * @param {string} timezone - The IANA timezone string.
     */
    function showDetailView(timezone) {
        if (!detailView || !detailTimezoneName || !detailDisplayDate || !detailDisplayTime || !detailDisplayOffset || !detailDstStatus) {
            console.error("Detail view elements are not properly initialized.");
            return;
        }

        const now = new Date();
        const { formattedDate, formattedTime } = formatDateTime(now, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
        const offset = getUtcOffset(timezone);
        const dstStatus = getDstStatus(timezone);

        detailTimezoneName.textContent = timezone.replace(/_/g, ' ');
        detailDisplayDate.textContent = formattedDate;
        detailDisplayTime.textContent = formattedTime;
        detailDisplayOffset.textContent = offset;
        detailDstStatus.textContent = dstStatus;
        detailView.dataset.timezone = timezone; // Store for updates

        gridView.classList.add('hidden');
        detailView.classList.remove('hidden');

        // Clear existing interval and set a new one for detail view
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
        }
        timeUpdateInterval = setInterval(() => {
            const detailNow = new Date();
            const { formattedDate: updatedDate, formattedTime: updatedTime } = formatDateTime(detailNow, timezone, userPreferences.timeFormat, userPreferences.dateLocale);
            const updatedOffset = getUtcOffset(timezone);
            const updatedDstStatus = getDstStatus(timezone);

            if (detailDisplayDate) detailDisplayDate.textContent = updatedDate;
            if (detailDisplayTime) detailDisplayTime.textContent = updatedTime;
            if (detailDisplayOffset) detailDisplayOffset.textContent = updatedOffset;
            if (detailDstStatus) detailDstStatus.textContent = updatedDstStatus;
        }, 1000); // Update every second
    }


    /**
     * Hides the detail view and shows the grid view.
     */
    function hideDetailView() {
        if (timeUpdateInterval) {
            clearInterval(timeUpdateInterval);
            timeUpdateInterval = null; // Clear the interval reference
        }
        if (detailView) detailView.classList.add('hidden');
        if (gridView) gridView.classList.remove('hidden');

        // Restart the interval for grid view
        timeUpdateInterval = setInterval(updateAllCardTimes, 1000);
    }


    /**
     * Saves user preferences to local storage.
     */
    function savePreferences() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPreferences));
            console.log("Preferences saved:", userPreferences);
        } catch (e) {
            console.error("Error saving preferences to localStorage:", e);
        }
    }


    /**
     * Loads user preferences from local storage.
     */
    function loadPreferences() {
        try {
            const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedPreferences) {
                userPreferences = { ...userPreferences, ...JSON.parse(savedPreferences) };
                console.log("Preferences loaded:", userPreferences);
            }
        } catch (e) {
            console.error("Error loading preferences from localStorage:", e);
        }
        applyPreferences();
    }


    /**
     * Applies loaded preferences to the UI.
     */
    function applyPreferences() {
        // Apply time format
        if (timeFormatSelect) {
            timeFormatSelect.value = userPreferences.timeFormat;
        }

        // Apply date locale
        if (dateLocaleSelect) {
            dateLocaleSelect.value = userPreferences.dateLocale;
        }

        // Apply dark mode
        if (darkModeToggle) {
            darkModeToggle.checked = userPreferences.isDarkMode;
            document.body.classList.toggle('dark-mode', userPreferences.isDarkMode);
        }

        // Re-render or update times based on new preferences
        updateAllCardTimes();
        // If detail view is open, ensure it also updates
        if (!detailView.classList.contains('hidden') && detailView.dataset.timezone) {
             showDetailView(detailView.dataset.timezone);
        }
    }


    /**
     * Populates the date locale select element.
     */
    function populateDateLocaleSelect() {
        if (!dateLocaleSelect) return;

        const locales = [
            { code: 'en-US', name: 'English (US)' },
            { code: 'en-GB', name: 'English (UK)' },
            { code: 'es-ES', name: 'Spanish (Spain)' },
            { code: 'fr-FR', name: 'French (France)' },
            { code: 'de-DE', name: 'German (Germany)' },
            { code: 'ja-JP', name: 'Japanese (Japan)' },
            { code: 'zh-CN', name: 'Chinese (Simplified)' },
            { code: 'ar', name: 'Arabic' },
            { code: 'hi', name: 'Hindi' },
            { code: 'pt-BR', name: 'Portuguese (Brazil)' },
            { code: 'ru-RU', name: 'Russian (Russia)' },
            { code: 'ko-KR', name: 'Korean (Korea)' },
            { code: 'it-IT', name: 'Italian (Italy)' },
            { code: 'nl-NL', name: 'Dutch (Netherlands)' },
            { code: 'sv-SE', name: 'Swedish (Sweden)' },
            { code: 'pl-PL', name: 'Polish (Poland)' },
            { code: 'tr-TR', name: 'Turkish (Turkey)' }
        ];

        dateLocaleSelect.innerHTML = ''; // Clear existing options
        locales.forEach(locale => {
            const option = document.createElement('option');
            option.value = locale.code;
            option.textContent = locale.name;
            dateLocaleSelect.appendChild(option);
        });

        // Set selected value based on current preferences
        dateLocaleSelect.value = userPreferences.dateLocale;
    }


    // --- Event Listeners ---

    // Search input functionality
    if (timezoneSearchInput) {
        timezoneSearchInput.addEventListener('input', (e) => {
            filterTimezones(e.target.value);
        });
    }

    // Infinite scrolling
    window.addEventListener('scroll', () => {
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && !isLoading) {
            loadMoreTimezones();
        }
    });


    // Sticky Nav functionality
    const handleScroll = () => {
        if (stickyNav) {
            if (window.scrollY > 0) {
                stickyNav.classList.add('scrolled');
                if (mainSettingsIcon) mainSettingsIcon.classList.add('hidden'); // Hide main settings icon
            } else {
                stickyNav.classList.remove('scrolled');
                if (mainSettingsIcon) mainSettingsIcon.classList.remove('hidden'); // Show main settings icon
                navSearchBar.classList.remove('expanded'); // Collapse search bar if scrolled to top
                // Move timezoneSearchInput back to main-controls if it's in nav
                if (timezoneSearchInput && navSearchInputContainer.contains(timezoneSearchInput)) {
                    mainControls.prepend(timezoneSearchInput);
                    timezoneSearchInput.classList.remove('in-nav');
                }
            }
        }
    };
    window.addEventListener('scroll', handleScroll);


    // Nav Search Icon toggle
    if (navSearchIcon && navSearchBar && timezoneSearchInput && navSearchInputContainer && mainControls) {
        navSearchIcon.addEventListener('click', () => {
            navSearchBar.classList.toggle('expanded');
            if (navSearchBar.classList.contains('expanded')) {
                navSearchInputContainer.appendChild(timezoneSearchInput);
                timezoneSearchInput.classList.add('in-nav');
                timezoneSearchInput.focus();
            } else {
                mainControls.prepend(timezoneSearchInput);
                timezoneSearchInput.classList.remove('in-nav');
            }
        });
    }


    // Settings Modal Open/Close
    if (mainSettingsIcon && settingsModal && settingsCloseButton) {
        mainSettingsIcon.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });
        settingsCloseButton.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
        // Close modal if clicking outside content
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
    }

    // Settings Modal Open via Nav Icon
    if (navSettingsIcon && settingsModal) {
        navSettingsIcon.addEventListener('click', () => {
            settingsModal.classList.remove('hidden');
        });
    }


    // Tab switching in settings modal
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const correspondingContent = document.getElementById(targetTab);
            if (correspondingContent) {
                correspondingContent.classList.add('active');
            }
        });
    });

    // Automatically activate the first tab on load if tabs exist
    if (tabButtons.length > 0) {
        tabButtons[0].classList.add('active');
        const firstTabContentId = tabButtons[0].dataset.tab;
        const firstTabContent = document.getElementById(firstTabContentId);
        if (firstTabContent) {
            firstTabContent.classList.add('active');
        }
    }


    // Settings form controls
    if (timeFormatSelect) {
        timeFormatSelect.addEventListener('change', (e) => {
            userPreferences.timeFormat = e.target.value;
            savePreferences();
            updateAllCardTimes(); // Update displayed times
        });
    }

    if (dateLocaleSelect) {
        dateLocaleSelect.addEventListener('change', (e) => {
            userPreferences.dateLocale = e.target.value;
            savePreferences();
            updateAllCardTimes(); // Update displayed dates
        });
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', (e) => {
            userPreferences.isDarkMode = e.target.checked;
            document.body.classList.toggle('dark-mode', userPreferences.isDarkMode);
            savePreferences();
        });
    }

    if (clearCacheButton) {
        clearCacheButton.addEventListener('click', () => {
            if (confirm("Are you sure you want to clear all saved settings (including dark mode and favorites)? This cannot be undone.")) {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                userPreferences = { // Reset to default
                    timeFormat: '12',
                    dateLocale: 'en-US',
                    isDarkMode: false,
                    favoriteTimezones: []
                };
                applyPreferences(); // Apply defaults
                // Also reset dark mode immediately if it was active
                document.body.classList.remove('dark-mode');
                console.log("All saved settings cleared.");
                 // Re-filter/re-render to reflect cleared favorites immediately
                filterTimezones(timezoneSearchInput.value || '');
            }
        });
    }


    /**
     * Attaches event listeners to dynamically created timezone cards.
     */
    function addCardEventListeners() {
        document.querySelectorAll('.timezone-card').forEach(card => {
            // Remove existing listeners to prevent duplicates
            const oldFavoriteIcon = card.querySelector('.favorite-icon-container');
            const oldDetailArrow = card.querySelector('.detail-arrow-icon');

            if (oldFavoriteIcon) {
                oldFavoriteIcon.replaceWith(oldFavoriteIcon.cloneNode(true));
            }
            if (oldDetailArrow) {
                oldDetailArrow.replaceWith(oldDetailArrow.cloneNode(true));
            }

            // Get new references after cloning
            const newFavoriteIcon = card.querySelector('.favorite-icon-container');
            const newDetailArrow = card.querySelector('.detail-arrow-icon');


            const timezone = card.dataset.timezone;

            if (newFavoriteIcon) {
                newFavoriteIcon.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card click
                    toggleFavorite(timezone, card);
                });
            } else {
                console.warn("Favorite icon not found for card:", timezone);
            }

            if (newDetailArrow) {
                newDetailArrow.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card click
                    showDetailView(timezone);
                });
            } else {
                 console.warn("Detail arrow icon not found for card:", timezone);
            }

            // Make the entire card clickable for details as well
            card.addEventListener('click', () => {
                showDetailView(timezone);
            });
        });
        // Add event listener for the back button in detail view
        const backButton = document.getElementById('back-to-grid');
        if (backButton) {
            backButton.addEventListener('click', hideDetailView);
        } else {
            console.warn("Back to grid button not found.");
        }
    }


    // --- Initialization ---
    async function initialize() {
        console.log("Initializing application...");
        if (loadingMessage) {
             loadingMessage.classList.remove('hidden');
             loadingMessage.innerHTML = 'Loading timezones... <span class="loading-icon"></span>';
        }

        // Populate the date locale select
        populateDateLocaleSelect();

        // Load saved preferences before fetching timezones to apply dark mode early
        loadPreferences();

        if (Intl.supportedValuesOf) {
            try {
                allTimezones = Intl.supportedValuesOf('timeZone').sort();
                filteredTimezones = [...allTimezones]; // Initially, all are filtered

                // Initial population of the grid
                populateTimezonesGrid(filteredTimezones.slice(0, timezonesPerPage));

                // Set up interval for time updates for all cards
                if (timeUpdateInterval) {
                    clearInterval(timeUpdateInterval); // Clear any existing interval
                }
                timeUpdateInterval = setInterval(updateAllCardTimes, 1000); // Update every second

                // Initial check for sticky nav visibility (in case page loads scrolled)
                handleScroll();

            } catch (error) {
                 console.error("Error fetching timezones:", error);
                 if (loadingMessage) loadingMessage.textContent = "Error loading timezones. Your browser might not support 'Intl.supportedValuesOf'.";
                 // Ensure grid view is visible to show the message
                 if (gridView) gridView.classList.remove('hidden');
                 if (detailView) detailView.classList.add('hidden');
                 // Hide other indicators
                 if (loadingMoreIndicator) loadingMoreIndicator.classList.add('hidden');
                 if (endOfListIndicator) endOfListIndicator.classList.add('hidden');
            }

            // Initial check for sticky nav visibility (in case page loads scrolled)
            handleScroll();

        } else {
            // Handle browsers that don't support Intl.supportedValuesOf
            if (loadingMessage) loadingMessage.textContent = "Your browser does not fully support timezone listing.";
            console.error("Intl.supportedValuesOf is not supported in this browser.");
             // Hide the loading icon if not supported
             const loadingIconInitial = loadingMessage ? loadingMessage.querySelector('.loading-icon') : null;
             if (loadingIconInitial) loadingIconInitial.style.display = 'none';
             if (gridView) gridView.classList.remove('hidden'); // Ensure grid view is visible to show the message
             if (detailView) detailView.classList.add('hidden');
              // Hide other indicators
             if (loadingMoreIndicator) loadingMoreIndicator.classList.add('hidden');
             if (endOfListIndicator) endOfListIndicator.classList.add('hidden');
        }
         console.log("script.js initialization complete.");
    }

    // Initialize the main script when the DOM is ready
    initialize();
});
