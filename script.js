// Replace with your Airtable base ID and personal access token
const BASE_ID = 'apppnlkUDC74nnF8j';
const Table_ID = 'tblPvoFGa91OYe8hZ';
const PERSONAL_ACCESS_TOKEN = 'patmJx1S3vfOqy1dp.3ca1b9eb1f6ed4c1a1f2e4fae1fa1cecef5a8bad133a6cb33d760bcf705dcda7';
const API_URL = `https://api.airtable.com/v0/${BASE_ID}/${Table_ID}`;

// // Replace with your Airtable base ID and personal access token
// const BASE_ID = 'Your Base ID'; // e.g., 'appXXXXXXXXXXXXXX'
// const TABLE_ID = 'Your Table ID'; // e.g., 'Table 1'
// const PERSONAL_ACCESS_TOKEN = 'Your Access Token'; // e.g., 'keyXXXXXXXXXXXXXX'
// const API_URL = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;

async function fetchPrayerTimings() {
    try {
        const response = await fetch(API_URL, {
            headers: {
                Authorization: `Bearer ${PERSONAL_ACCESS_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        displayTimings(data.records);
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

function formatTime(isoString) {
    const date = new Date(isoString);
    const options = { hour: 'numeric', minute: 'numeric', hour12: true };
    return date.toLocaleString('en-US', options);
}

function displayTimings(records) {
    const timingsTableBody = document.querySelector('#timings tbody');
    const todayTimingsTableBody = document.querySelector('#today-timings tbody');
    timingsTableBody.innerHTML = ''; // Clear previous content
    todayTimingsTableBody.innerHTML = ''; // Clear today's timings

    if (records.length === 0) {
        timingsTableBody.innerHTML = '<tr><td colspan="10">No prayer timings found.</td></tr>';
        return;
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]; // e.g., '2024-09-26'

    // Sort records by Date
    records.sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));

    let todaysTimings = {};

    records.forEach(record => {
        const fields = record.fields;
        const isToday = fields.Date === todayString; // Check if the date is today

        // Populate today's timings
        if (isToday) {
            todaysTimings = {
                Fajr: fields.Fajr ? formatTime(fields.Fajr) : 'N/A',
                Dhuhr: fields.Dhuhr ? formatTime(fields.Dhuhr) : 'N/A',
                Asr: fields.Asr ? formatTime(fields.Asr) : 'N/A',
                Maghrib: 'On-Time' + (fields.Sunset ? ' (' + formatTime(fields.Sunset) + ')' : ''),
                Isha: fields.Isha ? formatTime(fields.Isha) : 'N/A',
            };
        }

        // Check if the date is a Friday
        const date = new Date(fields.Date);
        const isFriday = date.getDay() === 5; // 5 corresponds to Friday

        // Add the record to the main table
        const timingRow = `
            <tr style="font-weight: ${isToday ? 'bold' : 'normal'};">
                <td>${fields.Date || 'N/A'}</td>
                <td>${fields.Fajr ? formatTime(fields.Fajr) : 'N/A'}</td>
                <td>${fields.Dhuhr ? formatTime(fields.Dhuhr) : 'N/A'}</td>
                <td>${fields.Asr ? formatTime(fields.Asr) : 'N/A'}</td>
                <td>On-Time${fields.Sunset ? ' (' + formatTime(fields.Sunset) + ')' : ''}</td>
                <td>${fields.Isha ? formatTime(fields.Isha) : 'N/A'}</td>
                ${isFriday ? `
                    <td>${fields['Jummah - 1'] ? formatTime(fields['Jummah - 1']) : 'N/A'}</td>
                    <td>${fields['Jummah - 2'] ? formatTime(fields['Jummah - 2']) : 'N/A'}</td>
                    <td>${fields['Jummah - 3'] ? formatTime(fields['Jummah - 3']) : 'N/A'}</td>
                    <td>${fields['Jummah - 4'] ? formatTime(fields['Jummah - 4']) : 'N/A'}</td>
                ` : `
                    <td colspan="4">N/A</td>
                `}
            </tr>
        `;
        timingsTableBody.innerHTML += timingRow;
    });

    // Populate today's timings table
    if (todaysTimings.Fajr) {
        todayTimingsTableBody.innerHTML = `
            <tr>
                <td>${todaysTimings.Fajr}</td>
                <td>${todaysTimings.Dhuhr}</td>
                <td>${todaysTimings.Asr}</td>
                <td>${todaysTimings.Maghrib}</td>
                <td>${todaysTimings.Isha}</td>
            </tr>
        `;
    } else {
        todayTimingsTableBody.innerHTML = '<tr><td colspan="5">No timings available for today.</td></tr>';
    }
}


// Fetch prayer timings when the page loads
fetchPrayerTimings();

