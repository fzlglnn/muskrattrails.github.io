// Month-view calendar of the club's Discord scheduled events, backed by /api/events
// (see server.js and discord-events.js). Built on FullCalendar's free dayGrid view.
//
// Each event shows as one plain colored bar -- no title/time text in the grid
// itself. A single-day event's bar stays inside its own day cell; a multi-day
// event's bar spans every cell it covers, same as any normal calendar. A day with
// several events gets several stacked bars. This is FullCalendar's own native
// block-event layout (forced on via eventDisplay: 'block' below, since its default
// heuristic would otherwise show short single-day events as a small text+dot
// instead) -- we only suppress its text and set the color; its containment and
// stacking logic, already correct, does the rest. Clicking a day, or one of its
// bars, opens a popup listing every event on that day as its own card. Each
// event's bar and card share a color, consistently assigned from a fixed,
// validated 8-color categorical palette (see the dataviz skill's reference
// palette) so the same recurring event (e.g. a weekly ride) always reads as the
// same color across the calendar.
(function () {
    'use strict';

    var calendarEl = document.getElementById('calendar');
    var dialog = document.getElementById('event-dialog');
    if (!calendarEl || !window.FullCalendar) return;

    var lastFocusedEl = null;
    var dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var dayHeadingFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

    // Fixed, validated categorical palette (dataviz skill reference palette, default
    // order). Never reordered or cycled per the skill's rule; a 9th distinct series
    // just repeats a slot rather than inventing a new hue.
    var SERIES_COLORS = [
        '#2a78d6', // blue
        '#eb6834', // orange
        '#1baf7a', // aqua
        '#eda100', // yellow
        '#e87ba4', // magenta
        '#008300', // green
        '#4a3aa7', // violet
        '#e34948', // red
    ];

    // Deterministic hash so the same Discord event series always lands on the same
    // color, across page loads and month navigations.
    function colorForSeries(seriesId) {
        var s = String(seriesId || '');
        var hash = 0;
        for (var i = 0; i < s.length; i++) {
            hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
        }
        return SERIES_COLORS[hash % SERIES_COLORS.length];
    }

    function formatWhen(start, end) {
        if (!start) return '';
        var sameDay = !end || (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate());
        if (sameDay) {
            var text = dateFmt.format(start) + ' · ' + timeFmt.format(start);
            if (end) text += '–' + timeFmt.format(end);
            return text;
        }
        // Multi-day: name both ends fully so a card never implies a same-day event.
        return dateFmt.format(start) + ', ' + timeFmt.format(start) + ' – ' + dateFmt.format(end) + ', ' + timeFmt.format(end);
    }

    // Whether the given calendar day (a Date at any time on that day) is one that
    // `event` touches. A standard half-open interval overlap check, so a multi-day
    // event (like a multi-day ride) matches every day it spans, not just its start.
    function dayIsWithinEvent(day, event) {
        var dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        var dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);
        var evStart = event.start;
        var evEnd = event.end || event.start;
        return evStart < dayEnd && evEnd > dayStart;
    }

    function buildEventCard(event) {
        var p = event.extendedProps;
        var color = colorForSeries(p.seriesId);
        var card = document.createElement('div');
        card.className = 'event-card';
        card.style.borderLeftColor = color;
        card.style.backgroundColor = 'color-mix(in oklab, ' + color + ' 14%, white)';

        var html = '';
        if (p.imageUrl) {
            html += '<img class="event-card-image" alt="" src="' + p.imageUrl + '">';
        }
        html += '<h3 class="event-card-title">' + escapeHtml(event.title) + '</h3>';
        html += '<p class="event-card-when">' + escapeHtml(formatWhen(event.start, event.end)) + '</p>';
        if (p.location) {
            html += '<p class="event-card-location">📍 ' + escapeHtml(p.location) + '</p>';
        }
        if (p.description) {
            html += '<p class="event-card-description">' + (p.descriptionHtml || escapeHtml(p.description)) + '</p>';
        }
        if (typeof p.userCount === 'number') {
            html += '<p class="event-card-count">' + p.userCount + (p.userCount === 1 ? ' person interested' : ' people interested') + '</p>';
        }
        html += '<a class="event-card-link" target="_blank" rel="noopener noreferrer" href="' + (p.discordUrl || '#') + '" style="background-color:' + color + '">View on Discord</a>';
        card.innerHTML = html;
        return card;
    }

    function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s == null ? '' : s;
        return div.innerHTML;
    }

    // Opens the popup listing every event that falls on the given Date's calendar day.
    function openDayDialog(day, triggerEl) {
        var dayEvents = calendar.getEvents()
            .filter(function (e) { return dayIsWithinEvent(day, e); })
            .sort(function (a, b) { return a.start - b.start; });
        if (!dayEvents.length) return;

        lastFocusedEl = triggerEl || document.activeElement;
        document.getElementById('event-dialog-heading').textContent = dayHeadingFmt.format(day);

        var container = document.getElementById('event-dialog-cards');
        container.innerHTML = '';
        dayEvents.forEach(function (event) {
            container.appendChild(buildEventCard(event));
        });

        dialog.showModal();
    }

    dialog.addEventListener('close', function () {
        if (lastFocusedEl && document.body.contains(lastFocusedEl)) lastFocusedEl.focus();
    });
    dialog.addEventListener('click', function (e) {
        if (e.target === dialog || e.target.id === 'event-dialog-close') dialog.close();
    });

    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        height: 'auto',
        firstDay: 0,
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        dayMaxEventRows: false, // bars are thin; show every day's bars, never a "+N more" link
        // FullCalendar's automatic display picks a compact "dot" style (a small inner
        // dot, not the bar itself) for any event confined to a single day -- forcing
        // "block" keeps every event a plain colored bar regardless of that heuristic.
        eventDisplay: 'block',

        // Builds "September Events 2026" instead of the default "September 2026".
        // (Tried rewriting the rendered .fc-toolbar-title text directly first, but
        // FullCalendar renders its UI with Preact internally; mutating a Preact-owned
        // DOM node from outside its own render cycle desyncs its virtual-DOM
        // bookkeeping, and titles started accumulating on every month change instead
        // of replacing. titleFormat is FullCalendar's own supported customization
        // point for this and doesn't have that problem.)
        titleFormat: function (arg) {
            // arg.date.marker represents this calendar date as midnight UTC, regardless
            // of the visitor's own timezone (FullCalendar's internal convention, so a
            // date isn't shifted by DST). Formatting with the local zone instead of UTC
            // would roll midnight UTC back to the evening before in most US timezones,
            // showing the wrong month.
            var month = new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(arg.date.marker);
            var year = new Intl.DateTimeFormat(undefined, { year: 'numeric', timeZone: 'UTC' }).format(arg.date.marker);
            return month + ' Events ' + year;
        },

        // Suppress FullCalendar's default title+time rendering in favor of just the
        // title, in white, truncated with an ellipsis rather than ever overflowing
        // the bar (see .event-bar-label in events.css).
        eventContent: function (arg) {
            var label = document.createElement('span');
            label.className = 'event-bar-label';
            label.textContent = arg.event.title;
            return { domNodes: [label] };
        },

        events: function (fetchInfo, successCallback, failureCallback) {
            document.getElementById('events-error').hidden = true;
            fetch('/api/events?start=' + encodeURIComponent(fetchInfo.startStr) + '&end=' + encodeURIComponent(fetchInfo.endStr))
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (events) {
                    document.getElementById('events-empty').hidden = events.length !== 0;
                    successCallback(events.map(function (e) {
                        var color = colorForSeries(e.seriesId);
                        return {
                            id: e.id,
                            title: e.title,
                            start: e.start,
                            end: e.end || undefined,
                            backgroundColor: color,
                            borderColor: color,
                            extendedProps: {
                                seriesId: e.seriesId, description: e.description, descriptionHtml: e.descriptionHtml, location: e.location,
                                imageUrl: e.imageUrl, discordUrl: e.discordUrl,
                                userCount: e.userCount, isRecurring: e.isRecurring,
                            },
                        };
                    }));
                })
                .catch(function (err) {
                    console.error('Failed to load events:', err);
                    document.getElementById('events-error').hidden = false;
                    failureCallback(err);
                });
        },

        // Clicking a dot opens that day's card list. A multi-day event renders its own
        // dot in every day cell it spans, so "which day" has to come from the specific
        // cell that was clicked (its data-date), not the event's own (possibly earlier)
        // start date -- otherwise clicking a later day's dot would show the wrong day.
        eventClick: function (info) {
            var cell = info.el.closest('[data-date]');
            var day = cell ? new Date(cell.getAttribute('data-date') + 'T00:00:00') : info.event.start;
            openDayDialog(day, info.el);
        },
        // ...and so does clicking anywhere else on a day that has events.
        dateClick: function (info) {
            openDayDialog(info.date, info.dayEl);
        },
    });

    calendar.render();

    // Swipe left/right on the calendar itself (not the page) to change months,
    // matching the same swipe pattern used for the zine slideshow.
    var touchStartX = 0;
    var touchStartY = 0;

    calendarEl.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    calendarEl.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - touchStartX;
        var dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) calendar.next(); // swipe left -> next month
            else calendar.prev(); // swipe right -> previous month
        }
    }, { passive: true });
})();
