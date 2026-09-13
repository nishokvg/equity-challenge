# Data sources and attribution

This repository's `data/northern-ca.json` is a derived snapshot of the public challenge data. It contains aggregates and simplified census-tract display paths, not the raw Overture or Microsoft feature layers. The source manifest records individual URLs and SHA-256 hashes. Downloaded raw files stay in ignored `data/raw/`.

- **Overture Maps buildings and transportation:** © Overture Maps Foundation and its sources, including OpenStreetMap contributors. ODbL. [Attribution and licensing](https://docs.overturemaps.org/attribution/).
- **Overture places:** CDLA Permissive 2.0; preserve Overture/source attribution.
- **Microsoft US Building Footprints:** Microsoft, Open Data Commons Open Database License (ODbL). [Repository and license](https://github.com/microsoft/USBuildingFootprints).
- **US Census TIGER/Line, CBP, and census tract/population data:** US Government public-domain sources.
- **USGS National Map structures (HIFLD successor):** US Government public-domain sources.
- **CDC Social Vulnerability Index and USDA RUCA:** public agency sources as supplied in the challenge package; retain their attribution and vintages.

Zindi's challenge page also states CC BY-SA 4.0 for challenge data. The [Source Cooperative README](https://source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge) lists source-specific licenses; the general challenge statement does not remove upstream conditions. Retain these notices, the source manifest, and applicable share-alike requirements when redistributing a derived database. Do not assume a future software license relicenses the data.

The initial prototype source has no blanket license grant. Choose a software license with the team after reviewing the competition's winning-solution assignment and code-sharing conditions. Do not publish private competition-team code to outsiders without following those rules.
