export const documents = [
  {
    id: 'scoring',
    title: 'Coverage gap and undefined references',
    url: 'https://source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge',
    text: 'For a defined reference, gap = 1 − min(1, Overture/reference). Zero reference makes a component undefined. Average only defined components for the composite. A missing denominator does not mean complete mapping. Hospitals are excluded from scored facilities.',
  },
  {
    id: 'roads',
    title: 'Named-highway comparison',
    url: 'https://zindi.world/competitions/bias-bounty-mapping-equity-challenge',
    text: 'Compare TIGER S1100 and S1200 with Overture motorway, trunk, primary and secondary roads. The two sources use different class boundaries. Road gaps should not be compared across regions. This baseline clips road segments to tract boundaries before measuring length.',
  },
  {
    id: 'buildings',
    title: 'Buildings and places',
    url: 'https://source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge',
    text: 'Building gaps compare Overture footprints with Microsoft structures; ACS housing units are only a sanity check. Facilities compare fire stations, EMS and schools by type. The other places component compares all Overture places with allocated County Business Patterns establishments.',
  },
  {
    id: 'equity',
    title: 'Interpreting group differences',
    url: 'https://zindi.world/learn/what-is-the-bias-score-a-guide-to-zindi-s-new-bias-scorecard',
    text: 'A disparity ratio divides the mean gap of one group by a comparison group. A ratio above one indicates a larger measured gap. Report group sizes and unknown membership. Association is not causation. This application uses its own documented group thresholds; its comparisons are not the official Bias Score API.',
  },
  {
    id: 'baseline',
    title: 'Prototype methodology and limits',
    url: 'https://github.com/nishokvg/equity-challenge',
    text: 'This independent baseline assigns buildings to a tract by point-on-surface, counts intersecting facilities, clips named highways and measures geodesic metres. SVI ≥ 0.75 defines high vulnerability. RUCA primary code ≥ 4 defines rural. Maps use simplified tract outlines for display only. Regional export is not a complete four-region competition submission. No leaderboard RMSE has been measured.',
  },
  {
    id: 'provenance',
    title: 'Release, provenance, and source limits',
    url: 'https://zindi.world/competitions/bias-bounty-mapping-equity-challenge/data',
    text: 'The dataset is pinned to Overture release 2026-08-19.0. GEOID must remain text to retain leading zeros. Inputs use OGC:CRS84 longitude-latitude coordinates. Reference sources can contain errors and different vintages; apparent coverage gaps warrant review and do not prove that physical services are absent.',
  },
];
export function retrieve(query: string, limit = 3) {
  const tokens = [...new Set(query.toLowerCase().match(/[a-z]{3,}/g) ?? [])];
  return documents
    .map((doc) => ({
      ...doc,
      relevance: tokens.reduce(
        (score, t) =>
          score +
          ((doc.title + ' ' + doc.text).toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .filter((d) => d.relevance > 0)
    .slice(0, limit);
}
