/**
 * "Nearby" from the areas people type. Traqi has no map positions, so areas are grouped into
 * neighbourhoods people would call close. Same area counts most; same neighbourhood next.
 */
const CLUSTERS: string[][] = [
  ["ikeja", "allen", "opebi", "alausa", "oregun", "agidingbi", "ogba", "omole", "ojodu", "berger", "magodo", "isheri", "maryland", "anthony", "ilupeju", "ketu", "mile 12", "ojota", "kosofe", "gbagada", "ifako"],
  ["yaba", "surulere", "ebute metta", "akoka", "bariga", "somolu", "shomolu", "palmgrove", "onipanu", "mushin", "fadeyi", "jibowu", "sabo", "iwaya"],
  ["lekki", "ajah", "chevron", "vgc", "ikota", "sangotedo", "abraham adesanya", "awoyaya", "badore", "ikate", "osapa", "agungi", "jakande", "victoria island", "vi", "ikoyi", "oniru"],
  ["festac", "satellite", "amuwo", "mile 2", "ojo", "okokomaiko", "abule ado", "agboju", "kirikiri", "apapa", "ajegunle", "orile", "badagry"],
  ["ikorodu", "agric", "ijede", "igbogbo", "ebute", "owutu", "imota", "odogunyan"],
  ["egbeda", "idimu", "ikotun", "igando", "akowonjo", "dopemu", "agege", "iyana ipaja", "ipaja", "ayobo", "abule egba", "alimosho", "isheri olofin", "orile agege", "meiran", "alagbado"],
  ["ibadan", "bodija", "ring road", "challenge", "dugbe", "mokola", "ui", "agodi", "akobo"],
  ["abeokuta", "kuto", "panseke", "oke ilewo", "funaab", "camp", "asero", "ibara"],
  ["wuse", "maitama", "garki", "asokoro", "gwarinpa", "kubwa", "lugbe", "jabi", "utako", "life camp"],
  ["port harcourt", "rumuola", "trans amadi", "gra phase", "rumuokoro", "choba", "eliozu"],
];
export const areaKey = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const clusterOf = (s?: string) => { const a = areaKey(s); if (!a) return -1; return CLUSTERS.findIndex((c) => c.some((x) => a === x || a.includes(x) || x.includes(a))); };

/** 2 = same area, 1 = same neighbourhood, 0 = not known to be near. */
export function nearness(a?: string, b?: string): 0 | 1 | 2 {
  const x = areaKey(a), y = areaKey(b);
  if (!x || !y) return 0;
  if (x === y || x.includes(y) || y.includes(x)) return 2;
  const ca = clusterOf(x), cb = clusterOf(y);
  return ca >= 0 && ca === cb ? 1 : 0;
}
