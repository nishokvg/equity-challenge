# Baseline methodology

Version: `independent-baseline-v1`. Scope: Northern California only. Sources: [challenge](https://zindi.world/competitions/bias-bounty-mapping-equity-challenge), [data README](https://source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge), and [bias scorecard guide](https://zindi.world/learn/what-is-the-bias-score-a-guide-to-zindi-s-new-bias-scorecard). Retrieved September 13, 2026 UTC (September 12 PT).

## Membership and provenance

The regional sample-submission CSV is authoritative. Its 591 GEOIDs remain 11-character strings. The script requires exactly one output row per sample ID. It does not read sample score columns, learn from leaderboard scores, or use external datasets. Overture inputs are pinned to release `2026-08-19.0`. Each input has a URL, size and SHA-256 digest in the output manifest.

## Spatial assignment

- All analytical geometry uses original GeoParquet coordinates (OGC:CRS84, longitude/latitude). Tract and building polygons are repaired with `ST_MakeValid` when needed.
- Buildings use `ST_PointOnSurface` and intersecting tract membership. Points on a shared boundary are assigned to the lexicographically smallest GEOID, so a feature is not counted twice. This assignment is an explicit baseline choice and has not been reconciled with the organizer implementation.
- POIs and reference facilities use point-in-tract intersection with the same tie break.
- Only Overture motorway/trunk/primary/secondary roads and TIGER S1100/S1200 are scored. Lines are clipped to each tract and measured in geodesic metres. DuckDB's spheroid function receives flipped lat/lon coordinates. A shared-boundary road can contribute to both neighboring tracts; investigate this if scores diverge from the leaderboard.
- CBP reference counts are the provided business-address-weighted `cbp_estab` values. Missing CBP rows fail the build rather than silently becoming zero.
- Simplified polygons (0.002 degree tolerance) become SVG paths for display. Simplification never enters the calculations.

## Score

For valid nonnegative observations and a positive reference, `gap = 1 - min(1, observed/reference)`. A zero reference yields null (undefined), including when observed is positive. Overcoverage is capped at zero gap; it does not prove correct alignment or complete feature matching.

1. Road gap: named-highway lengths.
2. Building gap: Overture/Microsoft footprint counts. Housing units are not substituted for structures.
3. Facilities half: mean of defined fire, EMS, and school gaps, matched by primary category. Hospitals are excluded.
4. Establishments half: all Overture places / supplied CBP establishments.
5. Places gap: mean of the defined facilities and establishments halves.
6. Composite: mean of defined road, building, and places gaps. A scored tract with no defined components fails the build.

Undefined values remain null internally. The CSV exports only GEOID and the defined composite score, preserving the authoritative sample order and avoiding blank optional columns.

## Group comparisons

The prototype defines rural as covered RUCA primary code ≥4 and urban as covered code <4. High vulnerability means valid, covered SVI ≥0.75; lower vulnerability means <0.75. These are explicitly chosen demo thresholds, not a claim to reproduce the official Bias Score API. Null and uncovered group values are excluded and counted. Means weight each defined tract equally, not by population. Ratios are undefined for empty groups or a zero comparison-group mean. Groups below 10 defined tracts are flagged.

Differences are descriptive associations. Geography, reference vintages, road-class definitions and mapping sources may explain them. Do not infer discrimination, absent real-world services, or emergency access time from the composite. No hazard-specific or causal finding is claimed.

## Validation

Formula consistency: TypeScript recalculates all component and composite gaps from the same aggregated counts used by Python, to tolerance 1e-9. This does not independently validate spatial joins, clipping, or the counting of geographic features. Further checks cover membership, uniqueness, valid observations, bounds, and undefined roads, buildings, facilities, establishments, and places. Unit tests exercise missing facilities/establishments too. These checks establish internal consistency, not leaderboard accuracy. RMSE requires organizer evaluation and has not been obtained.
