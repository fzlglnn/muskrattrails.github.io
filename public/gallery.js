// Lightbox for the about page photo gallery.
// Each tile in .gallery-grid is a normal link to the full-size photo, so the
// gallery still works without JavaScript. This script upgrades the links to
// open in a full-screen viewer with previous/next, keyboard and swipe support.
(function () {
    'use strict';

    var grid = document.querySelector('.gallery-grid');
    // Without <dialog> support the tiles just open the photos as plain links.
    if (!grid || typeof HTMLDialogElement === 'undefined') return;

    var tiles = Array.prototype.slice.call(grid.querySelectorAll('.gallery-tile'));
    var index = 0;

    var dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Photo viewer');
    dialog.innerHTML =
        '<button type="button" class="lb-btn lb-close" aria-label="Close photo viewer">&times;</button>' +
        '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo">&#8249;</button>' +
        '<figure class="lb-figure">' +
            '<img class="lb-img" alt="">' +
            '<figcaption class="lb-count" aria-live="polite"></figcaption>' +
        '</figure>' +
        '<button type="button" class="lb-btn lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(dialog);

    var img = dialog.querySelector('.lb-img');
    var count = dialog.querySelector('.lb-count');

    function wrap(i) {
        var n = tiles.length;
        return ((i % n) + n) % n;
    }

    // Start fetching a neighbouring photo so next/previous feels instant
    function preload(i) {
        new Image().src = tiles[wrap(i)].getAttribute('href');
    }

    function show(i) {
        index = wrap(i);
        img.classList.add('lb-loading');
        img.onload = function () { img.classList.remove('lb-loading'); };
        img.src = tiles[index].getAttribute('href');
        if (img.complete) img.classList.remove('lb-loading'); // already cached
        count.textContent = (index + 1) + ' / ' + tiles.length;
        preload(index + 1);
        preload(index - 1);
    }

    function open(i) {
        show(i);
        document.documentElement.classList.add('lb-open'); // stop the page scrolling behind
        dialog.showModal();
    }

    // Fires for the close button, backdrop clicks and the Escape key
    dialog.addEventListener('close', function () {
        document.documentElement.classList.remove('lb-open');
    });

    // Open from a tile (leave ctrl/cmd/shift/middle-click alone so "open in new tab" still works)
    grid.addEventListener('click', function (e) {
        var tile = e.target.closest('.gallery-tile');
        if (!tile || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(tiles.indexOf(tile));
    });

    dialog.addEventListener('click', function (e) {
        var t = e.target;
        if (t.closest('.lb-close') || t === dialog || t.classList.contains('lb-figure')) {
            dialog.close();
        } else if (t.closest('.lb-prev')) {
            show(index - 1);
        } else if (t.closest('.lb-next')) {
            show(index + 1);
        }
    });

    dialog.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { show(index - 1); }
        else if (e.key === 'ArrowRight') { show(index + 1); }
    });

    // Swipe left/right on touch screens
    var startX = 0;
    var startY = 0;

    dialog.addEventListener('touchstart', function (e) {
        startX = e.changedTouches[0].clientX;
        startY = e.changedTouches[0].clientY;
    }, { passive: true });

    dialog.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - startX;
        var dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            show(dx < 0 ? index + 1 : index - 1); // swipe left = next
        }
    }, { passive: true });
})();
