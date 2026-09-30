// Unit tests for discord-events.js's pure logic: the recurrence-rule conversion
// and per-event occurrence expansion. No network access and no Discord
// configuration needed -- these exercise expandOccurrences() and
// discordRuleToRRuleOptions() directly with hand-built event objects.
//
// Run with `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const { RRule } = require('rrule');
const { expandOccurrences, discordRuleToRRuleOptions } = require('./discord-events');

function weekdayUTC(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

test('discordRuleToRRuleOptions maps every Discord weekday index to the matching RRule weekday', () => {
    // Discord's by_weekday uses ISO-8601 order: 0=Monday..6=Sunday -- NOT
    // JS Date.getDay()'s 0=Sunday convention. Mixing these up was a real bug
    // that shipped (a "Tuesday" recurrence rendered as Monday); this pins
    // the correct mapping for all seven days so it can't regress silently.
    const expected = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
    for (let discordIndex = 0; discordIndex < 7; discordIndex++) {
        const options = discordRuleToRRuleOptions({
            frequency: 2, interval: 1, start: '2026-01-05T00:00:00.000Z',
            by_weekday: [discordIndex],
        });
        assert.deepEqual(options.byweekday, [expected[discordIndex]],
            `Discord weekday index ${discordIndex} should map to ${expected[discordIndex].toString()}`);
    }
});

test('discordRuleToRRuleOptions maps frequency, interval, until and count', () => {
    const options = discordRuleToRRuleOptions({
        frequency: 2, interval: 3, start: '2026-01-05T00:00:00.000Z',
        end: '2026-06-01T00:00:00.000Z', count: 5,
    });
    assert.equal(options.freq, RRule.WEEKLY);
    assert.equal(options.interval, 3);
    assert.equal(options.until.toISOString(), '2026-06-01T00:00:00.000Z');
    assert.equal(options.count, 5);
});

test('discordRuleToRRuleOptions maps by_n_weekday (nth weekday of month) and by_month_day/by_month', () => {
    // e.g. "the 2nd Tuesday" of the month
    const nth = discordRuleToRRuleOptions({
        frequency: 1, interval: 1, start: '2026-01-05T00:00:00.000Z',
        by_n_weekday: [{ day: 1, n: 2 }],
    });
    assert.deepEqual(nth.byweekday, [RRule.TU.nth(2)]);

    const monthly = discordRuleToRRuleOptions({
        frequency: 0, interval: 1, start: '2026-01-05T00:00:00.000Z',
        by_month_day: [15], by_month: [6],
    });
    assert.deepEqual(monthly.bymonthday, [15]);
    assert.deepEqual(monthly.bymonth, [6]);
});

function baseEvent(overrides = {}) {
    return {
        id: '111', guild_id: 'G1', name: 'Test Event', description: '',
        entity_type: 3, entity_metadata: { location: 'Columbia, MO' },
        scheduled_start_time: '2026-10-06T19:00:00.000Z',
        scheduled_end_time: '2026-10-06T21:00:00.000Z',
        image: null, user_count: 3, recurrence_rule: null,
        ...overrides,
    };
}

test('expandOccurrences returns a non-recurring event inside the requested range', () => {
    const [occ] = expandOccurrences(baseEvent(), new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'));
    assert.equal(occ.id, '111');
    assert.equal(occ.title, 'Test Event');
    assert.equal(occ.start, '2026-10-06T19:00:00.000Z');
    assert.equal(occ.end, '2026-10-06T21:00:00.000Z');
    assert.equal(occ.isRecurring, false);
    assert.equal(occ.userCount, 3);
    assert.equal(occ.discordUrl, 'https://discord.com/events/G1/111');
});

test('expandOccurrences omits a non-recurring event outside the requested range', () => {
    const occs = expandOccurrences(baseEvent(), new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'));
    assert.deepEqual(occs, []);
});

test('expandOccurrences never lets an event without a scheduled end produce an end time', () => {
    const [occ] = expandOccurrences(
        baseEvent({ scheduled_end_time: null }),
        new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(occ.end, null);
});

test('expandOccurrences: a weekly Tuesday recurrence lands on Tuesdays, not Mondays', () => {
    // Regression test for the real weekday-mapping bug (see the
    // discordRuleToRRuleOptions test above for the root cause).
    const event = baseEvent({
        scheduled_start_time: '2026-10-06T19:00:00.000Z', // a Tuesday
        recurrence_rule: {
            start: '2026-10-06T19:00:00.000Z', end: null, count: null,
            frequency: 2, interval: 1, by_weekday: [1] /* Discord Tuesday */,
            by_n_weekday: null, by_month: null, by_month_day: null,
        },
    });
    const occs = expandOccurrences(event, new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'));
    assert.ok(occs.length >= 3, 'expected multiple weekly occurrences in a month');
    for (const occ of occs) {
        assert.equal(weekdayUTC(occ.start), 'Tuesday', `${occ.start} should be a Tuesday`);
        assert.equal(occ.isRecurring, true);
        assert.match(occ.id, /^111-/);
    }
});

test('expandOccurrences warns and returns [] for an unparseable recurrence rule, instead of throwing', () => {
    const event = baseEvent({ recurrence_rule: { frequency: 99, interval: 1, start: '2026-10-06T19:00:00.000Z' } });
    const occs = expandOccurrences(event, new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'));
    assert.deepEqual(occs, []);
});

test('expandOccurrences builds an image URL only when the event has one', () => {
    const [withImage] = expandOccurrences(
        baseEvent({ image: 'abc123' }), new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(withImage.imageUrl, 'https://cdn.discordapp.com/guild-events/111/abc123.png?size=512');

    const [withoutImage] = expandOccurrences(
        baseEvent({ image: null }), new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(withoutImage.imageUrl, null);
});

test('expandOccurrences only reads location from EXTERNAL events, not voice/stage ones', () => {
    const [external] = expandOccurrences(
        baseEvent({ entity_type: 3, entity_metadata: { location: 'Columbia, MO' } }),
        new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(external.location, 'Columbia, MO');

    const [voice] = expandOccurrences(
        baseEvent({ entity_type: 2, entity_metadata: null }),
        new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(voice.location, null);
});

test('expandOccurrences turns a URL in the description into a clickable domain-labeled link, and escapes the rest', () => {
    const [occ] = expandOccurrences(
        baseEvent({ description: 'Sign up: https://www.facebook.com/events/123 & bring <snacks>!' }),
        new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(
        occ.descriptionHtml,
        'Sign up: <a href="https://www.facebook.com/events/123" target="_blank" rel="noopener noreferrer">facebook.com</a> &amp; bring &lt;snacks&gt;!',
    );
});

test('expandOccurrences turns a URL in the location into a clickable domain-labeled link too', () => {
    const [occ] = expandOccurrences(
        baseEvent({ entity_metadata: { location: 'https://www.instagram.com/p/xyz or Columbia, MO' } }),
        new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(
        occ.locationHtml,
        '<a href="https://www.instagram.com/p/xyz" target="_blank" rel="noopener noreferrer">instagram.com</a> or Columbia, MO',
    );
});

test('expandOccurrences leaves plain text (no URL) alone, just escaped', () => {
    const [occ] = expandOccurrences(
        baseEvent({ description: 'No links here, just <plain> text & stuff.' }),
        new Date('2026-10-01T00:00:00Z'), new Date('2026-11-01T00:00:00Z'),
    );
    assert.equal(occ.descriptionHtml, 'No links here, just &lt;plain&gt; text &amp; stuff.');
});
