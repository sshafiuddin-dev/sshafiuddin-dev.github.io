// Uses Airtable public share API - no token required
const BASE_ID = 'apppnlkUDC74nnF8j';
const Table_ID = 'tblPvoFGa91OYe8hZ';
const API_URL = `https://api.airtable.com/v0/${BASE_ID}/${Table_ID}`;

async function fetchPrayerTimings() {
    try {
        const response = await fetch(API_URL + '?view=shraf5aC67wCiflgM');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        displayTimings(data.records);
        displayCurrentDate();
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

function displayCurrentDate() {
    const today = new Date();
    document.getElementById('currentDate').textContent =
        today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(isoString) {
    return new Date(isoString).toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
}

function displayTimings(records) {
    const timingsTableBody = document.querySelector('#timings tbody');
    const todayTimingsTableBody = document.querySelector('#today-timings tbody');
    timingsTableBody.innerHTML = '';
    todayTimingsTableBody.innerHTML = '';

    if (!records || records.length === 0) {
        timingsTableBody.innerHTML = '<tr><td colspan="10">No prayer timings found.</td></tr>';
        return;
    }

    const today = new Date();
    const todayString = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const currentMonthRecords = records
        .filter(r => {
            const d = new Date(r.fields.Date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .sort((a, b) => new Date(a.fields.Date) - new Date(b.fields.Date));

    let todaysTimings = {};

    currentMonthRecords.forEach(record => {
        const f = record.fields;
        const recordDate = new Date(f.Date);
        const isToday = recordDate.toISOString().split('T')[0] === todayString;
        const isFriday = new Date(f.Date).getUTCDay() === 5;

        if (isToday) {
            todaysTimings = {
                Fajr:    f.Fajr    ? formatTime(f.Fajr)    : 'N/A',
                Dhuhr:   f.Dhuhr   ? formatTime(f.Dhuhr)   : 'N/A',
                Asr:     f.Asr     ? formatTime(f.Asr)     : 'N/A',
                Maghrib: 'On-Time' + (f.Sunset ? ' (' + formatTime(f.Sunset) + ')' : ''),
                Isha:    f.Isha    ? formatTime(f.Isha)    : 'N/A',
            };
        }

        timingsTableBody.innerHTML += `
            <tr style="font-weight:${isToday ? 'bold' : 'normal'}">
                <td>${f.Date || 'N/A'}</td>
                <td>${f.Fajr    ? formatTime(f.Fajr)    : 'N/A'}</td>
                <td>${f.Dhuhr   ? formatTime(f.Dhuhr)   : 'N/A'}</td>
                <td>${f.Asr     ? formatTime(f.Asr)     : 'N/A'}</td>
                <td>On-Time${f.Sunset ? ' (' + formatTime(f.Sunset) + ')' : ''}</td>
                <td>${f.Isha    ? formatTime(f.Isha)    : 'N/A'}</td>
                ${isFriday
                    ? `<td>${f['Jummah - 1'] ? formatTime(f['Jummah - 1']) : 'N/A'}</td>
                       <td>${f['Jummah - 2'] ? formatTime(f['Jummah - 2']) : 'N/A'}</td>
                       <td>${f['Jummah - 3'] ? formatTime(f['Jummah - 3']) : 'N/A'}</td>
                       <td>${f['Jummah - 4'] ? formatTime(f['Jummah - 4']) : 'N/A'}</td>`
                    : '<td colspan="4">N/A</td>'}
            </tr>`;
    });

    todayTimingsTableBody.innerHTML = Object.keys(todaysTimings).length > 0
        ? `<tr>
                <td>${todaysTimings.Fajr}</td>
                <td>${todaysTimings.Dhuhr}</td>
                <td>${todaysTimings.Asr}</td>
                <td>${todaysTimings.Maghrib}</td>
                <td>${todaysTimings.Isha}</td>
           </tr>`
        : '<tr><td colspan="5">No timings available for today.</td></tr>';
}

fetchPrayerTimings();
