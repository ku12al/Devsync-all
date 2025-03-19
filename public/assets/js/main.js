/*=============== SHOW MENU ===============*/
const navMenu = document.querySelector('.nav__menu'),
    navToggle = document.getElementById('nav-toggle')

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.toggle('show-menu')
        navToggle.classList.toggle('active')
    })

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav__menu') && !e.target.closest('.nav__toggle')) {
            navMenu.classList.remove('show-menu')
            navToggle.classList.remove('active')
        }
    })

    // Add smooth transition when menu items are clicked
    const navLinks = document.querySelectorAll('.nav__link')
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('show-menu')
            navToggle.classList.remove('active')
        })
    })
}

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if (navToggle) {
    navToggle.addEventListener('click', () => {
        navMenu.classList.add('show-menu')
    })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if (navClose) {
    navClose.addEventListener('click', () => {
        navMenu.classList.remove('show-menu')
    })
}

/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction() {
    const navMenu = document.getElementById('nav-menu')
    // When we click on each nav__link, we remove the show-menu class
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*=============== HOME SWIPER ===============*/
let homeSwiper = new Swiper(".home-swiper", {
    spaceBetween: 30,
    loop: 'true',

    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },
})

/*=============== CHANGE BACKGROUND HEADER ===============*/
function scrollHeader() {
    const header = document.getElementById('header')
    const nav = document.querySelector('.nav');
    if (this.scrollY >= 50) {
        nav.classList.add('scroll-header');
    } else {
        nav.classList.remove('scroll-header');
    }
}
window.addEventListener('scroll', scrollHeader)

window.addEventListener('scroll', function () {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
        header.classList.add('scroll-header');
    } else {
        header.classList.remove('scroll-header');
    }
});

/*=============== NEW SWIPER ===============*/
let newSwiper = new Swiper(".new-swiper", {
    centeredSlides: true,
    slidesPerView: "auto",
    loop: 'true',
    spaceBetween: 16,
});

/*=============== TEAM SWIPER ===============*/
let teamSwiper = new Swiper(".team-swiper", {
    loop: true,
    grabCursor: true,
    spaceBetween: 32,
    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },
    autoplay: {
        delay: 3500,
        disableOnInteraction: false,
    }
});

/*=============== SCROLL SECTIONS ACTIVE LINK ===============*/
const sections = document.querySelectorAll('section[id]')

function scrollActive() {
    const scrollY = window.pageYOffset

    sections.forEach(current => {
        const sectionHeight = current.offsetHeight,
            sectionTop = current.offsetTop - 58,
            sectionId = current.getAttribute('id')

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.add('active-link')
        } else {
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.remove('active-link')
        }
    })
}
window.addEventListener('scroll', scrollActive)

/*=============== SHOW SCROLL UP ===============*/
function scrollUp() {
    const scrollUp = document.getElementById('scroll-up');
    // When the scroll is higher than 460 viewport height, add the show-scroll class to the a tag with the scroll-top class
    if (this.scrollY >= 460) scrollUp.classList.add('show-scroll'); else scrollUp.classList.remove('show-scroll')
}
window.addEventListener('scroll', scrollUp)

/*=============== PAGE TRANSITIONS ===============*/
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav__link');
    const transition = document.querySelector('.page-transition');
    const content = document.querySelector('.main');

    // Show transition on page load
    transition.classList.add('show');

    // Hide main content initially
    content.style.opacity = '0';

    // After page loads, reveal content
    setTimeout(() => {
        transition.classList.remove('show');
        content.style.opacity = '1';
    }, 2000);

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');

            // Only handle page links, not section links
            if (href.startsWith('')) return;

            e.preventDefault();

            // Show transition overlay
            transition.classList.add('show');
            content.style.opacity = '0';

            // Change page in background
            setTimeout(() => {
                window.location.href = href;
            }, 5000);
        });
    });
});

/*=============== SCROLL REVEAL ANIMATION ===============*/
const sr = ScrollReveal({
    origin: 'top',
    distance: '60px',
    duration: 2500,
    delay: 400,
    // reset: true
})

sr.reveal(`.home-swiper, .new-swiper, .newsletter__container`)
sr.reveal(`.category__data, .trick__content, .footer__content`, { interval: 100 })
sr.reveal(`.about__data, .discount__img`, { origin: 'left' })
sr.reveal(`.about__img, .discount__data`, { origin: 'right' })

// Check login status and update nav
function updateNavigation() {
    const nav = document.querySelector('.nav__list');
    fetch('/api/user')
        .then(res => res.json())
        .then(user => {
            if (user.error) {
                // Add login button if not logged in
                nav.innerHTML += `
                    <li class="nav__item">
                        <a href="/login" class="nav__link">Login</a>
                    </li>`;
            } else {
                // Replace login with profile pic and shortened name
                const displayName = user.displayName.split(' ')[0]; // Show only first name
                nav.innerHTML = nav.innerHTML.replace(
                    `<a href="/login" class="nav__link">Login</a>`,
                    `<a href="/profile" class="nav__profile">
                        <img src="${user.photos[0].value}" alt="Profile" class="nav__profile-img">
                        <span class="nav__profile-name">${displayName}</span>
                    </a>`
                );
            }
        });
}

// Load profile data if on profile page
if (window.location.pathname === '/profile') {
    fetch('/api/user')
        .then(res => res.json())
        .then(user => {
            document.getElementById('profile-img').src = user.photos[0].value;
            document.getElementById('profile-name').textContent = user.displayName;
            document.getElementById('profile-bio').textContent = user._json.bio || '';
        });

    // Load leaderboard
    fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => {
            const leaderboardList = document.getElementById('leaderboard-list');
            leaderboardList.innerHTML = data.map(user => `
                <div class="leaderboard__item">
                    <span class="leaderboard__rank">#${user.rank}</span>
                    <img src="${user.avatar}" alt="${user.username}" class="leaderboard__img">
                    <div class="leaderboard__info">
                        <h3>${user.username}</h3>
                        <p>${user.contributions} contributions</p>
                    </div>
                </div>
            `).join('');
        });
}

// Initialize navigation state
document.addEventListener('DOMContentLoaded', updateNavigation);
