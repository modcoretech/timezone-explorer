// js/script.js

document.addEventListener('DOMContentLoaded', () => {
    const timezoneSelect = document.getElementById('timezone-select');
    const resultDiv = document.getElementById('result');
    const displayTimezone = document.getElementById('display-timezone');
    const displayDate = document.getElementById('display-date'); // Get date element
    const displayTime = document.getElementById('display-time');
    const displayOffset = document.getElementById('display-offset');

    // Populate the timezone dropdown with all supported timezones
    function populateTimezones() {
        // Use Intl.supportedValuesOf for a comprehensive list
        if (Intl.supportedValuesOf) {
            const timezones = Intl.supportedValuesOf('timeZone').sort();
            timezones.forEach(tz => {
                const option = document.createElement('option');
                option.value = tz;
                option.textContent = tz;
                timezoneSelect.appendChild(option);
            });
        } else {
            // Fallback or message if Intl.supportedValuesOf is not available
            console.error("Intl.supportedValuesOf is not supported in this browser.");
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Browser does not support timezone listing.";
            timezoneSelect.appendChild(option);
        }
    }

    // Get and display time and info for the selected timezone
    function updateTimeAndInfo() {
        const selectedTimezone = timezoneSelect.value;

        if (selectedTimezone) {
            try {
                const now = new Date();

                // Options for formatting date and time
                const dateOptions = {
                    timeZone: selectedTimezone,
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long' // Added weekday
                };
                const timeOptions = {
                    timeZone: selectedTimezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true // Use 12-hour format with AM/PM
                };

                const formattedDate = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
                const formattedTime = new Intl.DateTimeFormat('en-US', timeOptions).format(now);

                // Attempt to get UTC offset using Intl.DateTimeFormat with shortOffset
                // This is a more reliable way to get the offset string
                const offsetOptions = {
                     timeZone: selectedTimezone,
                     timeZoneName: 'shortOffset' // Request short offset name (+HH:MM or -HH:MM)
                };
                 // Format a dummy date to get the timezone name/offset
                const dummyDateString = new Intl.DateTimeFormat('en-US', offsetOptions).format(now);
                // The format might vary, so we'll try to extract the offset part
                // This is still a bit heuristic, a dedicated library is best for robust offset handling
                const offsetMatch = dummyDateString.match(/[+-]\d{1,2}(:\d{2})?/);
                const utcOffset = offsetMatch ? offsetMatch[0] : 'N/A';


                // Display the results
                displayTimezone.textContent = selectedTimezone;
                displayDate.textContent = formattedDate; // Display formatted date
                displayTime.textContent = formattedTime;
                displayOffset.textContent = utcOffset;
                resultDiv.classList.remove('hidden'); // Show the result div

            } catch (error) {
                console.error("Error getting time for timezone:", error);
                displayTimezone.textContent = selectedTimezone;
                displayDate.textContent = "Could not retrieve date.";
                displayTime.textContent = "Could not retrieve time.";
                displayOffset.textContent = "Could not retrieve offset.";
                resultDiv.classList.remove('hidden');
            }
        } else {
            // Hide result if no timezone is selected
            resultDiv.classList.add('hidden');
        }
    }

    // Event listener for dropdown change
    timezoneSelect.addEventListener('change', updateTimeAndInfo);

    // Populate timezones when the page loads
    populateTimezones();

    // Automatically update time every second for the selected timezone
    setInterval(() => {
        if (timezoneSelect.value) {
            updateTimeAndInfo();
        }
    }, 1000);
});
