// js/about.js - Logic for the About Your Timezone page

document.addEventListener('DOMContentLoaded', () => {
    console.log("About page DOM fully loaded and parsed.");

    // --- DOM Elements ---
    const localTimezoneName = document.getElementById('local-timezone-name');
    const localDisplayDate = document.getElementById('local-display-date');
    const localDisplayTime = document.getElementById('local-display-time');
    const localDisplayOffset = document.getElementById('local-display-offset');
    const localDstStatus = document.getElementById('local-dst-status');
    // const localTimeDifference = document.querySelector('.local-time-difference'); // Optional element

    // Accordion Elements
    const accordionHeader = document.querySelector('.accordion-header');
    const accordionContent = document.querySelector('.accordion-content');


    // --- Utility Functions (Copied from script.js for this page) ---
    // Note: For a larger app, consider a shared utility file

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
                if (/UTC[+-]\d$/.test(offset)) {
                    offset = offset.replace(/([+-])(\d)$/, '$10$2');
                }
                 if (/UTC[+-]\d{2}$/.test(offset) && !/UTC[+-]\d{2}:\d{2}$/.test(offset)) {
                     offset += ':00';
                 }
                return offset;
            } else {
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
        return 'UTC Offset N/A';
    }

     /**
      * Gets the DST status for a given timezone.
      * @param {string} timezone - The IANA timezone string.
      * @returns {string} - The DST status (e.g., "Observing DST", "Standard Time").
      */
     function getDstStatus(timezone) {
         try {
              const now = new Date();
              const options = {
                  timeZoneName: 'long',
                  timeZone: timezone
              };
              const formatter = new Intl.DateTimeFormat('en-US', options);
              const parts = formatter.formatToParts(now);
              const timeZoneNamePart = parts.find(p => p.type === 'timeZoneName');

              if (timeZoneNamePart) {
                  const name = timeZoneNamePart.value;
                  if (name.toLowerCase().includes('summer') || name.toLowerCase().includes('daylight')) {
                      return 'Observing DST';
                  } else if (name.toLowerCase().includes('standard')) {
                      return 'Standard Time';
                  }
                  return name;
              }
         } catch (error) {
              console.error("Error getting DST status for timezone", timezone, ":", error);
         }
         return 'DST Status N/A';
     }


    // --- State Variables ---
    let userPreferences = { // Minimal preferences needed for formatting
         timeFormat: '12', // Default
         dateLocale: 'en-US', // Default
         isDarkMode: false // Default
    };
     const LOCAL_STORAGE_KEY = 'timezoneExplorerPreferences';


    // --- Functions ---

     /**
      * Loads user preferences from local storage (minimal set).
      */
     function loadPreferences() {
         console.log("About page: Attempting to load preferences from local storage.");
         const savedPreferences = localStorage.getItem(LOCAL_STORAGE_KEY);
         if (savedPreferences) {
             try {
                  const parsedPreferences = JSON.parse(savedPreferences);
                  userPreferences.timeFormat = ['12', '24'].includes(parsedPreferences.timeFormat) ? parsedPreferences.timeFormat : '12';
                  userPreferences.dateLocale = (typeof parsedPreferences.dateLocale === 'string' && parsedPreferences.dateLocale.length >= 2) ? parsedPreferences.dateLocale : 'en-US';
                  userPreferences.isDarkMode = typeof parsedPreferences.isDarkMode === 'boolean' ? parsedPreferences.isDarkMode : false;
                  console.log("About page: Successfully loaded minimal preferences:", userPreferences);
             } catch (e) {
                  console.error("About page: Error parsing saved preferences:", e);
                  userPreferences = { timeFormat: '12', dateLocale: 'en-US', isDarkMode: false }; // Reset to default
                  console.warn("About page: Invalid preferences found, resetting to defaults.");
             }
         } else {
             console.log("About page: No saved preferences found in local storage. Using defaults.");
         }
     }

     /**
      * Applies the current theme preference (dark mode) to the body.
      */
     function applyTheme() {
         console.log("About page: Applying theme. Dark mode enabled:", userPreferences.isDarkMode);
         document.body.classList.remove('dark-mode');
         if (userPreferences.isDarkMode) {
              document.body.classList.add('dark-mode');
         }
          const event = new CustomEvent('themeChange');
          document.dispatchEvent(event);
          console.log("About page: Dispatched 'themeChange' event.");
     }


    /**
     * Displays the details for the user's local timezone.
     */
    function displayLocalTimezoneDetails() {
        try {
            // Get the user's local timezone name
            const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            console.log("About page: User's local timezone:", localTimezone);

            if (localTimezoneName) localTimezoneName.textContent = localTimezone.replace(/_/g, ' ');

            // Get current time and format details
            const now = new Date();
            const { formattedDate, formattedTime } = formatDateTime(now, localTimezone, userPreferences.timeFormat, userPreferences.dateLocale);
            const offset = getUtcOffset(localTimezone);
            const dstStatus = getDstStatus(localTimezone);

            if (localDisplayDate) localDisplayDate.textContent = formattedDate;
            if (localDisplayTime) localDisplayTime.textContent = formattedTime;
            if (localDisplayOffset) localDisplayOffset.textContent = offset;
            if (localDstStatus) localDstStatus.textContent = dstStatus;

            // Optional: Display time difference to UTC
            // The getTimeDifference function from script.js is not included here,
            // but you could add it if you want to show the difference to UTC/GMT.
            // For now, this element remains hidden.

        } catch (error) {
            console.error("About page: Error displaying local timezone details:", error);
             if (localTimezoneName) localTimezoneName.textContent = 'Could not determine timezone.';
             if (localDisplayDate) localDisplayDate.textContent = 'N/A';
             if (localDisplayTime) localDisplayTime.textContent = 'N/A';
             if (localDisplayOffset) localDisplayOffset.textContent = 'N/A';
             if (localDstStatus) localDstStatus.textContent = 'N/A';
        }
    }

     /**
      * Updates the displayed local time every second.
      */
     function updateLocalTime() {
         const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const now = new Date();
          const { formattedDate, formattedTime } = formatDateTime(now, localTimezone, userPreferences.timeFormat, userPreferences.dateLocale);
          // Only update time and date elements
         if (localDisplayDate) localDisplayDate.textContent = formattedDate;
         if (localDisplayTime) localDisplayTime.textContent = formattedTime;
         // Offset and DST are static and only need to be set once
     }

     /**
      * Sets up the accordion functionality.
      */
     function setupAccordion() {
         if (accordionHeader && accordionContent) {
             accordionHeader.addEventListener('click', () => {
                 const isExpanded = accordionHeader.getAttribute('aria-expanded') === 'true';
                 accordionHeader.setAttribute('aria-expanded', !isExpanded);
                 accordionContent.setAttribute('aria-hidden', isExpanded);
                 accordionContent.classList.toggle('expanded');
             });
              console.log("About page: Accordion listener attached.");
         } else {
              console.warn("About page: Accordion elements not found.");
         }
     }


    // --- Initialization ---

    function initializeAboutPage() {
        console.log("About page initializing.");
         loadPreferences(); // Load dark mode preference
         applyTheme(); // Apply dark mode if enabled

        displayLocalTimezoneDetails(); // Display initial details

         // Update the displayed time every second
         setInterval(updateLocalTime, 1000);

         setupAccordion(); // Set up the accordion

        // Note: Settings modal event listeners and logic are handled by script.js
        // because the modal HTML is included in this page.
         console.log("About page initialization complete.");
    }

    // Initialize the about page script
    initializeAboutPage();
});
