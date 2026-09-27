// Order/arrival/etc. dates are calendar-only values (no meaningful
// time-of-day) — imported from Excel and stored as a UTC-midnight instant
// for that calendar day. Formatting them with the default
// toLocaleDateString() reads the viewer's LOCAL timezone, which shifts the
// displayed day backward for anyone west of UTC (e.g. a UTC-midnight
// March 22 shows as March 21 for a US-based viewer). Always format these
// with timeZone: "UTC" so the calendar day shown always matches the day
// that was actually stored, regardless of who's looking at it or where.
export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString(undefined, { timeZone: "UTC" });
}

// The opposite direction: when defaulting a form's date field to "today",
// we want the user's own local calendar day (their real today), not
// today's date in UTC — new Date().toISOString() would give the wrong day
// during the ~6-hour window each day where local time and UTC fall on
// different calendar dates. Built from local getters on purpose.
export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
