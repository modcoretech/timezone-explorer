// js/script.js

document.addEventListener('DOMContentLoaded', () => {
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

    let allTimezones = []; // Array to store all timezone identifiers
    let filteredTimezones = []; // Timezones matching the current search
    const itemsPerPage = 60; // Increased items per page for a denser grid
    let currentPage = 0;
    let isLoading = false;
    let timeUpdateInterval = null; // To store the interval ID for time updates

    // --- Utility Functions ---

    // Function to format date and time for a given timezone
    function formatTimezoneDateTime(timezone) {
        try {
            const now = new Date();
            const dateOptions = {
                timeZone: timezone,
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            };
            const timeOptions = {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            };
            const offsetOptions = {
                timeZone: timezone,
                timeZoneName: 'shortOffset'
            };

            const formattedDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
            const formattedTime = new Intl.DateTimeFormat('en-US', timeOptions).format(now);

            // Attempt to get UTC offset string
            const dummyDateString = new Intl.DateTimeFormat('en-US', offsetOptions).format(now);
            const offsetMatch = dummyDateString.match(/[+-]\d{1,2}(:\d{2})?/);
            const utcOffset = offsetMatch ? offsetMatch[0] : 'N/A';

            // Determine DST status (basic check - might not be accurate for all timezones without more data)
            // Compare offset at a fixed date (Jan 1st) vs now. This is a heuristic.
            const jan1st = new Date(now.getFullYear(), 0, 1);
            const july1st = new Date(now.getFullYear(), 6, 1); // Check July 1st too for southern hemisphere
            const janOffset = jan1st.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);
            const julyOffset = july1st.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);
            const currentOffsetMatch = now.toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);

            let dstStatus = 'Unknown';
            if (janOffset && julyOffset && currentOffsetMatch) {
                 if (janOffset[0] !== julyOffset[0]) { // If offset changes between Jan and July
                     if (currentOffsetMatch[0] === janOffset[0]) {
                         dstStatus = 'Not Observing DST';
                     } else if (currentOffsetMatch[0] === julyOffset[0]) {
                         dstStatus = 'Observing DST';
                     } else {
                         dstStatus = 'Offset varies'; // Should not happen with standard timezones
                     }
                 } else {
                     dstStatus = 'Does not observe DST'; // Offset is the same year-round
                 }
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

    // Function to create a timezone card element for the grid
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

    // Function to update the time and info for a single card
    function updateCardTime(card) {
         const timezone = card.dataset.timezone;
         if (timezone) {
             const { date, time, offset } = formatTimezoneDateTime(timezone);
             card.querySelector('.display-date').textContent = date;
             card.querySelector('.display-time').textContent = time;
             card.querySelector('.display-offset').textContent = offset;
         }
    }

    // Function to update the time for all visible cards
    function updateVisibleCardTimes() {
        const cards = timezonesGrid.querySelectorAll('.timezone-card');
        cards.forEach(card => updateCardTime(card));

        // Update detail view time if it's active
        if (!detailView.classList.contains('hidden')) {
             const detailTimezone = detailTimezoneName.textContent; // Get timezone from detail title
             if (detailTimezone && detailTimezone !== 'Loading...') {
                 const { date, time, offset, dstStatus } = formatTimezoneDateTime(detailTimezone);
                 detailDisplayDate.textContent = date;
                 detailDisplayTime.textContent = time;
                 detailDisplayOffset.textContent = offset;
                 detailDstStatus.textContent = dstStatus;
             }
        }
    }

    // Function to load and display the next batch of timezones
    function loadMoreTimezones() {
        if (isLoading) return; // Prevent multiple loads
        if (currentPage * itemsPerPage >= filteredTimezones.length && filteredTimezones.length > 0) {
             // Already loaded all filtered timezones
             endOfListIndicator.classList.remove('hidden');
             loadingMoreIndicator.classList.add('hidden');
             return;
        }


        isLoading = true;
        loadingMoreIndicator.classList.remove('hidden');
        endOfListIndicator.classList.add('hidden'); // Hide end of list message

        const startIndex = currentPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const batch = filteredTimezones.slice(startIndex, endIndex);

        if (batch.length === 0 && currentPage === 0) {
             // No timezones found for the search term
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

    // Function to show the grid view and hide the detail view
    function showGridView() {
        gridView.classList.remove('hidden');
        detailView.classList.add('hidden');
        // Restart time updates for grid cards
        if (timeUpdateInterval) clearInterval(timeUpdateInterval);
        timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000);
         // Re-enable scroll listener for infinite scrolling
        window.addEventListener('scroll', handleScroll);
    }

    // Function to show the detail view and hide the grid view
    function showDetailView(timezone) {
        gridView.classList.add('hidden');
        detailView.classList.remove('hidden');
        // Clear grid content to free up memory
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
        }

         // Start time updates specifically for the detail view
         if (timeUpdateInterval) clearInterval(timeUpdateInterval);
         timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000); // updateVisibleCardTimes also updates the modal/detail view
    }

    // --- Event Handlers ---

    // Handle search input
    timezoneSearchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
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
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

        // Check if user is near the bottom of the page (e.g., within 300px)
        if (scrollTop + clientHeight >= scrollHeight - 300 && !isLoading) {
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
                // Navigate to the detail page URL
                window.location.href = `index.html?timezone=${encodeURIComponent(timezone)}`;
            }
        }
    });

    // --- Initialization ---

    // Load all timezones initially and check URL for detail view
    function initialize() {
         if (Intl.supportedValuesOf) {
            allTimezones = Intl.supportedValuesOf('timeZone').sort();

            // Check if a specific timezone is requested in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const requestedTimezone = urlParams.get('timezone');

            if (requestedTimezone && allTimezones.includes(requestedTimezone)) {
                showDetailView(requestedTimezone);
            } else {
                // Default to grid view
                filteredTimezones = [...allTimezones]; // Initially filtered list is all timezones
                loadingMessage.classList.add('hidden'); // Hide initial loading message
                showGridView(); // Show the grid view
                loadMoreTimezones(); // Load the first batch for the grid
            }

            // Start the overall time update interval (handles both grid and detail view)
             if (timeUpdateInterval) clearInterval(timeUpdateInterval);
             timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000);


        } else {
            loadingMessage.textContent = "Browser does not support timezone listing.";
            console.error("Intl.supportedValuesOf is not supported in this browser.");
             gridView.classList.remove('hidden'); // Ensure grid view is visible to show the message
             detailView.classList.add('hidden');
        }
    }

    initialize(); // Start the application
});
