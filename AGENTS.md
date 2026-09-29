# Project working instructions

## Google Calendar implementation log

The user authorizes automatic Google Calendar logging when a substantial implementation in this project is completed, and updating those records for meaningful follow-up changes. Apply this during project work; no periodic polling is required.

- Log completed core features, major functional fixes, or substantial systems work after appropriate verification. Skip minor tweaks, visual adjustments, exploratory work, and ongoing coordination. Never label unverified work as verified.
- Use the connected user's primary Google Calendar, Asia/Seoul timezone, no guests, no notifications, private visibility, and transparent availability. Use a short five-minute event at completion time.
- Title: `[StarFighter_Maker] <concise implementation name>`.
- Description: 3–5 concise Korean lines covering the completed implementation, meaningful behavior changes, and actual verification results or limitations. Include the implementation date; include a commit reference when available. Do not include secrets or source code.
- Before creating an event, search for an existing record for this implementation within a bounded date range. Update the matching event for meaningful follow-up changes instead of creating duplicates. Preserve the original completion date and append a dated brief revision summary. Minor adjustments need no calendar update.
- Maintain `docs/calendar-implementation-log.json` after successful writes, recording implementation key, calendar ID, event ID, completion date, and last update date to support reliable future updates. Read the existing event before updating it. Do not create the index or claim success until a calendar write succeeds.
- Calendar recording and updates are already authorized by the user; do not ask for confirmation again. If the connector is unavailable or a write fails, report that logging is pending and do not claim it was recorded.
- In the final response for implementation work, briefly mention whether the calendar record was created, updated, or remains pending.
