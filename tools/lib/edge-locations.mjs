// mvcprogrammer.com — tools/lib/edge-locations.mjs
// Maps the three-letter code at the front of a CloudFront edge location ("FRA56-P1" is FRA) to the
// ISO 3166-1 alpha-2 code of the country the edge sits in. The codes are IATA airport codes, which
// is why a visitor served from HIO (Hillsboro, Oregon) or QRO (Querétaro) shows up as US or MX. The
// table covers every code the logs have shown plus the rest of the network as published by AWS; a
// code that is not here reports as "??" and the raw code is kept in byEdge, so it can be added.

/** Edge code to country. Grouped by region, alphabetical inside each group. */
const COUNTRY_BY_EDGE = new Map(Object.entries({
  // North America
  ATL: 'US', BOS: 'US', BUF: 'US', CMH: 'US', DEN: 'US', DFW: 'US', DTW: 'US', EWR: 'US', HIO: 'US',
  IAD: 'US', IAH: 'US', IND: 'US', JAX: 'US', JFK: 'US', LAS: 'US', LAX: 'US', MCI: 'US', MIA: 'US',
  MSP: 'US', ORD: 'US', PDX: 'US', PHL: 'US', PHX: 'US', PIT: 'US', SEA: 'US', SFO: 'US', SLC: 'US',
  STL: 'US', TPA: 'US', YUL: 'CA', YTO: 'CA', YVR: 'CA', YYZ: 'CA', YYC: 'CA', MEX: 'MX', QRO: 'MX',
  // South America
  BOG: 'CO', EZE: 'AR', FOR: 'BR', GIG: 'BR', GRU: 'BR', LIM: 'PE', SCL: 'CL',
  // Europe
  AMS: 'NL', ARN: 'SE', ATH: 'GR', BCN: 'ES', BER: 'DE', BRU: 'BE', BUD: 'HU', CDG: 'FR', CPH: 'DK',
  DUB: 'IE', DUS: 'DE', FCO: 'IT', FRA: 'DE', HAM: 'DE', HEL: 'FI', LHR: 'GB', LIS: 'PT', MAD: 'ES',
  MAN: 'GB', MRS: 'FR', MUC: 'DE', MXP: 'IT', OSL: 'NO', OTP: 'RO', PMO: 'IT', PRG: 'CZ', SOF: 'BG',
  TXL: 'DE', VIE: 'AT', WAW: 'PL', ZAG: 'HR', ZRH: 'CH',
  // Middle East and Africa
  BAH: 'BH', CAI: 'EG', CPT: 'ZA', DXB: 'AE', FJR: 'AE', JNB: 'ZA', LOS: 'NG', MCT: 'OM', NBO: 'KE',
  TLV: 'IL',
  // Asia and Oceania
  AKL: 'NZ', BKK: 'TH', BLR: 'IN', BOM: 'IN', CCU: 'IN', CGK: 'ID', DEL: 'IN', HAN: 'VN', HKG: 'HK',
  HYD: 'IN', ICN: 'KR', KIX: 'JP', KUL: 'MY', MAA: 'IN', MEL: 'AU', MNL: 'PH', NRT: 'JP', PEK: 'CN',
  PER: 'AU', PNQ: 'IN', PVG: 'CN', SGN: 'VN', SIN: 'SG', SYD: 'AU', SZX: 'CN', TPE: 'TW',
}));

/** The country for an edge code, or "??" when the code is unknown. */
export function countryOfEdge(code) {
  return COUNTRY_BY_EDGE.get(code) ?? '??';
}
