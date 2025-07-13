// js/script.js - Combined Main App Logic and Settings Module

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const gridView = document.getElementById('grid-view');
    const detailView = document.getElementById('detail-view');
    const timezonesGrid = document.getElementById('timezones-grid');
    const loadingMessage = document.querySelector('.loading-message');
    const loadingMoreIndicator = document.querySelector('.loading-more');
    const endOfListIndicator = document.querySelector('.end-of-list');
    const noResultsMessage = document.querySelector('.no-results-message');
    const skeletonLoader = document.getElementById('skeleton-loader'); // New
    const preloader = document.getElementById('preloader'); // New
    const announcer = document.getElementById('announcer'); // New ARIA live region

    // Main Search Input (Single element, moved between containers)
    const timezoneSearchInput = document.getElementById('timezone-search');
    const mainControls = document.getElementById('main-controls'); // Original container
    const navSearchInputContainer = document.getElementById('nav-search-input-container'); // Nav container

    // Sticky Nav Elements
    const stickyNav = document.getElementById('sticky-nav');
    const navSearchIcon = document.getElementById('nav-search-icon');
    const navSearchBar = document.getElementById('nav-search-bar');
    const navSettingsIcon = document.getElementById('nav-settings-icon'); // Settings icon in nav

    // Detail View Elements
    const detailTimezoneName = document.getElementById('detail-timezone-name');
    const detailDisplayDate = document.getElementById('detail-display-date');
    const detailDisplayTime = document.getElementById('detail-display-time');
    const detailDisplayOffset = document.getElementById('detail-display-offset');
    const detailDstStatus = document.getElementById('detail-dst-status');
    const backToGridButton = document.getElementById('back-to-grid-button');
    const favoriteDetailButton = document.getElementById('favorite-detail-button'); // New
    const shareDetailButton = document.getElementById('share-detail-button'); // New

    // Settings Modal Elements
    const settingsModal = document.getElementById('settings-modal');
    const settingsCloseButton = document.getElementById('settings-close-button');
    const tabButtons = settingsModal ? settingsModal.querySelectorAll('.tabs-sidebar .tab-button') : [];
    const tabContents = settingsModal ? settingsModal.querySelectorAll('.tab-content-area .tab-content') : [];

    // Settings Form Elements
    const timeFormatSelect = document.getElementById('time-format');
    const dateLocaleSelect = document.getElementById('date-locale');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const clearCacheButton = document.getElementById('clear-cache-button');

    // New Elements
    const localTimezoneCard = document.getElementById('local-timezone-card');
    const goToTopButton = document.getElementById('go-to-top-button');
    const toastContainer = document.getElementById('toast-container');


    // --- State Variables ---
    let allTimezones = []; // Full list of timezones fetched from API
    let filteredTimezones = []; // Timezones currently displayed or to be displayed after search/filter
    const timezonesPerPage = 20; // Number of timezones to load at once
    let currentPage = 0; // Current page for infinite scrolling
    let isLoading = false; // To prevent multiple loads
    let timeUpdateInterval = null; // Interval for updating times on cards
    let isInitialLoad = true; // Flag for the very first load
    let currentDetailTimezone = null; // Stores the timezone currently shown in detail view


    // --- Settings State ---
    let userPreferences = {
        timeFormat: '12', // '12' or '24'
        dateLocale: 'en-US', // Corresponds to Date Display Format
        isDarkMode: false,
        favoriteTimezones: [] // Array to store favorited timezone strings
    };

    // --- Constants ---
    const LOCAL_STORAGE_KEY = 'timezoneExplorerPreferences';


    // --- Utility Functions ---

    /**
     * Announces text to screen readers.
     * @param {string} message - The message to announce.
     */
    function announce(message) {
        announcer.textContent = message;
    }

    /**
     * Shows a toast notification.
     * @param {string} message - The message to display.
     * @param {string} type - 'success', 'info', or 'error'.
     * @param {number} duration - How long the toast should be visible in ms.
     */
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        toastContainer.appendChild(toast);

        // Show the toast
        setTimeout(() => {
            toast.classList.add('show');
        }, 10); // Small delay for transition to work

        // Hide and remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide'); // Add hide class for fade out
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    /**
     * Debounces a function call.
     * @param {function} func - The function to debounce.
     * @param {number} delay - The delay in milliseconds.
     * @returns {function} - The debounced function.
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    /**
     * Throttles a function call.
     * @param {function} func - The function to throttle.
     * @param {number} limit - The limit in milliseconds.
     * @returns {function} - The throttled function.
     */
    function throttle(func, limit) {
        let inThrottle;
        let lastResult;
        return function(...args) {
            const context = this;
            if (!inThrottle) {
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
                lastResult = func.apply(context, args);
            }
            return lastResult;
        };
    }

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
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: timezone
        };

        const optionsTime = {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: timeFormat === '12',
            timeZone: timezone
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
            return { formattedDate: `Error: ${fallbackDate}`, formattedTime: `Error: ${fallbackTime}` };
        }
    }


    /**
     * Gets the UTC offset for a given timezone for display.
     * @param {string} timezone - The IANA timezone string.
     * @returns {string} - The UTC offset string (e.g., "UTC-05:00").
     */
    function getUtcOffset(timezone) {
         try {
             const now = new Date();
             const options = {
                 timeZoneName: 'shortOffset',
                 timeZone: timezone
             };
             const formatter = new Intl.DateTimeFormat('en-US', options);
             const parts = formatter.formatToParts(now);
             const timeZoneNamePart = parts.find(p => p.type === 'timeZoneName');

             if (timeZoneNamePart) {
                 let offset = timeZoneNamePart.value;
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
             }
         } catch (error) {
             console.error("Error getting UTC offset for timezone", timezone, ":", error);
         }
         // Fallback if unable to determine offset
         try {
            const date = new Date();
            const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
            const diffMs = tzDate.getTime() - utcDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            const sign = diffHours >= 0 ? '+' : '-';
            const absHours = Math.floor(Math.abs(diffHours));
            const absMinutes = Math.abs((diffHours % 1) * 60);
            const paddedHours = String(absHours).padStart(2, '0');
            const paddedMinutes = String(absMinutes).padStart(2, '0');
            return `UTC${sign}${paddedHours}:${paddedMinutes}`;
         } catch (e) {
            console.error("Further fallback for UTC offset failed:", e);
            return 'UTC Offset N/A';
         }
    }


    /**
     * Determines if a timezone is currently observing Daylight Saving Time.
     * This is a heuristic and might not be perfectly accurate for all edge cases.
     * @param {string} timezone - The IANA timezone string.
     * @returns {string} - "Yes", "No", or "Unknown".
     */
    function getDstStatus(timezone) {
        try {
            const now = new Date();
            const jan = new Date(now.getFullYear(), 0, 1, 12, 0, 0); // January 1st (winter)
            const jul = new Date(now.getFullYear(), 6, 1, 12, 0, 0); // July 1st (summer)

            // Get UTC offsets for winter and summer
            const janOffset = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: 'numeric', timeZoneName: 'shortOffset' })
                                  .formatToParts(jan)
                                  .find(p => p.type === 'timeZoneName')?.value;
            const julOffset = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: 'numeric', timeZoneName: 'shortOffset' })
                                  .formatToParts(jul)
                                  .find(p => p.type === 'timeZoneName')?.value;

            if (janOffset && julOffset) {
                // Remove 'GMT' and parse to a comparable format (e.g., -0500)
                const parseOffset = (offsetStr) => {
                    const match = offsetStr.match(/[+-]?\d{1,2}(:\d{2})?/);
                    if (!match) return 0;
                    let val = match[0].replace(':', '');
                    if (val.length === 3) val += '0'; // Handle GMT-5 -> -0500
                    if (val.length === 2) val += '00'; // Handle GMT-5 (if only single digit hours)
                    return parseInt(val);
                };

                const janOffsetVal = parseOffset(janOffset);
                const julOffsetVal = parseOffset(julOffset);

                // If offsets are different, one is DST. Determine current status.
                if (janOffsetVal !== julOffsetVal) {
                    const currentOffset = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, hour: 'numeric', timeZoneName: 'shortOffset' })
                                                .formatToParts(now)
                                                .find(p => p.type === 'timeZoneName')?.value;
                    if (currentOffset) {
                        const currentOffsetVal = parseOffset(currentOffset);
                        // In northern hemisphere, DST means a more positive (or less negative) offset in summer
                        // In southern hemisphere, DST means a more positive (or less negative) offset in winter
                        // A simpler check: if current offset matches the "summer" offset and it's different from "winter", it's DST.
                        // Or if current offset matches the "winter" offset and it's different from "summer", it's standard time.
                        if (currentOffsetVal === Math.max(janOffsetVal, julOffsetVal)) {
                            return "Yes";
                        } else {
                            return "No";
                        }
                    }
                } else {
                    return "No"; // Offsets are the same, no DST observed or not currently in a DST period.
                }
            }
            return "Unknown"; // Fallback if data is missing
        } catch (error) {
            console.error(`Error determining DST status for ${timezone}:`, error);
            return "Unknown";
        }
    }


    /**
     * Populates the date locale select element with available locales.
     */
    function populateLocaleOptions() {
        if (Intl.supportedValuesOf) {
            const locales = Intl.supportedValuesOf('locale').filter(loc => loc.includes('-')); // Filter out basic language codes
            const uniqueLocales = new Set();
            // Try to get more readable names
            const localeNames = locales.map(locale => {
                try {
                    const displayName = new Intl.DisplayNames([navigator.language || 'en-US'], { type: 'language' }).of(locale.split('-')[0]) +
                                        (locale.includes('-') ? ` (${new Intl.DisplayNames([navigator.language || 'en-US'], { type: 'region' }).of(locale.split('-')[1])})` : '');
                    return { value: locale, text: displayName };
                } catch (e) {
                    return { value: locale, text: locale }; // Fallback to raw locale string
                }
            }).filter(item => { // Filter for uniqueness based on display text
                if (uniqueLocales.has(item.text)) {
                    return false;
                }
                uniqueLocales.add(item.text);
                return true;
            }).sort((a, b) => a.text.localeCompare(b.text)); // Sort alphabetically

            dateLocaleSelect.innerHTML = ''; // Clear existing options
            localeNames.forEach(locale => {
                const option = document.createElement('option');
                option.value = locale.value;
                option.textContent = locale.text;
                dateLocaleSelect.appendChild(option);
            });
            dateLocaleSelect.value = userPreferences.dateLocale; // Set saved preference
        } else {
            // Provide a limited set of common locales if supportedValuesOf is not available
            dateLocaleSelect.innerHTML = `
                <option value="en-US">English (United States)</option>
                <option value="en-GB">English (United Kingdom)</option>
                <option value="de-DE">German (Germany)</option>
                <option value="fr-FR">French (France)</option>
                <option value="es-ES">Spanish (Spain)</option>
                <option value="ja-JP">Japanese (Japan)</option>
            `;
            console.warn("Intl.supportedValuesOf is not supported. Using a limited set of locales.");
        }
    }


    // --- Core Logic ---

    /**
     * Loads user preferences from local storage.
     */
    function loadPreferences() {
        try {
            const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedPreferences) {
                userPreferences = { ...userPreferences, ...JSON.parse(savedPreferences) };
            }
        } catch (error) {
            console.error("Error loading preferences from localStorage:", error);
            showToast("Failed to load saved settings. Browser storage might be restricted.", "error");
        }
        applyPreferences();
    }

    /**
     * Saves user preferences to local storage.
     */
    function savePreferences() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userPreferences));
            showToast("Settings saved!", "success");
        } catch (error) {
            console.error("Error saving preferences to localStorage:", error);
            showToast("Failed to save settings. Browser storage might be restricted.", "error");
        }
    }

    /**
     * Applies the current user preferences to the UI.
     */
    function applyPreferences() {
        // Dark Mode
        document.body.classList.toggle('dark-mode', userPreferences.isDarkMode);
        darkModeToggle.checked = userPreferences.isDarkMode;

        // Time Format
        timeFormatSelect.value = userPreferences.timeFormat;

        // Date Locale
        dateLocaleSelect.value = userPreferences.dateLocale; // This should be called after populateLocaleOptions

        updateAllCardTimes();
        updateLocalTimezoneCard();
        updateFavoriteButtons(); // Update star icons on cards and detail view
    }

    /**
     * Clears all saved preferences from local storage and resets UI.
     */
    function clearSavedSettings() {
        try {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            userPreferences = {
                timeFormat: '12',
                dateLocale: 'en-US',
                isDarkMode: false,
                favoriteTimezones: []
            };
            applyPreferences();
            populateLocaleOptions(); // Re-populate to ensure default is selected
            showToast("Settings cleared successfully!", "success");
            filterTimezones(); // Re-filter to show all timezones if favorites were applied
        } catch (error) {
            console.error("Error clearing settings from localStorage:", error);
            showToast("Failed to clear settings. Browser storage might be restricted.", "error");
        }
    }

    /**
     * Adds or removes a timezone from favorites.
     * @param {string} timezone - The timezone string.
     * @returns {boolean} - True if added, false if removed.
     */
    function toggleFavorite(timezone) {
        const index = userPreferences.favoriteTimezones.indexOf(timezone);
        if (index > -1) {
            userPreferences.favoriteTimezones.splice(index, 1);
            showToast(`Removed ${timezone} from favorites.`, "info");
            return false; // Removed
        } else {
            userPreferences.favoriteTimezones.push(timezone);
            showToast(`Added ${timezone} to favorites!`, "success");
            return true; // Added
        }
        // Save immediately, then update UI
        savePreferences();
        updateFavoriteButtons(); // Update all relevant UI
    }

    /**
     * Updates the active state of favorite icons on all cards and detail view button.
     */
    function updateFavoriteButtons() {
        document.querySelectorAll('.timezone-card').forEach(card => {
            const timezone = card.dataset.timezone;
            const favoriteIcon = card.querySelector('.favorite-icon');
            if (userPreferences.favoriteTimezones.includes(timezone)) {
                card.classList.add('favorite');
                if (favoriteIcon) favoriteIcon.classList.add('active');
            } else {
                card.classList.remove('favorite');
                if (favoriteIcon) favoriteIcon.classList.remove('active');
            }
        });

        // Update detail view favorite button
        if (currentDetailTimezone) {
            const isFavorited = userPreferences.favoriteTimezones.includes(currentDetailTimezone);
            favoriteDetailButton.classList.toggle('active', isFavorited);
            favoriteDetailButton.querySelector('.button-text').textContent = isFavorited ? 'Remove from Favorites' : 'Add to Favorites';
        }
    }


    /**
     * Creates a single timezone card element.
     * @param {object} timezoneData - Data for the timezone.
     * @returns {HTMLElement} - The created card element.
     */
    function createTimezoneCard(timezoneData) {
        const card = document.createElement('div');
        card.classList.add('timezone-card');
        card.dataset.timezone = timezoneData.id;

        const now = new Date();
        const { formattedDate, formattedTime } = formatDateTime(now, timezoneData.id, userPreferences.timeFormat, userPreferences.dateLocale);
        const utcOffset = getUtcOffset(timezoneData.id);

        const isFavorite = userPreferences.favoriteTimezones.includes(timezoneData.id);
        if (isFavorite) {
            card.classList.add('favorite');
        }

        card.innerHTML = `
            <h3>${timezoneData.name}</h3>
            <p><strong>Current Time:</strong> <span class="current-time">${formattedTime}</span></p>
            <p><strong>Current Date:</strong> <span class="current-date">${formattedDate}</span></p>
            <p><strong>UTC Offset:</strong> ${utcOffset}</p>
            <div class="favorite-icon ${isFavorite ? 'active' : ''}" role="button" tabindex="0" aria-label="${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}"></div>
        `;

        // Event listener for card click to show detail view
        card.addEventListener('click', (event) => {
            if (!event.target.closest('.favorite-icon')) { // Prevent detail view if favorite icon clicked
                showDetailView(timezoneData.id);
            }
        });

        // Event listener for favorite icon click
        const favoriteIcon = card.querySelector('.favorite-icon');
        if (favoriteIcon) {
            favoriteIcon.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent card click event from firing
                const isAdded = toggleFavorite(timezoneData.id);
                favoriteIcon.classList.toggle('active', isAdded);
                card.classList.toggle('favorite', isAdded);
                favoriteIcon.setAttribute('aria-label', isAdded ? 'Remove from Favorites' : 'Add to Favorites');
            });
            favoriteIcon.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault(); // Prevent default scroll for space
                    event.stopPropagation();
                    const isAdded = toggleFavorite(timezoneData.id);
                    favoriteIcon.classList.toggle('active', isAdded);
                    card.classList.toggle('favorite', isAdded);
                    favoriteIcon.setAttribute('aria-label', isAdded ? 'Remove from Favorites' : 'Add to Favorites');
                }
            });
        }

        return card;
    }

    /**
     * Appends a batch of timezone cards to the grid.
     * @param {Array<object>} timezones - Array of timezone data to append.
     * @param {boolean} clearExisting - Whether to clear the grid before appending.
     */
    function appendTimezoneCards(timezones, clearExisting = false) {
        if (clearExisting) {
            timezonesGrid.innerHTML = '';
            currentPage = 0; // Reset page number when clearing
            loadingMessage.classList.add('hidden');
            loadingMoreIndicator.classList.add('hidden');
            endOfListIndicator.classList.add('hidden');
            noResultsMessage.classList.add('hidden');
            skeletonLoader.classList.remove('hidden'); // Show skeleton while new batch loads
            announce("Loading timezones...");
        }

        if (timezones.length === 0 && clearExisting) {
            noResultsMessage.classList.remove('hidden');
            skeletonLoader.classList.add('hidden');
            announce("No timezones found for your search.");
            return;
        }

        // Simulate a small delay for content loading if not initial load
        if (!isInitialLoad) {
            skeletonLoader.classList.remove('hidden');
            timezonesGrid.classList.add('hidden'); // Hide actual grid
        }
        loadingMessage.classList.remove('hidden');
        loadingMoreIndicator.classList.remove('hidden');


        setTimeout(() => {
            // Remove skeleton loader after simulated load time
            skeletonLoader.classList.add('hidden');
            timezonesGrid.classList.remove('hidden'); // Show actual grid

            const startIndex = currentPage * timezonesPerPage;
            const endIndex = startIndex + timezonesPerPage;
            const timezonesToLoad = timezones.slice(startIndex, endIndex);

            if (timezonesToLoad.length === 0 && !clearExisting) {
                endOfListIndicator.classList.remove('hidden');
                loadingMoreIndicator.classList.add('hidden');
                announce("End of timezones list reached.");
                isLoading = false;
                return;
            }

            timezonesToLoad.forEach(timezone => {
                const card = createTimezoneCard(timezone);
                timezonesGrid.appendChild(card);
            });

            currentPage++;
            isLoading = false;

            if (timezonesToLoad.length < timezonesPerPage || endIndex >= timezones.length) {
                endOfListIndicator.classList.remove('hidden');
                loadingMoreIndicator.classList.add('hidden');
                announce("End of timezones list reached.");
            } else {
                endOfListIndicator.classList.add('hidden');
                loadingMoreIndicator.classList.remove('hidden');
            }

            loadingMessage.classList.add('hidden'); // Hide initial loading message
            announce(`Loaded ${timezonesToLoad.length} timezones.`);

        }, isInitialLoad ? 0 : 500); // No delay on initial load, 500ms for subsequent loads

        isInitialLoad = false; // Set to false after the first load
    }


    /**
     * Updates the time displayed on all visible timezone cards.
     */
    function updateAllCardTimes() {
        const now = new Date();
        document.querySelectorAll('.timezone-card').forEach(card => {
            const timezoneId = card.dataset.timezone;
            const { formattedDate, formattedTime } = formatDateTime(now, timezoneId, userPreferences.timeFormat, userPreferences.dateLocale);
            card.querySelector('.current-time').textContent = formattedTime;
            card.querySelector('.current-date').textContent = formattedDate;
        });

        if (currentDetailTimezone) {
            updateDetailView(currentDetailTimezone);
        }
    }

    /**
     * Updates the local timezone card with current local time.
     */
    function updateLocalTimezoneCard() {
        if (!localTimezoneCard) return;

        const localTimezoneId = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!localTimezoneId) {
            localTimezoneCard.innerHTML = `<p>Unable to determine your local timezone.</p>`;
            return;
        }

        const now = new Date();
        const { formattedDate, formattedTime } = formatDateTime(now, localTimezoneId, userPreferences.timeFormat, userPreferences.dateLocale);
        const utcOffset = getUtcOffset(localTimezoneId);
        const dstStatus = getDstStatus(localTimezoneId);

        localTimezoneCard.innerHTML = `
            <h3 class="timezone-name">${localTimezoneId.replace(/_/g, ' ')}</h3>
            <p><strong>Current Time:</strong> <span class="current-time">${formattedTime}</span></p>
            <p><strong>Current Date:</strong> <span class="current-date">${formattedDate}</span></p>
            <p><strong>UTC Offset:</strong> ${utcOffset}</p>
            <p><strong>Daylight Saving:</strong> ${dstStatus}</p>
        `;
    }

    /**
     * Filters timezones based on search input.
     */
    const filterTimezones = debounce(() => {
        const searchTerm = timezoneSearchInput.value.toLowerCase().trim();
        let currentFiltered = allTimezones;

        if (searchTerm) {
            currentFiltered = allTimezones.filter(tz =>
                tz.name.toLowerCase().includes(searchTerm) ||
                tz.id.toLowerCase().includes(searchTerm)
            );
        }

        filteredTimezones = currentFiltered.sort((a, b) => {
            const aIsFav = userPreferences.favoriteTimezones.includes(a.id);
            const bIsFav = userPreferences.favoriteTimezones.includes(b.id);
            if (aIsFav && !bIsFav) return -1;
            if (!aIsFav && bIsFav) return 1;
            return a.name.localeCompare(b.name);
        }); // Sort alphabetically, favorites first

        appendTimezoneCards(filteredTimezones, true); // Clear and re-append from page 0
    }, 300);


    /**
     * Fetches timezone data from the API (or a local JSON).
     */
    async function fetchTimezones() {
        try {
            // Using a public API that lists IANA timezones and their common names
            const response = await fetch('https://raw.githubusercontent.com/dmfilipenko/timezones.json/master/timezones.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // Map data to a more usable format if needed, or filter out invalid/duplicate entries
            allTimezones = data.map(tz => ({
                id: tz.utc[0], // Use the first UTC entry as the IANA ID
                name: tz.text // Use the text as the display name
            })).filter(tz => tz.id && tz.name && !tz.id.startsWith('Etc/')); // Basic validation & filter out 'Etc/' timezones

            // Sort initial timezones alphabetically
            allTimezones.sort((a, b) => a.name.localeCompare(b.name));

            filterTimezones(); // Initial display of timezones
        } catch (error) {
            console.error("Failed to fetch timezones:", error);
            loadingMessage.textContent = "Failed to load timezones. Please try again later.";
            loadingMessage.classList.remove('hidden');
            skeletonLoader.classList.add('hidden'); // Hide skeleton on error
            announce("Failed to load timezones.");
        }
    }

    /**
     * Handles infinite scrolling.
     */
    const handleScroll = throttle(() => {
        // Only trigger if in grid view and not loading
        if (gridView.classList.contains('hidden') || isLoading) {
            return;
        }

        const scrollThreshold = 100; // Pixels from bottom
        if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - scrollThreshold)) {
            if (currentPage * timezonesPerPage < filteredTimezones.length) {
                isLoading = true;
                appendTimezoneCards(filteredTimezones);
            }
        }

        // Show/hide Go to Top button
        if (window.scrollY > 300) { // Show button after scrolling 300px
            goToTopButton.classList.remove('hidden');
        } else {
            goToTopButton.classList.add('hidden');
        }
    }, 200); // Throttle scroll to prevent excessive calls


    /**
     * Shows the detail view for a specific timezone.
     * @param {string} timezoneId - The IANA timezone ID.
     */
    function showDetailView(timezoneId) {
        const timezoneData = allTimezones.find(tz => tz.id === timezoneId);
        if (!timezoneData) {
            console.error("Timezone data not found for detail view:", timezoneId);
            showToast("Timezone details could not be found.", "error");
            return;
        }

        currentDetailTimezone = timezoneData.id;

        updateDetailView(timezoneData.id); // Populate content

        gridView.classList.add('hidden');
        detailView.classList.remove('hidden');
        announce(`Showing details for ${timezoneData.name}`);
        clearInterval(timeUpdateInterval); // Stop interval for grid view
        timeUpdateInterval = setInterval(() => updateDetailView(timezoneData.id), 1000); // Update detail view every second
        updateFavoriteButtons(); // Ensure button state is correct
    }

    /**
     * Updates the content of the detail view for the given timezone.
     * @param {string} timezoneId - The IANA timezone ID.
     */
    function updateDetailView(timezoneId) {
        const timezoneData = allTimezones.find(tz => tz.id === timezoneId);
        if (!timezoneData) return; // Should not happen if called correctly

        const now = new Date();
        const { formattedDate, formattedTime } = formatDateTime(now, timezoneId, userPreferences.timeFormat, userPreferences.dateLocale);
        const utcOffset = getUtcOffset(timezoneId);
        const dstStatus = getDstStatus(timezoneId);

        detailTimezoneName.textContent = timezoneData.name;
        detailDisplayDate.textContent = formattedDate;
        detailDisplayTime.textContent = formattedTime;
        detailDisplayOffset.textContent = utcOffset;
        detailDstStatus.textContent = dstStatus;
    }


    /**
     * Shows the settings modal.
     */
    function showSettingsModal() {
        settingsModal.classList.add('visible');
        // Set initial active tab
        document.querySelector('.tab-button[data-tab="appearance"]').click();
        announce("Settings modal opened.");
    }

    /**
     * Hides the settings modal.
     */
    function hideSettingsModal() {
        settingsModal.classList.remove('visible');
        announce("Settings modal closed.");
    }


    /**
     * Handles initial page load and setup.
     */
    async function initialize() {
        showPreloader(); // Show preloader immediately

        // Register Service Worker for PWA/Offline support
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/timezone-explorer/service-worker.js', { scope: '/timezone-explorer/' });
                console.log('Service Worker registered with scope:', registration.scope);
                showToast("Offline support enabled!", "success", 2000);
            } catch (error) {
                console.error('Service Worker registration failed:', error);
                showToast("Offline support could not be enabled.", "error", 2000);
            }
        }

        loadPreferences(); // Load preferences early to apply dark mode
        populateLocaleOptions(); // Populate locale options

        // Event Listeners
        navSearchIcon.addEventListener('click', () => {
            navSearchBar.classList.toggle('expanded');
            if (navSearchBar.classList.contains('expanded')) {
                navSearchInputContainer.appendChild(timezoneSearchInput);
                timezoneSearchInput.classList.add('in-nav');
                timezoneSearchInput.focus();
                announce("Search bar expanded.");
            } else {
                mainControls.prepend(timezoneSearchInput);
                timezoneSearchInput.classList.remove('in-nav');
                timezoneSearchInput.blur();
                announce("Search bar collapsed.");
            }
        });

        navSettingsIcon.addEventListener('click', showSettingsModal);
        settingsCloseButton.addEventListener('click', hideSettingsModal);
        // Close modal when clicking outside content
        settingsModal.addEventListener('click', (event) => {
            if (event.target === settingsModal) {
                hideSettingsModal();
            }
        });

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab;

                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                tabContents.forEach(content => {
                    if (content.id === `tab-${tab}`) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
                announce(`${tab} tab selected in settings.`);
            });
        });

        // Settings form element listeners
        timeFormatSelect.addEventListener('change', (event) => {
            userPreferences.timeFormat = event.target.value;
            savePreferences();
            updateAllCardTimes();
            updateLocalTimezoneCard();
        });

        dateLocaleSelect.addEventListener('change', (event) => {
            userPreferences.dateLocale = event.target.value;
            savePreferences();
            updateAllCardTimes();
            updateLocalTimezoneCard();
        });

        darkModeToggle.addEventListener('change', (event) => {
            userPreferences.isDarkMode = event.target.checked;
            savePreferences();
            document.body.classList.toggle('dark-mode', userPreferences.isDarkMode);
        });

        clearCacheButton.addEventListener('click', clearSavedSettings);

        timezoneSearchInput.addEventListener('input', filterTimezones);

        backToGridButton.addEventListener('click', () => {
            detailView.classList.add('hidden');
            gridView.classList.remove('hidden');
            currentDetailTimezone = null;
            clearInterval(timeUpdateInterval); // Stop interval for detail view
            timeUpdateInterval = setInterval(updateAllCardTimes, 1000); // Resume interval for grid view
            announce("Back to timezones list.");
            // Ensure search input is visible in main view if nav search is closed
            if (!navSearchBar.classList.contains('expanded')) {
                mainControls.prepend(timezoneSearchInput);
            }
            // Re-apply current filter in case favorite state changed
            filterTimezones();
        });

        favoriteDetailButton.addEventListener('click', () => {
            if (currentDetailTimezone) {
                const isAdded = toggleFavorite(currentDetailTimezone);
                favoriteDetailButton.classList.toggle('active', isAdded);
                favoriteDetailButton.querySelector('.button-text').textContent = isAdded ? 'Remove from Favorites' : 'Add to Favorites';
                // No need to update other buttons here, toggleFavorite already calls updateFavoriteButtons
            }
        });

        shareDetailButton.addEventListener('click', async () => {
            if (currentDetailTimezone) {
                const shareUrl = `${window.location.origin}${window.location.pathname}?timezone=${encodeURIComponent(currentDetailTimezone)}`;
                try {
                    if (navigator.share) {
                        await navigator.share({
                            title: `Timezone: ${currentDetailTimezone.replace(/_/g, ' ')}`,
                            url: shareUrl,
                        });
                        showToast("Timezone shared!", "success");
                    } else {
                        await navigator.clipboard.writeText(shareUrl);
                        showToast("Link copied to clipboard!", "success");
                    }
                } catch (error) {
                    console.error('Error sharing/copying:', error);
                    showToast("Failed to share or copy link.", "error");
                }
            }
        });


        // Infinite scrolling and "Go to Top" button logic
        window.addEventListener('scroll', handleScroll);
        goToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            announce("Scrolled to top of the page.");
        });

        // Initial check for sticky nav visibility (in case page loads scrolled)
        handleScroll();


        // Fetch timezones and render initial cards
        await fetchTimezones();
        updateLocalTimezoneCard(); // Ensure local timezone card is updated after fetch
        timeUpdateInterval = setInterval(updateAllCardTimes, 1000); // Start updating times every second

        hidePreloader(); // Hide preloader after everything is loaded
    }

    // --- Preloader Functions ---
    function showPreloader() {
        if (preloader) {
            preloader.classList.remove('hidden');
        }
    }

    function hidePreloader() {
        if (preloader) {
            preloader.classList.add('hidden');
            preloader.addEventListener('transitionend', () => preloader.style.display = 'none', { once: true });
        }
    }

    // Initialize the main script when the DOM is ready
    initialize();
});
