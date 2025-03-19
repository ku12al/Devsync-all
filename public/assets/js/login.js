// Create particles
function createParticles() {
    const particles = document.querySelector('.particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: 2px;
            height: 2px;
            background: rgba(255, 255, 255, ${Math.random() * 0.5 + 0.3});
            left: ${Math.random() * 100}vw;
            top: ${Math.random() * 100}vh;
            border-radius: 50%;
            pointer-events: none;
            opacity: 0;
            animation: particleFloat ${Math.random() * 3 + 2}s linear infinite;
            animation-delay: ${Math.random() * 2}s;
        `;
        particles.appendChild(particle);
    }
}

// Initialize animations
document.addEventListener('DOMContentLoaded', () => {
    createParticles();

    // Add hover effect to background circles
    const circles = document.querySelectorAll('.background span');
    circles.forEach(circle => {
        circle.addEventListener('mouseover', () => {
            circle.style.transform = 'scale(1.1)';
            circle.style.transition = 'transform 0.3s ease';
        });

        circle.addEventListener('mouseout', () => {
            circle.style.transform = 'scale(1)';
        });
    });
});

// Add dynamic shadows based on mouse movement
document.addEventListener('mousemove', (e) => {
    const card = document.querySelector('.login__card');
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const angleX = (y - centerY) / 30;
    const angleY = (centerX - x) / 30;

    card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg)`;
});

// Reset card position when mouse leaves
document.querySelector('.login__card').addEventListener('mouseleave', () => {
    const card = document.querySelector('.login__card');
    card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
});
