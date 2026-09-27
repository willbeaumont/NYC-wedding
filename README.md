# New York Wedding Itinerary

A dependency-free, responsive single-page guide for guests arriving in New York on Wednesday, October 7, 2026 and attending the wedding celebration on Friday, October 9, 2026.

## Design

The page pairs an editorial wedding aesthetic with New York visual cues. A deep green, parchment, brass, and muted rose palette supports custom CSS skyline and venue illustrations, so there are no remote images, fonts, scripts, or runtime dependencies. Semantic landmarks, clear heading structure, visible keyboard focus, touch-friendly controls, print styles, and reduced-motion behavior keep the guide practical as well as polished.

JavaScript is progressive enhancement only. It adds an event countdown, marks the current itinerary date, and enables copy-address feedback. All event details, travel instructions, addresses, and map links remain available without JavaScript.

## Confirmed details and assumptions

- Guest arrival day is Wednesday, October 7, 2026.
- The wedding day is Friday, October 9, 2026.
- The civil ceremony is at 11:00 AM at the Manhattan Marriage Bureau, 141 Worth Street, New York, NY 10013, near City Hall.
- A celebration lunch at Keens Steakhouse, 72 West 36th Street, New York, NY 10018, follows the ceremony.
- No exact lunch time, lodging plan, RSVP process, dress code, or private couple details have been assumed.
- Transit routes and durations are practical estimates, not guarantees. Guests are directed to verify live MTA service on the travel day.

## Run locally

No installation is required beyond Node.js 18 or newer.

```bash
npm run build
npm test
npm run dev
```

`npm run dev` serves the project at `http://localhost:4173` by default. Set `PORT` to use a different port.

## Project structure

- `index.html`: Semantic page content and safe external links
- `styles.css`: Responsive visual system, CSS artwork, accessibility, and print treatment
- `script.js`: Optional countdown, date emphasis, and address-copy enhancement
- `scripts/validate.js`: Dependency-free production validation
- `scripts/serve.js`: Small local static server
- `tests/site.test.js`: Node built-in tests for critical content and page contracts

## Updating content

Edit confirmed wording and itinerary details in `index.html`. If the wedding date or time changes, also update `WEDDING_DATE` in `script.js` and the matching assertions in `tests/site.test.js`. Keep full street addresses in map URLs, preserve `target="_blank" rel="noopener noreferrer"` on external links, and avoid adding unconfirmed timing or guest details.
