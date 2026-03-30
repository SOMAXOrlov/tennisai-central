

## Recurring Events Support for Calendar

### Overview
Add the ability to create recurring events (daily, weekly, biweekly, monthly) with an end condition (number of occurrences or end date). Recurring events will be expanded at read-time into virtual instances, while stored as a single source event with recurrence metadata.

### Changes

**1. Update types (`src/types/index.ts`)**
- Add `RecurrenceRule` interface with fields: `frequency` (`daily` | `weekly` | `biweekly` | `monthly`), `endType` (`count` | `until` | `never`), `count?`, `until?`
- Add optional `recurrence?: RecurrenceRule` and `recurrenceParentId?: string` fields to `CalendarEvent`

**2. Update mock store (`src/mock/store.ts`)**
- In `getCalendarEvents()`, expand recurring events into virtual instances (generate occurrences from the source event's recurrence rule up to a reasonable horizon, e.g. 90 days)
- Each virtual instance gets a deterministic ID like `{parentId}_occ_{index}` so updates/deletes can target them
- When updating/deleting a recurring instance, support "this event only" (creates an exception) vs "all events" (modifies the parent)

**3. Update calendar form (`src/pages/CalendarPage.tsx` — `EventFormDialog`)**
- Add recurrence section to the form: frequency selector (None, Daily, Weekly, Biweekly, Monthly) and end condition (After N occurrences / Until date / Never)
- Add `recurrence` fields to `EventFormData`
- Pass recurrence data through `handleSave` to the create/update mutations

**4. Update event detail drawer (`src/pages/CalendarPage.tsx` — `EventDetailDrawer`)**
- Show a "Repeats: Weekly" (or similar) indicator when event has recurrence
- Add a `Repeat` icon from lucide-react
- When editing/deleting a recurring instance, show a choice dialog: "This event only" or "All events in series"

**5. Update event display (`EventChip`)**
- Add a small repeat icon indicator on recurring event chips so users can visually distinguish them

**6. Update calendar API (`src/api/endpoints/calendar.ts`)**
- Pass recurrence data through create/update calls (no structural change needed since it's mock-backed)

### Technical Details

- **Occurrence expansion**: A utility function `expandRecurrence(event, horizonStart, horizonEnd)` generates date-shifted copies. Each copy preserves duration but shifts start/end by the frequency interval.
- **Edit/delete scope**: When acting on a recurring instance, a confirmation dialog asks "This event" vs "All events". "This event" stores an exception date on the parent; "All events" modifies/deletes the parent.
- **Form state**: Recurrence defaults to "None". Selecting a frequency reveals the end-condition fields.
- **No new dependencies** — pure date-fns arithmetic.

