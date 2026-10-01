# Validation record

Validated on Node 24.19.0.

- `npm test`: all six integration tests pass, including report image upload, private proof-image access for both parties, image metadata removal, item pin storage, recovery permissions and signup/session behavior.
- `npm run build`: production React build passes. Mapbox is loaded as a separate lazy chunk so the list view does not download the map engine.
- `npm run db:seed`: sample bootstrap passes with campus map pins.
- Existing-schema migration check: opening an older database adds nullable latitude / longitude and photo-reference columns.
- Report detail no longer starts a second Mapbox WebGL instance inside the modal; the exact location is shown with a control that opens and centers the board map.
- Run `npm run dev` to preview the current glass UI and Mapbox view.

The browser geolocation control is opt-in and permission-gated. Mapbox tiles and device geolocation require a network connection; browser geolocation requires HTTPS outside `localhost`. SMTP delivery and public internet deployment were not exercised. Local email verification uses a terminal link.
