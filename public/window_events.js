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
