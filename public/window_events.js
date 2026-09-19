// Close the navbar dropdown when clicking or tapping outside the menu.
// Opening and closing with the hamburger button is handled by Bootstrap itself
// (data-bs-toggle="collapse"), so it is not duplicated here.
function closeMenuOnOutsideClick(event) {
    var navbarToggler = document.querySelector('.navbar-toggler');
    var navbarCollapse = document.querySelector('#navbarNav');
    if (!navbarToggler || !navbarCollapse) return;

    // Ignore clicks or taps inside the menu or on the hamburger button
    if (navbarCollapse.contains(event.target) || navbarToggler.contains(event.target)) return;

    // If the menu is open (has 'show' class), close it using Bootstrap's Collapse API
    if (navbarCollapse.classList.contains('show')) {
        bootstrap.Collapse.getOrCreateInstance(navbarCollapse, { toggle: false }).hide();
    }
}

document.addEventListener('click', closeMenuOnOutsideClick);
document.addEventListener('touchstart', closeMenuOnOutsideClick, { passive: true });

// Fade the header out while scrolling down and back in when scrolling up.
// The fading itself is done by CSS (#header.header-hidden in styles.css); this only
// decides when to add or remove that class.
(function () {
    var header = document.getElementById('header');
    if (!header) return;

    var HIDE_AFTER = 80;  // px from the top of the page before the header may fade away
    var SENSITIVITY = 8;  // ignore tiny movements (and the bounce on touch screens)
    var lastY = window.pageYOffset;
    var waiting = false;

    function update() {
        waiting = false;
        var y = Math.max(window.pageYOffset, 0); // iOS reports negative values while bouncing
        var menu = document.getElementById('navbarNav');
        var menuOpen = menu && (menu.classList.contains('show') || menu.classList.contains('collapsing'));

        if (y <= HIDE_AFTER || menuOpen) {
            header.classList.remove('header-hidden');   // near the top, or the menu is open
        } else if (y > lastY + SENSITIVITY) {
            header.classList.add('header-hidden');      // scrolling down
        } else if (y < lastY - SENSITIVITY) {
            header.classList.remove('header-hidden');   // scrolling up
        } else {
            return;                                     // barely moved: keep things as they are
        }
        lastY = y;
    }

    window.addEventListener('scroll', function () {
        if (!waiting) {
            waiting = true;
            window.requestAnimationFrame(update); // at most once per frame
        }
    }, { passive: true });
})();
