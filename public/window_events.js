// Function to handle closing the navbar dropdown when clicking or tapping outside the menu
document.addEventListener('click', function(event) {
    closeMenuOnOutsideClick(event);
});

document.addEventListener('touchstart', function(event) {
    closeMenuOnOutsideClick(event);
});
document.querySelector('.navbar-toggler').addEventListener('click', function () {
    var navbarCollapse = document.querySelector('#navbarNav');
    if (navbarCollapse.classList.contains('show')) {
        navbarCollapse.classList.remove('show');
    } else {
        navbarCollapse.classList.add('show');
    }
});


function closeMenuOnOutsideClick(event) {
    var navbarToggler = document.querySelector('.navbar-toggler');
    var navbarCollapse = document.querySelector('#navbarNav');

    // Check if the click or tap is outside the navbar-collapse and the navbar-toggler
    if (!navbarCollapse.contains(event.target) && !navbarToggler.contains(event.target) && !event.target.classList.contains('nav-link')) {
        // If the menu is open (has 'show' class), close it using Bootstrap's Collapse API
        if (navbarCollapse.classList.contains('show')) {
            var bsCollapse = new bootstrap.Collapse(navbarCollapse, {
                toggle: true
            });
            bsCollapse.hide(); // Programmatically hide the navbar
        }
    }
}
