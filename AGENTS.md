# Gogocho workspace instructions

- Use British English.
- Comment code extensively: explain module responsibilities, function contracts, data flow, validation, asynchronous lifecycles and non-obvious choices. Keep comments aligned with behaviour; document strict JSON fields in README.md rather than adding invalid JSON comments.
- All films, screenings, prices and bookings are fictional. Make this visible in the interface.
- Use original catalogue content. Do not add external film metadata, posters or listings without checking AI-use and redistribution terms.
- Keep provider keys server-side and outside Git. The browser may receive only a temporary voice token.
- Keep screening times, identifiers, ticket quantities and confirmation state validated in code.
- Update README.md, docs/PROGRESS.md and the linked Obsidian project notes when project logic changes.
- Run npm test and npm run check before committing. Record live-provider checks separately from simulated tests.
- Commit completed, verified changes when appropriately scoped. Push only to an established, authorised remote; report the decision.
