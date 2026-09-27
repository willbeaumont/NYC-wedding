# New York Wedding Itinerary

A dependency-free, responsive single-page guide for guests arriving in New York on Wednesday, October 7, 2026 and attending the wedding celebration on Friday, October 9, 2026.

## Design

The page pairs an editorial wedding aesthetic with New York visual cues. A deep green, parchment, brass, and muted rose palette supports custom CSS skyline and venue illustrations, so there are no remote images, fonts, scripts, or runtime package dependencies. The responsive CSS starts with narrow-screen, single-column defaults and progressively enhances the layout at `561px` and `821px`. Semantic landmarks, clear heading structure, visible keyboard focus, touch-friendly controls, print styles, and reduced-motion behavior keep the guide practical as well as polished.

JavaScript is progressive enhancement only. It adds an event countdown, marks the current itinerary date, enables copy-address feedback, requests an event-week forecast when available, and manages the theme control. All event details, travel instructions, addresses, static weather guidance, and direct map and forecast links remain available without JavaScript.

## Weather forecast

The weather section covers New York City for October 7 through October 9, 2026. When all three dates are inside the provider's supported 16-day window, the browser requests only daily weather code, high and low temperature, and maximum precipitation probability from the no-key [Open-Meteo forecast API](https://open-meteo.com/). The fixed request coordinates are `40.7128,-74.0060`, the time zone is `America/New_York`, and temperatures are displayed in Fahrenheit.

The site does not call the provider before the complete event range can fit in its forecast horizon. Until live data is available, each card shows rounded planning estimates of about 68°F high, 54°F low, and a 30% precipitation chance, clearly labeled `Typical estimate` and described as New York City October climate normals rather than a date-specific forecast. Live data changes each updated card's label to `Live forecast`, and the status message names Open-Meteo and shows the New York date and time of the last successful update.

The browser continues requesting forecasts through October 9. Once an event date has passed, a new page load requests only the remaining dates so the provider is never asked for expired forecast days; those past-date cards retain their clearly labeled typical estimates. During the live forecast window, an open page refreshes every 30 minutes, reuses any request already in progress, and retains the last successfully rendered live values if a refresh fails. After October 9 the site makes no weather API request. Before the window opens, after the event, or when a request is offline, blocked by CORS, times out, receives an HTTP error, or returns malformed data, the widget keeps honest fallback copy, clearly identifies which cards are typical estimates or previously updated live forecasts, and provides a direct [National Weather Service New York forecast](https://forecast.weather.gov/MapClick.php?lat=40.7128&lon=-74.0060). Itinerary content never depends on either weather service.

No weather data, location permission, user-entered information, cookies, analytics, or account details are collected by this project. During the forecast window, the visitor's browser makes a direct HTTPS request to Open-Meteo for the fixed New York coordinates, so normal request metadata such as the visitor's IP address is visible to that provider under its own privacy practices.

## Dark mode

The light and dark palettes cover page surfaces, cards, controls, illustrations, status messages, focus indicators, print output, and responsive layouts. Before the stylesheet loads, a small local script applies a valid saved `light` or `dark` selection to prevent an obvious theme flash. If there is no saved selection, the page follows `prefers-color-scheme` and continues responding to operating-system theme changes. The accessible toggle keeps the stable name “Dark mode” while its pressed state announces whether that option is active. Using it creates an explicit selection in `localStorage`; storage access is guarded so restricted or private browsing contexts remain fully usable even when persistence is unavailable.

## Confirmed details and assumptions

- Guest arrival day is Wednesday, October 7, 2026.
- The wedding day is Friday, October 9, 2026.
- The civil ceremony is at 11:00 AM at the Manhattan Marriage Bureau, 141 Worth Street, New York, NY 10013, near City Hall.
- A celebration lunch at Keens Steakhouse, 72 West 36th Street, New York, NY 10018, follows the ceremony.
- A cocktail party begins at 8:00 PM on Friday at the newlyweds' apartment. Its address and arrival details remain private and will be shared separately.
- No exact lunch time, lodging plan, RSVP process, dress code, or other private couple details have been assumed.
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

- `index.html`: Semantic page content, static fallbacks, early theme selection, and safe external links
- `styles.css`: Responsive light and dark visual systems, CSS artwork, accessibility, reduced motion, and print treatment
- `script.js`: Optional forecast, theme, countdown, date emphasis, and address-copy enhancements
- `scripts/validate.js`: Dependency-free production validation for core content, weather, and theme contracts
- `scripts/serve.js`: Small local static server
- `tests/site.test.js`: Node built-in tests with controlled DOM, fetch, media-query, and storage doubles

## Updating content

Edit confirmed wording and itinerary details in `index.html`. If the wedding date or time changes, also update `WEDDING_DATE` and `EVENT_DATES` in `script.js` and the matching assertions in `tests/site.test.js`. Keep full street addresses in map URLs, preserve `target="_blank" rel="noopener noreferrer"` on external links, and avoid adding unconfirmed timing or guest details.
