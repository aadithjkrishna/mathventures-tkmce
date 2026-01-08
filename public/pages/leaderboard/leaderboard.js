const sheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQue37xH7CikShbObAl6gblXFp8gLUlQ0IgIPEerF0RMJtMpNoDoYrzcPUfKaRjOySfeLLhpEKxu5xH/pub?output=csv";

function init() {
    Papa.parse(sheetURL, {
        download: true,
        header: true,
        complete: function (results) {
            let data = results.data;

            // Filter out empty rows
            data = data.filter(row => row.Name && row["Total Score"]);

            // Sort by Total Score (Highest to Lowest)
            data.sort((a, b) => parseInt(b["Total Score"]) - parseInt(a["Total Score"]));

            // 1. Update Podium
            updatePodium(data);

            // 2. Render List
            renderLeaderboard(data);
        },
        error: function (err) {
            console.error("Error:", err);
        }
    });
}

function updatePodium(data) {
    // Helper to safely get data or show placeholders
    const getSafe = (index, field) => (data[index] && data[index][field]) ? data[index][field] : '-';

    // 1st Place (Index 0)
    document.getElementById('podium-1-name').innerText = getSafe(0, 'Name');
    document.getElementById('podium-1-score').innerText = getSafe(0, 'Total Score');

    // 2nd Place (Index 1)
    document.getElementById('podium-2-name').innerText = getSafe(1, 'Name');
    document.getElementById('podium-2-score').innerText = getSafe(1, 'Total Score');

    // 3rd Place (Index 2)
    document.getElementById('podium-3-name').innerText = getSafe(2, 'Name');
    document.getElementById('podium-3-score').innerText = getSafe(2, 'Total Score');
}

function renderLeaderboard(data) {
    const container = document.getElementById('leaderboard-body');
    container.innerHTML = '';

    // Optional: Start table loop from index 3 if you don't want top 3 repeated in the list
    // For now, we show everyone in the list too.
    data.forEach((player, index) => {
        const rank = index + 1;
        let rankClass = '';

        if (rank === 1) rankClass = 'gold';
        else if (rank === 2) rankClass = 'silver';
        else if (rank === 3) rankClass = 'bronze';

        const item = document.createElement('div');
        item.className = 'leaderboard-item';

        item.innerHTML = `
          <div class="rank ${rankClass}">${rank}</div>
          <div class="username">${player.Name}</div>
          <div class="score ${rankClass}">${player["Total Score"]}</div>
        `;
        container.appendChild(item);
    });
}

init();
setInterval(init, 500);