// Global stats update
async function updateGlobalStats() {
    try {
        const response = await fetch('http://localhost:3000/api/stats/global');
        const stats = await response.json();

        document.querySelector('#globalStats').innerHTML = `
            <div class="stat">
                <h3>${stats.totalMergedPRs}</h3>
                <p>Total Merged PRs</p>
            </div>
            <div class="stat">
                <h3>${stats.activeUsers}</h3>
                <p>Active Users</p>
            </div>
            <div class="stat">
                <h3>${stats.registeredRepos}</h3>
                <p>Registered Repos</p>
            </div>
        `;
    } catch (error) {
        console.error('Error updating global stats:', error);
    }
}

// Sort users based on points and merge timestamps
function sortUsersByPointsAndMerges(users) {
    return users.sort((a, b) => {
        // First sort by points
        if (b.points !== a.points) {
            return b.points - a.points;
        }

        // If points are equal, sort by most recent merge
        const latestMergeA = a.mergedPRs.length > 0 ?
            Math.max(...a.mergedPRs.map(pr => new Date(pr.mergedAt).getTime())) : 0;
        const latestMergeB = b.mergedPRs.length > 0 ?
            Math.max(...b.mergedPRs.map(pr => new Date(pr.mergedAt).getTime())) : 0;

        return latestMergeB - latestMergeA;
    });
}

// Add searchLeaderboard function
function searchLeaderboard(searchTerm, users) {
    if (!searchTerm) return users;

    return users.filter(user => {
        const searchString = searchTerm.toLowerCase();
        // Search by username
        if (user.username.toLowerCase().includes(searchString)) return true;

        // Search by points
        if (user.points.toString().includes(searchString)) return true;

        // Search by PRs
        if (user.mergedPRs.some(pr =>
            pr.title.toLowerCase().includes(searchString)
        )) return true;

        return false;
    });
}

// Leaderboard update function
async function updateLeaderboard(timeRange = 'all', filterBy = 'points') {
    try {
        const response = await fetch('http://localhost:3000/api/leaderboard', {
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const users = await response.json();

        // Debug logging
        console.log('Fetched users:', users);

        if (!users || users.length === 0) {
            document.getElementById('leaderboardList').innerHTML = `
                <div class="no-data">No users found</div>
            `;
            document.getElementById('topWinners').innerHTML = `
                <div class="no-data">No winners yet</div>
            `;
            return;
        }

        // Update top 3 winners
        const winnersHtml = renderTopWinners(users.slice(0, 3));
        document.getElementById('topWinners').innerHTML = winnersHtml;

        // Update remaining leaderboard
        const leaderboardHtml = renderLeaderboardList(users.slice(3));
        document.getElementById('leaderboardList').innerHTML = leaderboardHtml;

        // Store users globally for search
        window.leaderboardUsers = users;

        // Update DOM with initial data
        updateLeaderboardDisplay(users);
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        handleLeaderboardError(error);
    }
}

// Add function to update leaderboard display
function updateLeaderboardDisplay(users) {
    const winners = users.slice(0, 3);
    const remainingUsers = users.slice(3);

    document.getElementById('topWinners').innerHTML = renderTopWinners(winners);
    document.getElementById('leaderboardList').innerHTML = renderLeaderboardList(remainingUsers);
}

function renderTopWinners(winners) {
    if (winners.length === 0) return '';

    const positions = ['second', 'first', 'third'];
    const [first, second, third] = winners;

    return `
        ${second ? renderWinnerCard(second, 'second', 2) : ''}
        ${renderWinnerCard(first, 'first', 1)}
        ${third ? renderWinnerCard(third, 'third', 3) : ''}
    `;
}

function renderWinnerCard(user, position, rank) {
    return `
        <div class="winner-card ${position}" data-user="${user.username}">
            <div class="winner-medal">${rank}</div>
            <img src="https://github.com/${user.username}.png" 
                 alt="${user.username}" 
                 class="winner-img"
                 onerror="this.src='assets/img/default-avatar.png'">
            <h3>${user.username}</h3>
            <div class="stats">
                <div class="points">
                    <i class='bx bx-trophy'></i>
                    <span>${user.points} points</span>
                    ${renderTrendIndicator(user.trend)}
                </div>
                <div class="merges">
                    <i class='bx bx-git-merge'></i>
                    <span>${user.mergedPRs.length} merges</span>
                </div>
            </div>
            <div class="badges">
                ${user.badges.map(badge => `<span class="badge">${badge}</span>`).join('')}
            </div>
        </div>
    `;
}

function renderLeaderboardList(users) {
    if (users.length === 0) return '<div class="no-data">No more users to display</div>';

    return users.map((user, index) => `
        <div class="leaderboard-item" data-user="${user.username}">
            <span class="rank">${user.rank || index + 4}</span>
            <img src="https://github.com/${user.username}.png" 
                 alt="${user.username}" 
                 class="user-img"
                 onerror="this.src='assets/img/default-avatar.png'">
            <div class="user-info">
                <h4>${user.username}</h4>
                <div class="stats">
                    <div class="points">
                        <i class='bx bx-trophy'></i>
                        <span>${user.points} points</span>
                        ${renderTrendIndicator(user.trend)}
                    </div>
                    <div class="merges">
                        <i class='bx bx-git-merge'></i>
                        <span>${user.mergedPRs.length} merges</span>
                    </div>
                </div>
                <div class="badges">
                    ${user.badges.map(badge => `<span class="badge">${badge}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

function handleLeaderboardError(error) {
    const errorHtml = `
        <div class="error-message">
            <i class='bx bx-error-circle'></i>
            <p>Failed to load leaderboard</p>
            <small>${error.message}</small>
            <button onclick="updateLeaderboard()" class="retry-button">
                <i class='bx bx-refresh'></i> Retry
            </button>
        </div>
    `;

    document.getElementById('leaderboardList').innerHTML = errorHtml;
    document.getElementById('topWinners').innerHTML = '';
}

function renderTrendIndicator(trend) {
    if (trend === 0) return '';
    const isPositive = trend > 0;
    return `
        <span class="trend ${isPositive ? 'up' : 'down'}">
            <i class='bx bx-${isPositive ? 'up' : 'down'}-arrow-alt'></i>
            ${Math.abs(trend)}%
        </span>
    `;
}

// Add function to toggle merge list visibility
function toggleMerges(id) {
    const mergeList = document.getElementById(id);
    const button = mergeList.previousElementSibling;
    const icon = button.querySelector('i');

    mergeList.classList.toggle('hidden');
    if (mergeList.classList.contains('hidden')) {
        icon.classList.replace('bx-chevron-up', 'bx-chevron-down');
    } else {
        icon.classList.replace('bx-chevron-down', 'bx-chevron-up');
    }
}

// Initialize leaderboard
document.addEventListener('DOMContentLoaded', () => {
    // Initial updates
    updateGlobalStats();
    updateLeaderboard();

    // Add filter event listeners
    const filterBtns = document.querySelectorAll('.filter-btn');
    const timeRange = document.getElementById('timeRange');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateLeaderboard(timeRange.value, btn.dataset.filter);
        });
    });

    timeRange.addEventListener('change', () => {
        const activeFilter = document.querySelector('.filter-btn.active');
        updateLeaderboard(timeRange.value, activeFilter.dataset.filter);
    });

    // Add search functionality
    const searchInput = document.getElementById('leaderboardSearch');
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = e.target.value;
            const filteredUsers = searchLeaderboard(searchTerm, window.leaderboardUsers || []);
            updateLeaderboardDisplay(filteredUsers);
        }, 300);
    });

    // Auto-update every 5 minutes
    setInterval(() => {
        updateGlobalStats();
        updateLeaderboard(
            timeRange.value,
            document.querySelector('.filter-btn.active').dataset.filter
        );
    }, 5 * 60 * 1000);
});
