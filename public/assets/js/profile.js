async function fetchUserProfile() {
    try {
        const response = await fetch('http://localhost:3000/api/user', {
            credentials: 'include'
        });
        const data = await response.json();

        if (!data.isAuthenticated) {
            window.location.href = 'login.html';
            return;
        }

        // Fetch comprehensive profile data
        const profileResponse = await fetch(`http://localhost:3000/api/user/profile/${data.user.username}`, {
            credentials: 'include'
        });
        const profileData = await profileResponse.json();

        // Update profile information
        updateProfileInfo(profileData);
        updateProfileStats(profileData);
        displayPullRequests(profileData.pullRequests);

    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

function updateProfileInfo(data) {
    document.getElementById('profile-img').src = data.avatar_url;
    document.getElementById('profile-name').textContent = data.name || data.login;
    document.getElementById('profile-bio').textContent = data.bio || '';
    document.getElementById('profile-location').textContent = data.location || 'Not specified';
    document.getElementById('profile-company').textContent = data.company || 'Not specified';
    document.getElementById('profile-blog').href = data.blog;
    document.getElementById('profile-blog').textContent = data.blog || 'Not specified';
    document.getElementById('profile-twitter').textContent = data.twitter_username || 'Not specified';
}

function updateProfileStats(data) {
    updateStatWithAnimation('repos', data.public_repos);
    updateStatWithAnimation('followers', data.followers);
    updateStatWithAnimation('following', data.following);
    updateStatWithAnimation('gists', data.public_gists);
}

function displayActivities(activities) {
    const container = document.querySelector('.activities-grid');
    container.innerHTML = '';

    // Display push events
    if (activities.pushEvents.length > 0) {
        const pushSection = createActivitySection('Recent Pushes', activities.pushEvents, (event) => `
            <div class="activity-card push-card">
                <div class="activity-card__header">
                    <i class='bx bx-git-commit activity-card__icon'></i>
                    <span class="activity-card__date">${formatDate(event.createdAt)}</span>
                </div>
                <h4 class="activity-card__title">${event.repo}</h4>
                <div class="activity-card__commits">
                    ${event.commits?.map(commit => `
                        <p class="commit-message">
                            <i class='bx bx-code-commit'></i>
                            ${commit.message}
                        </p>
                    `).join('') || ''}
                </div>
            </div>
        `);
        container.appendChild(pushSection);
    }

    // Display pull requests
    if (activities.pullRequests.length > 0) {
        const prSection = createActivitySection('Pull Requests', activities.pullRequests, (pr) => `
            <div class="activity-card pr-card">
                <div class="activity-card__header">
                    <i class='bx bx-git-pull-request activity-card__icon'></i>
                    <span class="activity-card__status ${pr.state}">${pr.state}</span>
                    <span class="activity-card__date">${formatDate(pr.createdAt)}</span>
                </div>
                <h4 class="activity-card__title">
                    <a href="${pr.url}" target="_blank">${pr.title}</a>
                </h4>
                <p class="activity-card__repo">${pr.repository}</p>
            </div>
        `);
        container.appendChild(prSection);
    }
}

function updateStatWithAnimation(elementId, finalValue) {
    const element = document.getElementById(elementId);
    const startValue = 0;
    const duration = 1000; // 1 second
    const steps = 60;
    const increment = (finalValue - startValue) / steps;
    let currentValue = startValue;

    const timer = setInterval(() => {
        currentValue += increment;
        if (currentValue >= finalValue) {
            element.textContent = finalValue;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(currentValue);
        }
    }, duration / steps);
}

function createActivitySection(title, items, cardTemplate) {
    const section = document.createElement('div');
    section.className = 'activity-section';
    section.innerHTML = `
        <h3 class="activity-section__title">
            <span class="title-text">${title}</span>
            <span class="count">${items.length}</span>
        </h3>
        <div class="activity-section__content">
            ${items.map(item => cardTemplate(item)).join('')}
        </div>
    `;
    return section;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
        Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24)),
        'day'
    );
}

// Initialize profile on page load
document.addEventListener('DOMContentLoaded', () => {
    fetchUserProfile().then(() => {
        initializeAnimations();
    });
});

function initializeAnimations() {
    // Add animation classes when elements come into view
    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, {
        threshold: 0.1
    });

    // Observe elements with animation classes
    document.querySelectorAll('.animate-fade-in, .animate-slide-left, .animate-slide-right, .animate-fade-up')
        .forEach(element => observer.observe(element));
}

function displayPullRequests(prs) {
    const timeline = document.getElementById('prTimeline');
    timeline.innerHTML = prs.map((pr, index) => {
        const isDevSyncRepo = pr.isDevSyncRepo;
        const statusClass = getStatusClass(pr);
        const statusText = getStatusText(pr);

        return `
            <div class="pr-card" style="animation-delay: ${index * 0.2}s">
                <div class="pr-status ${statusClass}">
                    <i class='bx ${getStatusIcon(pr)}'></i>
                    ${statusText}
                </div>
                <h3 class="pr-title">${pr.title}</h3>
                <a href="${pr.url}" class="pr-repo" target="_blank">
                    <i class='bx bxl-github'></i>
                    ${pr.repository}
                </a>
                <div class="pr-date">
                    <i class='bx bx-time-five'></i>
                    ${formatDate(pr.createdAt)}
                </div>
            </div>
        `;
    }).join('');

    // Initialize animations after adding PR cards
    initializePRAnimations();
}

function getStatusClass(pr) {
    if (!pr.isDevSyncRepo) return 'non-devsync';
    if (pr.merged && !pr.isDevSyncDetected) return 'waiting';
    if (pr.merged) return 'merged';
    if (pr.closed) return 'closed';
    return 'devsync';
}

function getStatusText(pr) {
    if (!pr.isDevSyncRepo) return 'Not a DevSync Repository';
    if (pr.merged && !pr.isDevSyncDetected) return 'Waiting for Approval';
    if (pr.merged) return 'Successfully Merged';
    if (pr.closed) return 'Closed';
    return 'DevSync Repository';
}

function getStatusIcon(pr) {
    if (!pr.isDevSyncRepo) return 'bx-x-circle';
    if (pr.merged && !pr.isDevSyncDetected) return 'bx-time-five';
    if (pr.merged) return 'bx-check-circle';
    if (pr.closed) return 'bx-x-circle';
    return 'bx-git-pull-request';
}

function initializePRAnimations() {
    // Add scroll progress indicator
    const scrollProgress = document.createElement('div');
    scrollProgress.className = 'scroll-progress';
    document.body.prepend(scrollProgress);

    // Update scroll progress
    window.addEventListener('scroll', () => {
        const winScroll = document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        document.documentElement.style.setProperty('--scroll-percent', `${scrolled}%`);
    });

    // Initialize Intersection Observer for PR cards
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Add a small delay between each card animation
                const index = Array.from(entry.target.parentNode.children).indexOf(entry.target);
                entry.target.style.animationDelay = `${index * 0.1}s`;
            }
        });
    }, {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px'
    });

    // Observe PR cards
    document.querySelectorAll('.pr-card').forEach(card => {
        observer.observe(card);
    });

    // Add parallax effect to cards on mouse move
    document.querySelector('.pr-timeline').addEventListener('mousemove', (e) => {
        const cards = document.querySelectorAll('.pr-card');
        cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const offsetX = ((x - rect.width / 2) / rect.width) * 10;
            const offsetY = ((y - rect.height / 2) / rect.height) * 10;

            card.style.transform = `perspective(1000px) rotateY(${offsetX}deg) rotateX(${-offsetY}deg) translateZ(10px)`;
        });
    });

    // Reset card transform on mouse leave
    document.querySelector('.pr-timeline').addEventListener('mouseleave', () => {
        document.querySelectorAll('.pr-card').forEach(card => {
            card.style.transform = '';
        });
    });
}
