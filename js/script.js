// js/script.js

document.addEventListener('DOMContentLoaded', () => {
    const timezonesGrid = document.getElementById('timezones-grid');
    const timezoneSearchInput = document.getElementById('timezone-search');
    const loadingMessage = document.querySelector('.loading-message');
    const loadingMoreIndicator = document.querySelector('.loading-more');
    const endOfListIndicator = document.querySelector('.end-of-list');

    const modal = document.getElementById('timezone-modal');
    const closeButton = document.querySelector('.close-button');
    const modalTimezoneName = document.getElementById('modal-timezone-name');
    const modalDisplayDate = document.getElementById('modal-display-date');
    const modalDisplayTime = document.getElementById('modal-display-time');
    const modalDisplayOffset = document.getElementById('modal-display-offset');
    const modalDstStatus = document.getElementById('modal-dst-status');
    // Add elements for other detailed info if you add a data source

    let allTimezones = []; // Array to store all timezone identifiers
    let filteredTimezones = []; // Timezones matching the current search
    const itemsPerPage = 50; // Number of timezones to load per batch
    let currentPage = 0;
    let isLoading = false;
    let timeUpdateInterval = null; // To store the interval ID for time updates

    // --- Utility Functions ---

    // Function to format date and time for a given timezone
    function formatTimezoneDateTime(timezone) {
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
        const standardOffset = new Date(2023, 0, 1).toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);
        const currentOffset = new Date().toLocaleTimeString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' }).match(/[+-]\d{1,2}(:\d{2})?/);
        const dstStatus = (standardOffset && currentOffset && standardOffset[0] !== currentOffset[0]) ? 'Observing DST' : 'Not Observing DST';


        return {
            date: formattedDate,
            time: formattedTime,
            offset: utcOffset,
            dstStatus: dstStatus
        };
    }

    // Function to create a timezone card element
    function createTimezoneCard(timezone) {
        const card = document.createElement('div');
        card.classList.add('timezone-card');
        card.dataset.timezone = timezone; // Store timezone identifier

        const { date, time, offset } = formatTimezoneDateTime(timezone);

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

        // Update modal time if it's open
        if (!modal.classList.contains('hidden')) {
             const modalTimezone = modalTimezoneName.textContent; // Get timezone from modal title
             if (modalTimezone) {
                 const { date, time, offset, dstStatus } = formatTimezoneDateTime(modalTimezone);
                 modalDisplayDate.textContent = date;
                 modalDisplayTime.textContent = time;
                 modalDisplayOffset.textContent = offset;
                 modalDstStatus.textContent = dstStatus;
             }
        }
    }

    // Function to load and display the next batch of timezones
    function loadMoreTimezones() {
        if (isLoading) return; // Prevent multiple loads

        isLoading = true;
        loadingMoreIndicator.classList.remove('hidden');
        endOfListIndicator.classList.add('hidden'); // Hide end of list message

        const startIndex = currentPage * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const batch = filteredTimezones.slice(startIndex, endIndex);

        if (batch.length === 0) {
            loadingMoreIndicator.classList.add('hidden');
             if (currentPage > 0) { // Only show end of list if some items were loaded
                endOfListIndicator.classList.remove('hidden');
             }
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

    // --- Event Handlers ---

    // Handle search input
    timezoneSearchInput.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase();
        currentPage = 0; // Reset pagination
        timezonesGrid.innerHTML = ''; // Clear current grid

        if (searchTerm.length > 0) {
             loadingMessage.classList.add('hidden'); // Hide initial loading message
             filteredTimezones = allTimezones.filter(tz =>
                tz.toLowerCase().includes(searchTerm)
            );
        } else {
            // If search is cleared, reset to show initial batch of all timezones
            loadingMessage.classList.add('hidden'); // Hide initial loading message
            filteredTimezones = [...allTimezones]; // Copy all timezones
        }

        loadMoreTimezones(); // Load the first batch of filtered results
    });

    // Handle infinite scrolling
    window.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

        // Check if user is near the bottom of the page (e.g., within 200px)
        if (scrollTop + clientHeight >= scrollHeight - 200 && !isLoading) {
            loadMoreTimezones();
        }
    });

    // Handle timezone card click to open modal (using event delegation)
    timezonesGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.timezone-card');
        if (card) {
            const timezone = card.dataset.timezone;
            if (timezone) {
                const { date, time, offset, dstStatus } = formatTimezoneDateTime(timezone);
                modalTimezoneName.textContent = timezone;
                modalDisplayDate.textContent = date;
                modalDisplayTime.textContent = time;
                modalDisplayOffset.textContent = offset;
                modalDstStatus.textContent = dstStatus;
                // Populate other modal details here if you have a data source

                modal.classList.remove('hidden'); // Show the modal
            }
        }
    });

    // Handle modal close button click
    closeButton.addEventListener('click', () => {
        modal.classList.add('hidden'); // Hide the modal
    });

    // Handle clicking outside the modal content to close
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden'); // Hide the modal
        }
    });


    // --- Initialization ---

    // Load all timezones initially
    function initialize() {
         if (Intl.supportedValuesOf) {
            allTimezones = Intl.supportedValuesOf('timeZone').sort();
            filteredTimezones = [...allTimezones]; // Initially filtered list is all timezones
            loadingMessage.classList.add('hidden'); // Hide loading message once timezones are loaded
            loadMoreTimezones(); // Load the first batch
            // Start updating times for visible cards
            timeUpdateInterval = setInterval(updateVisibleCardTimes, 1000);
        } else {
            loadingMessage.textContent = "Browser does not support timezone listing.";
            console.error("Intl.supportedValuesOf is not supported in this browser.");
        }
    }

    initialize(); // Start the application
});
