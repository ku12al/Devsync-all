async function checkAuthStatus() {
    try {
        const response = await fetch('http://localhost:3000/api/user', {
            credentials: 'include'
        });
        const data = await response.json();

        const loginButton = document.querySelector('.button.button--ghost');

        if (data.isAuthenticated) {
            // Create a more sophisticated profile button
            loginButton.className = 'nav__profile';
            loginButton.innerHTML = `
                <img src="${data.user.photos[0].value}" 
                     alt="Profile" 
                     class="nav__profile-img">
                <span class="nav__profile-name">${data.user.displayName}</span>
            `;
            loginButton.href = 'profile.html';
        } else {
            // Keep the original login button style
            loginButton.className = 'button button--ghost';
            loginButton.innerHTML = 'Login';
            loginButton.href = 'http://localhost:3000/auth/github';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Check auth status when page loads
document.addEventListener('DOMContentLoaded', checkAuthStatus);
