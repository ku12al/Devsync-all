function initializeTeamInteractions() {
    const container = document.querySelector('.grid');
    const teamMembers = document.querySelectorAll('.image');
    const teamNames = document.querySelectorAll('.team_member');

    function highlightTeamMember(memberName, controlId) {
        // Find corresponding elements
        const targetMember = [...teamMembers].find(member =>
            member.getAttribute('data-member') === memberName || member.id === controlId
        );
        const targetName = [...teamNames].find(name =>
            name.getAttribute('data-controls') === controlId ||
            name.querySelector('span').textContent.trim() === memberName
        );

        // Add highlight classes
        if (targetMember) {
            targetMember.classList.add('selected');
            teamMembers.forEach(member => {
                if (member !== targetMember) {
                    member.classList.add('faded');
                }
            });
        }

        if (targetName) {
            targetName.classList.add('active');
            // Add animation trigger for social link
            const socialLink = targetName.querySelector('a span');
            if (socialLink) {
                socialLink.style.transform = 'translateX(0)';
                socialLink.style.opacity = '1';
            }
            teamNames.forEach(name => {
                if (name !== targetName) {
                    name.classList.add('faded');
                    // Reset other social links
                    const otherLink = name.querySelector('a span');
                    if (otherLink) {
                        otherLink.style.transform = '';
                        otherLink.style.opacity = '';
                    }
                }
            });
        }
    }

    function resetHighlights() {
        teamMembers.forEach(member => {
            member.classList.remove('selected', 'faded');
        });
        teamNames.forEach(name => {
            name.classList.remove('active', 'faded');
            // Reset all social links
            const socialLink = name.querySelector('a span');
            if (socialLink) {
                socialLink.style.transform = '';
                socialLink.style.opacity = '';
            }
        });
    }

    // Handle image hover effects
    teamMembers.forEach(member => {
        member.addEventListener('mouseenter', () => {
            const memberName = member.getAttribute('data-member');
            const memberId = member.id;
            highlightTeamMember(memberName, memberId);
        });

        member.addEventListener('mouseleave', resetHighlights);
    });

    // Handle name hover effects
    teamNames.forEach(name => {
        name.addEventListener('mouseenter', () => {
            const controlId = name.getAttribute('data-controls');
            const memberName = name.querySelector('span').textContent.trim();
            highlightTeamMember(memberName, controlId);
        });

        name.addEventListener('mouseleave', resetHighlights);
    });

    // Handle name keyboard interactions
    teamNames.forEach(name => {
        name.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const controlId = name.getAttribute('data-controls');
                const memberName = name.querySelector('span').textContent.trim();
                highlightTeamMember(memberName, controlId);
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeTeamInteractions();

    // Smooth scroll to team member when clicking on name
    const teamMembers = document.querySelectorAll('.team_member');
    teamMembers.forEach(member => {
        member.addEventListener('click', () => {
            const targetId = member.getAttribute('data-controls');
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        });
    });

    // Intersection Observer for scroll-based animations
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all team members and images
    const elementsToAnimate = document.querySelectorAll('.team_member, .image');
    elementsToAnimate.forEach((element, index) => {
        element.style.setProperty('--animation-order', index + 1);
        observer.observe(element);
    });

    // Handle hover interactions
    const grid = document.querySelector('.grid');
    const allItems = document.querySelectorAll('.team_member, .image');

    grid.addEventListener('mouseover', () => {
        grid.classList.add('has-hover');
    });

    grid.addEventListener('mouseout', () => {
        grid.classList.remove('has-hover');
    });
});
