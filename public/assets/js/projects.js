const server = "https://devsync-all.vercel.app"
document.addEventListener('DOMContentLoaded', () => {
    const loadingState = document.getElementById('loadingState');
    const authContainer = document.getElementById('authContainer');
    const projectsContainer = document.getElementById('projectsContainer');

    // Add this at the top level of the DOMContentLoaded callback
    let currentUser = null;

    // Tab handling
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const tabName = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const targetSection = document.getElementById(`${tabName}Section`);
            targetSection.classList.add('active');

            // Refresh projects when switching to view tab
            if (tabName === 'view' && currentUser) {
                await displayUserProjects(currentUser.id);
            }
        });
    });

    const deleteProject = async (projectId) => {
        showModal('confirm', 'Delete Project', 'Are you sure you want to delete this project?', async (confirmed) => {
            if (!confirmed) return;

            try {
                const response = await fetch(`${server}/api/projects/${projectId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });

                const data = await response.json();

                if (response.ok) {
                    const projectCard = document.querySelector(`[data-project-id="${projectId}"]`);
                    if (projectCard) {
                        projectCard.style.opacity = '0';
                        projectCard.style.transform = 'scale(0.9)';
                        setTimeout(() => {
                            projectCard.remove();
                            if (!document.querySelector('.project-card')) {
                                projectsContainer.innerHTML = '<p class="no-projects">No projects submitted yet.</p>';
                            }
                        }, 300);
                    }
                    showModal('success', 'Success', 'Project deleted successfully!');
                } else {
                    throw new Error(data.error || 'Failed to delete project');
                }
            } catch (error) {
                showModal('error', 'Error', error.message || 'Failed to delete project. Please try again.');
            }
        });
    };

    const displayUserProjects = async (userId) => {
        try {
            const response = await fetch(`${server}/api/projects/${userId}`, {
                credentials: 'include'
            });
            const projects = await response.json();

            // Add search bar
            projectsContainer.innerHTML = `
                <div class="search-container">
                    <input type="text" 
                           class="search-bar" 
                           placeholder="Search by repository name, owner, or technology..."
                           id="userProjectSearch">
                </div>
                <div class="projects-grid" id="userProjectsGrid">
                    ${renderProjects(projects)}
                </div>
            `;

            // Add event delegation for view repository buttons
            projectsContainer.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('.view-repo');
                const deleteBtn = e.target.closest('.delete-project');

                if (viewBtn) {
                    const repoUrl = viewBtn.dataset.url;
                    showModal('confirm', 'View Repository', 'Would you like to visit this repository on GitHub?', (confirmed) => {
                        if (confirmed) {
                            window.open(repoUrl, '_blank');
                        }
                    });
                }

                if (deleteBtn) {
                    deleteProject(deleteBtn.dataset.id);
                }
            });

            // Add search functionality
            const searchBar = document.getElementById('userProjectSearch');
            const projectsGrid = document.getElementById('userProjectsGrid');
            let debounceTimer;

            searchBar.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filteredProjects = projects.filter(project =>
                        project.repoLink.toLowerCase().includes(searchTerm) ||
                        project.ownerName.toLowerCase().includes(searchTerm) ||
                        project.technology.some(tech => tech.toLowerCase().includes(searchTerm))
                    );

                    projectsGrid.innerHTML = filteredProjects.length ?
                        renderProjects(filteredProjects) :
                        '<p class="no-results">No matching projects found</p>';
                }, 300);
            });
        } catch (error) {
            console.error('Error fetching user projects:', error);
            projectsContainer.innerHTML = '<p class="error-message">Failed to load projects.</p>';
        }
    };

    const getReviewStatusIcon = (status) => {
        const icons = {
            pending: '<i class="bx bx-time-five"></i>',
            accepted: '<i class="bx bx-check-circle"></i>',
            rejected: '<i class="bx bx-x-circle"></i>'
        };
        return icons[status] || icons.pending;
    };

    const getReviewStatusText = (status) => {
        const texts = {
            pending: 'Pending Review',
            accepted: 'Project Accepted',
            rejected: 'Project Rejected'
        };
        return texts[status] || texts.pending;
    };

    const reviewProject = async (projectId, status) => {
        try {
            const response = await fetch(`${server}/api/admin/projects/${projectId}/review`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error('Failed to review project');
            }

            showModal('success', 'Success', `Project ${status} successfully!`);
            await loadAllProjects(); // Refresh the admin view
        } catch (error) {
            showModal('error', 'Error', error.message || 'Failed to review project');
        }
    };

    const showProjectForm = () => {
        authContainer.innerHTML = `
            <form id="projectForm" class="project-form">
                <div class="form-group">
                    <label for="repoLink">Repository Link</label>
                    <input type="url" id="repoLink" name="repoLink" required 
                           placeholder="https://github.com/username/repository">
                </div>

                <div class="form-group">
                    <label for="ownerName">Repository Owner</label>
                    <input type="text" id="ownerName" name="ownerName" required 
                           placeholder="GitHub Username">
                </div>

                <div class="form-group">
                    <label for="techInput">Technologies Used</label>
                    <div class="tech-input-container">
                        <div class="tech-chips-wrapper" id="techChipsWrapper">
                            <input type="text" id="techInput" class="tech-input" 
                                   placeholder="Type to add technologies...">
                        </div>
                        <div class="tech-suggestions" id="techSuggestions"></div>
                    </div>
                    <input type="hidden" id="technology" name="technology" required>
                </div>

                <div class="form-group">
                    <label for="description">Project Description</label>
                    <textarea id="description" name="description" required 
                              placeholder="Describe your project and what kind of contributors you're looking for..."></textarea>
                </div>

                <button type="submit" class="submit-button">
                    <i class='bx bx-upload'></i>
                    Submit Project
                </button>
            </form>
        `;

        // Initialize chip input functionality
        initializeTechChips();

        // Initialize form submission handler
        document.getElementById('projectForm').addEventListener('submit', handleSubmit);
    };

    const initializeTechChips = () => {
        const wrapper = document.getElementById('techChipsWrapper');
        const input = document.getElementById('techInput');
        const suggestionsDiv = document.getElementById('techSuggestions');
        const hiddenInput = document.getElementById('technology');
        const selectedTechs = new Set();

        const technologies = [
            'JavaScript', 'Python', 'Java', 'C#', 'C++', 'PHP', 'Ruby', 'Go',
            'Rust', 'TypeScript', 'HTML', 'CSS', 'React', 'Vue', 'Angular',
            'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Docker',
            'Kubernetes', 'AWS', 'Azure', 'MongoDB', 'PostgreSQL', 'MySQL'
        ];

        const addChip = (tech) => {
            if (selectedTechs.has(tech)) return;

            const chip = document.createElement('div');
            chip.className = 'tech-chip';
            chip.innerHTML = `
                ${tech}
                <span class="remove-chip" data-tech="${tech}">×</span>
            `;
            wrapper.insertBefore(chip, input);
            selectedTechs.add(tech);
            updateHiddenInput();
        };

        const removeChip = (tech) => {
            const chip = wrapper.querySelector(`[data-tech="${tech}"]`).parentElement;
            chip.remove();
            selectedTechs.delete(tech);
            updateHiddenInput();
        };

        const updateHiddenInput = () => {
            hiddenInput.value = Array.from(selectedTechs).join(',');
        };

        const showSuggestions = (query) => {
            const filtered = technologies.filter(tech =>
                tech.toLowerCase().includes(query.toLowerCase()) &&
                !selectedTechs.has(tech)
            );

            if (filtered.length === 0 || !query) {
                suggestionsDiv.classList.remove('active');
                return;
            }

            suggestionsDiv.innerHTML = filtered
                .map(tech => `<div class="suggestion-item" data-tech="${tech}">${tech}</div>`)
                .join('');
            suggestionsDiv.classList.add('active');
        };

        // Event Listeners
        input.addEventListener('input', (e) => {
            showSuggestions(e.target.value);
        });

        input.addEventListener('keydown', (e) => {
            const suggestions = suggestionsDiv.querySelectorAll('.suggestion-item');
            const selected = suggestionsDiv.querySelector('.selected');
            let nextSelected;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (!suggestionsDiv.classList.contains('active')) {
                        showSuggestions(input.value);
                        return;
                    }
                    if (!selected) {
                        nextSelected = suggestions[0];
                    } else {
                        const next = Array.from(suggestions).indexOf(selected) + 1;
                        nextSelected = suggestions[next] || suggestions[0];
                    }
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (!selected) {
                        nextSelected = suggestions[suggestions.length - 1];
                    } else {
                        const prev = Array.from(suggestions).indexOf(selected) - 1;
                        nextSelected = suggestions[prev] || suggestions[suggestions.length - 1];
                    }
                    break;

                case 'Enter':
                    if (selected) {
                        e.preventDefault();
                        addChip(selected.dataset.tech);
                        input.value = '';
                        suggestionsDiv.classList.remove('active');
                    }
                    break;

                case 'Escape':
                    suggestionsDiv.classList.remove('active');
                    break;
            }

            if (nextSelected) {
                selected?.classList.remove('selected');
                nextSelected.classList.add('selected');
                nextSelected.scrollIntoView({ block: 'nearest' });
            }
        });

        suggestionsDiv.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item) {
                addChip(item.dataset.tech);
                input.value = '';
                suggestionsDiv.classList.remove('active');
                input.focus();
            }
        });

        wrapper.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-chip')) {
                removeChip(e.target.dataset.tech);
            }
        });

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                suggestionsDiv.classList.remove('active');
            }
        });
    };

    const showLoginPrompt = () => {
        authContainer.innerHTML = `
            <div class="auth-prompt">
                <h3>Please log in to submit a project</h3>
                <a href="${server}/auth/github" class="button">
                    <i class='bx bxl-github'></i> Login with GitHub
                </a>
            </div>
        `;
    };

    const isValidGithubUrl = (url) => {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname === 'github.com' &&
                parsedUrl.pathname.split('/').length === 3;
        } catch {
            return false;
        }
    };

    const checkRepoAccessibility = async (repoLink) => {
        try {
            const [owner, repo] = repoLink.split('/').slice(-2);
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error('Repository not found or inaccessible');
            }

            if (data.private) {
                throw new Error('Repository must be public');
            }

            return true;
        } catch (error) {
            throw new Error(error.message || 'Failed to verify repository accessibility');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const repoLink = form.repoLink.value.trim();
        const technologies = form.technology.value.split(',').filter(Boolean);

        try {
            // Show loading modal
            showModal('loading', 'Submitting Project...', 'Please wait while we process your submission.');

            // Validate GitHub URL format
            if (!isValidGithubUrl(repoLink)) {
                removeExistingModals();
                setTimeout(() => {
                    showModal('error', 'Error!', 'Invalid GitHub repository URL. Please provide a valid GitHub repository link.');
                }, 300);
                return;
            }

            // Check if repository is accessible and public
            await checkRepoAccessibility(repoLink);

            const formData = {
                repoLink: repoLink,
                ownerName: form.ownerName.value,
                technology: technologies,
                description: form.description.value
            };

            const response = await fetch(`${server}/api/projects`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                showModal('success', 'Success!', 'Project submitted successfully!', async () => {
                    form.reset();
                    // Switch to view tab and refresh projects
                    const viewTabButton = document.querySelector('[data-tab="view"]');
                    viewTabButton.click();
                });
            } else {
                throw new Error(data.error || 'Failed to submit project');
            }
        } catch (error) {
            removeExistingModals();
            setTimeout(() => {
                showModal('error', 'Error!', error.message || 'Failed to submit project. Please try again.');
            }, 300);
        }
    };

    // Add these utility functions for the modal
    function showModal(type, title, message, callback) {
        removeExistingModals();

        const modal = document.createElement('div');
        modal.className = 'modal';

        const overlay = document.createElement('div');
        overlay.className = 'modal__overlay';

        const iconMap = {
            loading: 'bx bx-loader-alt',
            success: 'bx bx-check-circle',
            error: 'bx bx-x-circle',
            confirm: 'bx bx-help-circle'
        };

        modal.innerHTML = `
            <div class="modal__content">
                <i class="modal__icon ${type} ${iconMap[type]}"></i>
                <h3 class="modal__title">${title}</h3>
                <p class="modal__message">${message}</p>
                ${type === 'confirm' ? `
                    <div class="modal__actions">
                        <button class="modal__button modal__button--confirm">Yes</button>
                        <button class="modal__button modal__button--cancel">No</button>
                    </div>
                ` : type !== 'loading' ? `
                    <button class="modal__button">OK</button>
                ` : ''}
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(modal);

        setTimeout(() => {
            modal.classList.add('show');
            overlay.classList.add('show');
        }, 10);

        if (type === 'confirm') {
            const confirmBtn = modal.querySelector('.modal__button--confirm');
            const cancelBtn = modal.querySelector('.modal__button--cancel');

            confirmBtn.addEventListener('click', () => {
                closeModal(modal, overlay, () => callback(true));
            });

            cancelBtn.addEventListener('click', () => {
                closeModal(modal, overlay, () => callback(false));
            });
        } else if (type !== 'loading') {
            const button = modal.querySelector('.modal__button');
            button.addEventListener('click', () => {
                closeModal(modal, overlay, callback);
            });
        }
    }

    function closeModal(modal, overlay, callback) {
        modal.classList.remove('show');
        overlay.classList.remove('show');
        setTimeout(() => {
            modal.remove();
            overlay.remove();
            if (callback) callback();
        }, 300);
    }

    // Add this new function to remove existing modals
    function removeExistingModals() {
        const existingModals = document.querySelectorAll('.modal, .modal__overlay');
        existingModals.forEach(modal => {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        });
    }

    // Add this after checkAuthAndInitialize initialization
    const loadAcceptedProjects = async () => {
        try {
            const response = await fetch(`${server}/api/accepted-projects`);

            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const projects = await response.json();
            const acceptedContainer = document.getElementById('acceptedContainer');

            acceptedContainer.innerHTML = `
                <div class="search-container">
                    <input type="text" 
                           class="search-bar" 
                           placeholder="Search by repository name, owner, or technology..."
                           id="acceptedProjectSearch">
                </div>
                <div class="projects-grid" id="acceptedProjectsGrid">
                    ${renderPublicProjects(projects)}
                </div>
            `;

            // Add event delegation for view repository buttons
            acceptedContainer.addEventListener('click', (e) => {
                const viewBtn = e.target.closest('.view-repo');
                if (viewBtn) {
                    const repoUrl = viewBtn.dataset.url;
                    showModal('confirm', 'View Repository', 'Would you like to visit this repository on GitHub?', (confirmed) => {
                        if (confirmed) {
                            window.open(repoUrl, '_blank');
                        }
                    });
                }
            });

            // Add search functionality
            const searchBar = document.getElementById('acceptedProjectSearch');
            const projectsGrid = document.getElementById('acceptedProjectsGrid');
            let debounceTimer;

            searchBar.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filteredProjects = projects.filter(project =>
                        project.repoLink.toLowerCase().includes(searchTerm) ||
                        project.ownerName.toLowerCase().includes(searchTerm) ||
                        project.technology.some(tech => tech.toLowerCase().includes(searchTerm))
                    );

                    projectsGrid.innerHTML = filteredProjects.length ?
                        renderPublicProjects(filteredProjects) :
                        '<p class="no-results">No matching projects found</p>';
                }, 300);
            });
        } catch (error) {
            console.error('Error loading accepted projects:', error);
            document.getElementById('acceptedContainer').innerHTML =
                '<p class="error-message">Failed to load projects. Please try again.</p>';
        }
    };

    const renderPublicProjects = (projects) => {
        return projects.length > 0 ?
            projects.map((project, index) => `
                <div class="project-card" 
                     data-project-id="${project._id}"
                     style="animation-delay: ${index * 0.1}s">
                    <div class="project-owner">
                        <strong>Owner:</strong> ${project.ownerName}
                    </div>
                    <h4>
                        <i class='bx bx-code-alt'></i>
                        ${project.repoLink.split('/').pop()}
                    </h4>
                    <p>${project.description}</p>
                    <div class="tech-stack">
                        ${project.technology.map(tech =>
                `<span class="tech-tag">
                                <i class='bx bx-code-curly'></i>
                                ${tech}
                            </span>`
            ).join('')}
                    </div>
                    <div class="project-actions">
                        <button class="repo-link view-repo" data-url="${project.repoLink}">
                            <i class='bx bxl-github'></i>
                            View Repository
                        </button>
                    </div>
                </div>
            `).join('') : '<p class="no-projects">No accepted projects yet.</p>';
    };

    const checkAuthAndInitialize = async () => {
        try {
            // Load accepted projects regardless of authentication
            await loadAcceptedProjects();

            const response = await fetch(`${server}/api/user`, {
                credentials: 'include'
            });
            const data = await response.json();

            loadingState.style.display = 'none';
            authContainer.style.display = 'block';

            if (data.isAuthenticated) {
                currentUser = data.user; // Store user data
                showProjectForm();
                await displayUserProjects(currentUser.id);

                // Check if user is admin
                const adminResponse = await fetch(`${server}/api/admin/verify`, {
                    credentials: 'include'
                });
                const adminData = await adminResponse.json();
                currentUser.isAdmin = adminData.isAdmin;
            } else {
                showLoginPrompt();
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            loadingState.innerHTML = `
                <p class="error-message">Failed to load. Please refresh the page.</p>
            `;
        }
    };

    // Add admin panel handler
    tabButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const tabName = button.dataset.tab;

            if (tabName === 'admin') {
                if (!currentUser || !currentUser.isAdmin) {
                    showModal('error', 'Unauthorized', 'You do not have admin privileges.');
                    return;
                }

                showModal('success', 'Welcome Admin', `Welcome ${currentUser.username}!`, async () => {
                    await loadAllProjects();
                });
            }

            // ...existing tab handling code...

            if (tabName === 'accepted') {
                await loadAcceptedProjects();
            }

            // ...existing admin tab handling code...
        });
    });

    const loadAllProjects = async () => {
        try {
            const response = await fetch(`${server}/api/admin/projects`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch projects');
            }

            const projects = await response.json();
            const adminContainer = document.getElementById('adminContainer');

            // Add search bar for admin section
            adminContainer.innerHTML = `
                <div class="search-container">
                    <input type="text" 
                           class="search-bar" 
                           placeholder="Search by repository name, owner, or technology..."
                           id="adminProjectSearch">
                </div>
                <div class="projects-grid" id="adminProjectsGrid">
                    ${renderAdminProjects(projects)}
                </div>
            `;

            // Add search functionality for admin section
            const searchBar = document.getElementById('adminProjectSearch');
            const projectsGrid = document.getElementById('adminProjectsGrid');
            let debounceTimer;

            searchBar.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const searchTerm = e.target.value.toLowerCase();
                    const filteredProjects = projects.filter(project =>
                        project.repoLink.toLowerCase().includes(searchTerm) ||
                        project.ownerName.toLowerCase().includes(searchTerm) ||
                        project.technology.some(tech => tech.toLowerCase().includes(searchTerm))
                    );

                    projectsGrid.innerHTML = filteredProjects.length ?
                        renderAdminProjects(filteredProjects) :
                        '<p class="no-results">No matching projects found</p>';
                }, 300);
            });

            // Add event delegation for admin actions
            addAdminEventListeners(adminContainer);
        } catch (error) {
            console.error('Error loading all projects:', error);
            document.getElementById('adminContainer').innerHTML =
                '<p class="error-message">Failed to load projects. Please try again.</p>';
        }
    };

    // Add this new function to handle admin panel events
    const addAdminEventListeners = (container) => {
        container.addEventListener('click', async (e) => {
            const updatePointsBtn = e.target.closest('.update-points');

            if (updatePointsBtn) {
                const projectId = updatePointsBtn.dataset.id;
                const successInput = container.querySelector(`.success-points[data-project="${projectId}"]`);
                const successPoints = parseInt(successInput.value);

                // Validate points
                if (successPoints < 0 || successPoints > 500) {
                    showModal('error', 'Invalid Points', 'Success points must be between 0 and 500');
                    return;
                }

                try {
                    const response = await fetch(`${server}/api/admin/projects/${projectId}/points`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            successPoints
                        })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update points');
                    }

                    showModal('success', 'Success', 'Points updated successfully!');
                    successInput.value = successPoints;

                    // Visual feedback
                    const pointsControl = updatePointsBtn.closest('.points-control');
                    pointsControl.style.borderColor = 'var(--first-color)';
                    setTimeout(() => {
                        pointsControl.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }, 2000);

                } catch (error) {
                    showModal('error', 'Error', 'Failed to update points. Please try again.');
                }
            }
        });

        container.addEventListener('click', async (e) => {
            const acceptBtn = e.target.closest('.accept-project');
            const rejectBtn = e.target.closest('.reject-project');
            const deleteBtn = e.target.closest('.delete-project');
            const viewBtn = e.target.closest('.view-repo');

            if (acceptBtn) {
                const projectId = acceptBtn.dataset.id;
                await reviewProject(projectId, 'accepted');
            }

            if (rejectBtn) {
                const projectId = rejectBtn.dataset.id;
                await reviewProject(projectId, 'rejected');
            }

            if (deleteBtn) {
                const projectId = deleteBtn.dataset.id;
                if (projectId) {
                    showModal('confirm', 'Delete Project', 'Are you sure you want to delete this project?', async (confirmed) => {
                        if (!confirmed) return;

                        try {
                            const response = await fetch(`${server}/api/projects/${projectId}`, {
                                method: 'DELETE',
                                credentials: 'include'
                            });

                            if (!response.ok) {
                                throw new Error('Failed to delete project');
                            }

                            // Get the specific project card using the project ID
                            const projectCard = container.querySelector(`.project-card[data-project-id="${projectId}"]`);

                            if (projectCard) {
                                // Add fade out animation
                                projectCard.style.transition = 'all 0.3s ease';
                                projectCard.style.opacity = '0';
                                projectCard.style.transform = 'scale(0.9)';

                                // Remove the card after animation
                                setTimeout(() => {
                                    projectCard.remove();

                                    // Check if there are any remaining projects
                                    const projectsGrid = document.getElementById('adminProjectsGrid');
                                    const remainingCards = projectsGrid.querySelectorAll('.project-card');

                                    if (remainingCards.length === 0) {
                                        projectsGrid.innerHTML = '<p class="no-projects">No projects submitted yet.</p>';
                                    }
                                }, 300);

                                showModal('success', 'Success', 'Project deleted successfully!');
                            }
                        } catch (error) {
                            showModal('error', 'Error', 'Failed to delete project. Please try again.');
                        }
                    });
                }
            }

            if (viewBtn) {
                const repoUrl = viewBtn.dataset.url;
                showModal('confirm', 'View Repository', `Would you like to view this repository on GitHub?`, (confirmed) => {
                    if (confirmed) {
                        window.open(repoUrl, '_blank');
                    }
                });
            }
        });
    };

    // Add helper functions to render projects
    const renderProjects = (projects) => {
        return projects.length > 0 ?
            projects.map((project, index) => `
                <div class="project-card" 
                     data-project-id="${project._id}"
                     style="animation-delay: ${index * 0.1}s">
                    <div class="review-status ${project.reviewStatus}">
                        ${getReviewStatusIcon(project.reviewStatus)}
                        ${getReviewStatusText(project.reviewStatus)}
                    </div>
                    <h4>
                        <i class='bx bx-code-alt'></i>
                        ${project.repoLink.split('/').pop()}
                    </h4>
                    <p>${project.description}</p>
                    <div class="tech-stack">
                        ${project.technology.map(tech =>
                `<span class="tech-tag">
                                <i class='bx bx-code-curly'></i>
                                ${tech}
                            </span>`
            ).join('')}
                    </div>
                    <div class="project-actions">
                        <button class="repo-link view-repo" data-url="${project.repoLink}">
                            <i class='bx bxl-github'></i>
                            View Repository
                        </button>
                        ${project.reviewStatus === 'pending' && currentUser.id === project.userId ? `
                            <button class="delete-project" data-id="${project._id}">
                                <i class='bx bx-trash'></i>
                                Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('') : '<p class="no-projects">No projects submitted yet.</p>';
    };

    const renderAdminProjects = (projects) => {
        return projects.length ? projects.map(project => `
            <div class="project-card ${project.reviewStatus}" data-project-id="${project._id}">
                <div class="review-status ${project.reviewStatus}">
                    ${getReviewStatusIcon(project.reviewStatus)}
                    ${getReviewStatusText(project.reviewStatus)}
                </div>
                <div class="project-owner">
                    <strong>Owner:</strong> ${project.ownerName}
                </div>
                <h4>
                    <i class='bx bx-code-alt'></i>
                    ${project.repoLink.split('/').pop()}
                </h4>
                <p>${project.description}</p>
                <div class="tech-stack">
                    ${project.technology.map(tech =>
            `<span class="tech-tag">
                            <i class='bx bx-code-curly'></i>
                            ${tech}
                        </span>`
        ).join('')}
                </div>
                <div class="project-actions">
                    <div class="action-buttons">
                        <button class="repo-link view-repo" data-url="${project.repoLink}">
                            <i class='bx bxl-github'></i>
                            View Repository
                        </button>
                        <button class="delete-project" data-id="${project._id}">
                            <i class='bx bx-trash'></i>
                            Delete
                        </button>
                    </div>
                    ${project.reviewStatus === 'pending' ? `
                        <div class="review-buttons">
                            <button class="accept-project" data-id="${project._id}">
                                <i class='bx bx-check'></i>
                                Accept
                            </button>
                            <button class="reject-project" data-id="${project._id}">
                                <i class='bx bx-x'></i>
                                Reject
                            </button>
                        </div>
                    ` : ''}
                    ${project.reviewStatus === 'accepted' ? `
                        <div class="points-control">
                            <div class="points-field">
                                <label>Success Points (earned for successful merge)</label>
                                <input type="number" 
                                       class="points-input success-points" 
                                       value="${project.successPoints || 50}" 
                                       min="0" 
                                       max="500"
                                       step="5"
                                       data-project="${project._id}">
                            </div>
                            <button class="update-points" data-id="${project._id}">
                                <i class='bx bx-save'></i>
                                Update Project Points
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('') : '<p class="no-projects">No projects submitted yet.</p>';
    };

    // Start the authentication check process
    checkAuthAndInitialize();
});
