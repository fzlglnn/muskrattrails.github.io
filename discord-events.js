// Fetches the club's Discord "Scheduled Events" and expands them into calendar
// occurrences for a given date range. Used by the /api/events route in server.js.
//
// Configuration (environment variables):
//   DISCORD_BOT_TOKEN  - a bot token, from https://discord.com/developers/applications
//                        The bot just needs to be a member of the server; no special
//                        permission is required to read scheduled events.
//   DISCORD_GUILD_ID   - the numeric ID of the Discord server (right-click the server
//                        icon in Discord with Developer Mode on -> "Copy Server ID").
//   DISCORD_API_BASE   - optional override of the API root, only used by tests to
//                        point this module at a local stand-in instead of Discord.
//
// If the token or guild ID is missing, getEventsInRange() logs one warning and
// resolves to an empty list rather than throwing, so the rest of the site keeps
// working while Discord isn't configured yet.

const { RRule } = require('rrule');

const API_BASE = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';
const CACHE_MS = 10 * 60 * 1000; // how long a fetched event list is reused
const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000; // guard against absurdly large requested ranges

let cache = { fetchedAt: 0, raw: null };
let warnedNotConfigured = false;

function isConfigured() {
    return Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID);
}

// Talks to Discord (or, in tests, a stand-in server) and caches the raw event list.
async function fetchRawEvents() {
    const now = Date.now();
    if (cache.raw && now - cache.fetchedAt < CACHE_MS) {
        return cache.raw;
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    const url = `${API_BASE}/guilds/${guildId}/scheduled-events?with_user_count=true`;
    const res = await fetch(url, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Discord API ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
    }

    const raw = await res.json();
    cache = { fetchedAt: now, raw };
    return raw;
}

// Discord's numbering (0=Monday..6=Sunday, ISO-8601 order -- NOT the 0=Sunday
// convention JS Date.getDay() uses) mapped to the RRule weekday constants it expects.
const WEEKDAY_BY_DISCORD_INDEX = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];
const FREQUENCY_BY_DISCORD_CODE = [RRule.YEARLY, RRule.MONTHLY, RRule.WEEKLY, RRule.DAILY];

// Converts a Discord `recurrence_rule` object into RRule constructor options.
function discordRuleToRRuleOptions(rule) {
    const options = {
        freq: FREQUENCY_BY_DISCORD_CODE[rule.frequency],
        interval: rule.interval || 1,
        dtstart: new Date(rule.start),
    };
    if (rule.end) options.until = new Date(rule.end);
    if (typeof rule.count === 'number') options.count = rule.count;

    if (Array.isArray(rule.by_weekday) && rule.by_weekday.length) {
        options.byweekday = rule.by_weekday.map((d) => WEEKDAY_BY_DISCORD_INDEX[d]);
    }
    if (Array.isArray(rule.by_n_weekday) && rule.by_n_weekday.length) {
        options.byweekday = rule.by_n_weekday.map((nw) => WEEKDAY_BY_DISCORD_INDEX[nw.day].nth(nw.n));
    }
    if (Array.isArray(rule.by_month_day) && rule.by_month_day.length) {
        options.bymonthday = rule.by_month_day;
    }
    if (Array.isArray(rule.by_month) && rule.by_month.length) {
        options.bymonth = rule.by_month;
    }
    return options;
}

function buildImageUrl(event) {
    if (!event.image) return null;
    return `https://cdn.discordapp.com/guild-events/${event.id}/${event.image}.png?size=512`;
}

function buildLocation(event) {
    if (event.entity_type === 3 /* EXTERNAL */) {
        return event.entity_metadata && event.entity_metadata.location || null;
    }
    return null; // voice/stage events: no separate location string, just the Discord link
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/g;

// Escapes an event's plain-text description and turns any URL in it into a
// clickable link labeled with just its domain (e.g. "facebook.com") instead
// of the full, often long, URL.
function buildDescriptionHtml(description) {
    if (!description) return '';
    const matches = [...description.matchAll(URL_RE)];
    if (!matches.length) return escapeHtml(description);

    let html = '';
    let lastIndex = 0;
    matches.forEach((m) => {
        html += escapeHtml(description.slice(lastIndex, m.index));
        const url = m[0];
        let label = url;
        try {
            label = new URL(url).hostname.replace(/^www\./, '');
        } catch {
            // Malformed URL text; fall back to showing it verbatim.
        }
        html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
        lastIndex = m.index + url.length;
    });
    html += escapeHtml(description.slice(lastIndex));
    return html;
}

// Turns one Discord scheduled-event object into zero or more calendar occurrences
// that fall within [rangeStart, rangeEnd).
function expandOccurrences(event, rangeStart, rangeEnd) {
    const guildId = process.env.DISCORD_GUILD_ID || event.guild_id;
    const base = {
        seriesId: event.id,
        title: event.name,
        description: event.description || '',
        descriptionHtml: buildDescriptionHtml(event.description),
        location: buildLocation(event),
        imageUrl: buildImageUrl(event),
        discordUrl: `https://discord.com/events/${guildId}/${event.id}`,
        userCount: typeof event.user_count === 'number' ? event.user_count : null,
        isRecurring: Boolean(event.recurrence_rule),
    };

    const durationMs = event.scheduled_end_time
        ? new Date(event.scheduled_end_time) - new Date(event.scheduled_start_time)
        : null;

    if (!event.recurrence_rule) {
        const start = new Date(event.scheduled_start_time);
        if (start >= rangeStart && start < rangeEnd) {
            return [{
                ...base,
                id: event.id,
                start: start.toISOString(),
                end: durationMs != null ? new Date(start.getTime() + durationMs).toISOString() : null,
            }];
        }
        return [];
    }

    let rule;
    try {
        rule = new RRule(discordRuleToRRuleOptions(event.recurrence_rule));
    } catch (e) {
        console.warn(`Could not parse recurrence rule for event ${event.id}:`, e.message);
        return [];
    }

    return rule.between(rangeStart, rangeEnd, true).map((occurrenceStart) => ({
        ...base,
        id: `${event.id}-${occurrenceStart.toISOString()}`,
        start: occurrenceStart.toISOString(),
        end: durationMs != null ? new Date(occurrenceStart.getTime() + durationMs).toISOString() : null,
    }));
}

// Returns every occurrence (including expanded recurring events) that falls within
// [rangeStart, rangeEnd), sorted by start time.
async function getEventsInRange(rangeStart, rangeEnd) {
    if (!(rangeStart instanceof Date) || !(rangeEnd instanceof Date) || isNaN(rangeStart) || isNaN(rangeEnd)) {
        throw new Error('rangeStart and rangeEnd must be valid Dates');
    }
    if (rangeEnd <= rangeStart) throw new Error('rangeEnd must be after rangeStart');
    if (rangeEnd - rangeStart > MAX_RANGE_MS) throw new Error('requested range is too large');

    if (!isConfigured()) {
        if (!warnedNotConfigured) {
            console.warn('DISCORD_BOT_TOKEN / DISCORD_GUILD_ID not set: /api/events will return no events.');
            warnedNotConfigured = true;
        }
        return [];
    }

    const raw = await fetchRawEvents();
    const occurrences = raw.flatMap((event) => expandOccurrences(event, rangeStart, rangeEnd));
    occurrences.sort((a, b) => a.start.localeCompare(b.start));
    return occurrences;
}

module.exports = { getEventsInRange, isConfigured, expandOccurrences, discordRuleToRRuleOptions };
