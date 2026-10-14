/**
 * Which country (or topic) a provider group belongs to, read from its name. Ported from Countries.kt.
 * Providers file groups three ways:
 *  - by ISO code:      "AL| SPORT", "UK| SKY SPORTS"
 *  - by region + name: "EU | ALBANIA SPORTS", "AR| YEMEN LQ"
 *  - by language tag:  "[FR] FILMS", "[GE] SERIES"  (movie and series lists)
 * Groups that name no country (a brand, a sport, a part of the world) are filed under a topic instead.
 */

const plain = (s) => String(s || '').normalize('NFD').replace(/\p{Mn}+/gu, '').toUpperCase();
const BRACKET_TAGS = /\[[^\]]*]/g;
const LEADING_TAG = /^\W*([A-Za-z0-9+]{1,6})\s*\|\s*(.*)$/;
const LEADING_BRACKET = /^\s*\[([^\]]+)]\s*(.*)$/;

class GroupName {
  constructor(raw) {
    const lead = LEADING_BRACKET.exec(raw);
    const text = plain(((lead && lead[2]) || raw).replace(BRACKET_TAGS, ' '));
    const piped = lead ? null : LEADING_TAG.exec(text);
    this.bracketed = !!lead;
    this.tag = lead ? plain(lead[1]).trim() : (piped ? piped[1] : null);
    const body = piped ? piped[2] : text;
    this.words = ` ${[...body].map((c) => (/[\p{L}\p{N}]/u.test(c) ? c : ' ')).join('').replace(/ +/g, ' ').trim()} `;
  }

  has(word) { return this.words.includes(` ${word} `); }
}

const TABLE = `
AD Andorra|AE UAE|AF Afghanistan|AG Antigua and Barbuda|AL Albania|AM Armenia|AO Angola|AR Argentina|AT Austria|AU Australia|AZ Azerbaijan|
BA Bosnia|BB Barbados|BD Bangladesh|BE Belgium|BF Burkina Faso|BG Bulgaria|BH Bahrain|BI Burundi|BJ Benin|BN Brunei|BO Bolivia|BR Brazil|BS Bahamas|BT Bhutan|BW Botswana|BY Belarus|BZ Belize|
CA Canada|CD DR Congo|CF Central African Republic|CG Congo|CH Switzerland|CI Ivory Coast|CL Chile|CM Cameroon|CN China|CO Colombia|CR Costa Rica|CU Cuba|CV Cape Verde|CY Cyprus|CZ Czechia|
DE Germany|DJ Djibouti|DK Denmark|DM Dominica|DO Dominican Republic|DZ Algeria|EC Ecuador|EE Estonia|EG Egypt|ER Eritrea|ES Spain|ET Ethiopia|
FI Finland|FJ Fiji|FR France|GA Gabon|GB UK|GD Grenada|GE Georgia|GH Ghana|GM Gambia|GN Guinea|GQ Equatorial Guinea|GR Greece|GT Guatemala|GY Guyana|
HK Hong Kong|HN Honduras|HR Croatia|HT Haiti|HU Hungary|ID Indonesia|IE Ireland|IL Israel|IN India|IQ Iraq|IR Iran|IS Iceland|IT Italy|
JM Jamaica|JO Jordan|JP Japan|KE Kenya|KG Kyrgyzstan|KH Cambodia|KM Comoros|KP North Korea|KR South Korea|KW Kuwait|KZ Kazakhstan|
LA Laos|LB Lebanon|LC Saint Lucia|LI Liechtenstein|LK Sri Lanka|LR Liberia|LS Lesotho|LT Lithuania|LU Luxembourg|LV Latvia|LY Libya|
MA Morocco|MC Monaco|MD Moldova|ME Montenegro|MG Madagascar|MK North Macedonia|ML Mali|MM Myanmar|MN Mongolia|MO Macau|MR Mauritania|MT Malta|MU Mauritius|MV Maldives|MW Malawi|MX Mexico|MY Malaysia|MZ Mozambique|
NA Namibia|NE Niger|NG Nigeria|NI Nicaragua|NL Netherlands|NO Norway|NP Nepal|NZ New Zealand|OM Oman|
PA Panama|PE Peru|PG Papua New Guinea|PH Philippines|PK Pakistan|PL Poland|PR Puerto Rico|PS Palestine|PT Portugal|PY Paraguay|QA Qatar|
RO Romania|RS Serbia|RU Russia|RW Rwanda|SA Saudi Arabia|SC Seychelles|SD Sudan|SE Sweden|SG Singapore|SI Slovenia|SK Slovakia|SL Sierra Leone|SM San Marino|SN Senegal|SO Somalia|SR Suriname|SS South Sudan|SV El Salvador|SY Syria|SZ Eswatini|
TD Chad|TG Togo|TH Thailand|TJ Tajikistan|TL Timor-Leste|TM Turkmenistan|TN Tunisia|TR Turkey|TT Trinidad and Tobago|TW Taiwan|TZ Tanzania|
UA Ukraine|UG Uganda|US USA|UY Uruguay|UZ Uzbekistan|VA Vatican City|VE Venezuela|VN Vietnam|XK Kosovo|YE Yemen|ZA South Africa|ZM Zambia|ZW Zimbabwe`;

/** code -> {code, name} */
const COUNTRIES = new Map(TABLE.replace(/\n/g, '').split('|').map((s) => s.trim()).filter(Boolean).map((s) => [s.slice(0, 2), { code: s.slice(0, 2), name: s.slice(3) }]));

// Prefixes that look like an ISO code but are regions or tags in provider lists: the country is read from the name instead
const REGION_PREFIXES = new Set(['EU', 'AR', 'AS', 'AM', 'AF', 'AFR', 'ASIA', 'LA', 'LATAM', 'EXYU', 'KU', 'VIP', 'XX', '4K', '8K', 'TS', 'WT', 'RX', 'PPV', 'SU']);

// Other spellings providers use for a country: typos, the country in its own language, its language or people
const ALIASES = {
  US: ['USA', 'AMERICA', 'UNITED STATES'], GB: ['UK', 'BRITAIN', 'ENGLAND', 'SCOTLAND', 'WALES', 'UNITED KINGDOM'],
  AE: ['EMIRATES', 'UAE', 'UNITED ARAB EMIRATES'], SA: ['SAUDI'], KR: ['KOREA'], PH: ['PHILIPPINE', 'PHILIPPINES'],
  MY: ['MALASIA'], TH: ['THAILLAND'], CZ: ['CZECH', 'CZECHIA'], CD: ['DR CONGO'], CG: ['CONGO'],
  IL: ['ISRAEL'], CI: ['IVORY COAST', 'COTE D IVOIRE'], ET: ['ETHOPIA'], VN: ['VIET NAM'], IR: ['PERSIAN'],
  SG: ['SINGAPORE'], SK: ['SLOVAKIA'], PS: ['PALESTINE'], SY: ['SYRIA'], TL: ['TIMOR'], BN: ['BRUNEI'],
  RS: ['SRBIJA', 'SERBIAN'], HR: ['HRVATSKA', 'CROATIAN'], BA: ['BOSNIA', 'BOSNA'], SI: ['SLOVENIJA'],
  MK: ['MACEDONIA', 'MAKEDONIJA'], ME: ['CRNA GORA'], AL: ['SHQIPERI', 'SHQIPERIA', 'SHQIP', 'ALBANIAN'], XK: ['KOSOVA'],
  DE: ['DEUTSCHLAND', 'GERMAN'], FR: ['FRENCH'], IT: ['ITALIA', 'ITALIAN'], ES: ['ESPANA'], PL: ['POLSKA', 'POLISH'],
  NL: ['HOLLAND', 'NEDERLAND', 'DUTCH'], BE: ['BELGIE', 'BELGIQUE'], CH: ['SUISSE', 'SCHWEIZ'], AT: ['OSTERREICH'],
  SE: ['SVERIGE', 'SWEDISH'], NO: ['NORGE', 'NORWEGIAN'], DK: ['DANMARK', 'DANISH'], FI: ['SUOMI', 'FINNISH'],
  TR: ['TURK', 'TURKIYE', 'TURKEY', 'TURKISH'], RU: ['RUSSIAN'], RO: ['ROMANIAN'], BG: ['BULGARIAN'], HU: ['HUNGARIAN'],
  GR: ['GREEK', 'HELLAS'], BR: ['BRASIL'], MA: ['MAROC'], DZ: ['ALGERIE'], TN: ['TUNISIE'], SO: ['SOMALI'],
  IN: ['INDIAN', 'HINDI', 'TAMIL', 'TELUGU', 'PUNJABI', 'MALAYALAM', 'MARATHI', 'KANNADA', 'GUJARATI', 'BOLLYWOOD'], LK: ['SRI LANKA', 'SINHALA'],
  CV: ['CAPE VERDE', 'CABO VERDE'], DO: ['DOMINICAN', 'DOMINICANA'], VE: ['VENEZULA']
};

const SPELLINGS = (() => {
  const out = [];
  const seen = new Set();
  for (const c of COUNTRIES.values()) {
    for (const s of [plain(c.name), ...(ALIASES[c.code] || [])]) {
      const k = `${s}|${c.code}`;
      if (!seen.has(k)) { seen.add(k); out.push([s, c.code]); }
    }
  }
  return out;
})();

// Language tags of movie lists that are not the country's code, or that are another country's
const LANGUAGE_TAGS = { GE: 'DE', GER: 'DE', SW: 'SE', SWE: 'SE', KO: 'KR', KOR: 'KR', ALB: 'AL', 'PT-BR': 'BR', JAP: 'JP', UK: 'GB' };
// Bracketed tags that stand for a language or a region, though some are also a country's code
const LANGUAGES_NOT_COUNTRIES = new Set(['EN', 'AR', 'AF', 'KU', 'SC', 'LT', 'LA', 'AS', 'EU', 'XX']);

/** The country named first in the words (whole words only); of two names that start together the longer wins. */
function byName(words) {
  let best = null;
  for (const [spelling, code] of SPELLINGS) {
    const at = words.indexOf(` ${spelling} `);
    if (at < 0) continue;
    if (!best || at < best.at || (at === best.at && spelling.length > best.spelling.length)) best = { at, spelling, code };
  }
  return best ? best.code : null;
}

export function countryOf(groupName) {
  const name = new GroupName(groupName);
  const tag = name.tag;
  // Ex-Yugoslav lists are Serbian unless the group names another of the countries
  const exYu = (tag === 'EXYU' || name.has('EXYU') || name.has('EX YU')) ? 'RS' : null;
  // A language tag gives way to a country the group names: "[CH] CHINA" is China, not Switzerland
  if (name.bracketed) {
    return byName(name.words) || LANGUAGE_TAGS[tag]
      || (tag && tag.length === 2 && !LANGUAGES_NOT_COUNTRIES.has(tag) && COUNTRIES.has(tag) ? tag : null) || exYu;
  }
  if (tag && tag.length === 2 && !REGION_PREFIXES.has(tag)) {
    const c = COUNTRIES.get(tag === 'UK' ? 'GB' : tag);
    if (c) return c.code;
  }
  return byName(name.words) || exYu;
}

export const countryInfo = (code) => COUNTRIES.get(code) || null;

// ----------------------------------------------------------------------- topics
const topic = (id, name, glyph, mono = '') => ({ key: `T:${id}`, name, glyph, mono });

export const TOPICS = [
  topic('ENGLISH', 'English', 'clapper', 'EN'), topic('MULTI', 'Multi-lang', 'planet'), topic('ARABIC', 'Arabic', 'mask', 'AR'),
  topic('AFRICA', 'Africa', 'compass'), topic('LATIN', 'Latino', 'heart'), topic('ASIA', 'Asia', 'torii'), topic('KURDISH', 'Kurdish', 'flame', 'KU'),
  topic('NORDIC', 'Nordic', 'wand'), topic('BEIN', 'beIN Sports', 'trophy'), topic('NETFLIX', 'Netflix', 'layers', 'N'), topic('DISNEY', 'Disney+', 'layers', 'D+'),
  topic('PRIME', 'Prime Video', 'layers', 'P'), topic('HBO', 'HBO', 'layers', 'HBO'), topic('APPLE', 'Apple TV+', 'layers', 'TV+'), topic('SPORTS', 'Sports', 'trophy'),
  topic('MOVIES', 'Movies', 'clapper'), topic('KIDS', 'Kids', 'teddy'), topic('MUSIC', 'Music', 'note'), topic('NEWS', 'News', 'news'), topic('DOCS', 'Docs', 'compass'),
  topic('RELIGION', 'Religion', 'star'), topic('NONSTOP', '24/7', 'reel'), topic('UHD', '4K & 8K', 'sparkles', '4K'), topic('ADULT', 'Adult', 'ghost', '18'), topic('OTHER', 'Other', 'grid')
];

const T = (id) => TOPICS.find((t) => t.key === `T:${id}`);
const rule = (id, tags = [], words = []) => ({ topic: T(id), tags: new Set(tags), words });

// Tried in this order, first match wins: adult content is never filed elsewhere, then the language a movie list tags the
// group with, then the provider, then the region, then the kind.
const RULES = [
  rule('ADULT', ['XX', 'XXX'], ['ADULT', 'ADULTS', 'XXX']),
  rule('ENGLISH', ['EN', 'ENG', 'ENGLISH']),
  rule('MULTI', ['MULTI-LANG', 'MULTI LANG', 'MULTI', 'MULTILANG', 'MULTI-LANGUAGE']),
  rule('BEIN', [], ['BEIN']), rule('NETFLIX', [], ['NETFLIX']), rule('DISNEY', [], ['DISNEY']),
  rule('PRIME', [], ['AMAZON', 'PRIME VIDEO', 'PRIME']), rule('HBO', [], ['HBO']), rule('APPLE', [], ['APPLE']),
  rule('KURDISH', ['KU'], ['KURDISH', 'KURD', 'KURDISTAN', 'EZIDXAN']),
  rule('ARABIC', ['AR'], ['ARAB', 'ARABE', 'ARABIC', 'ARABIA', 'AR', 'RAMADAN', 'SHAHID', 'OSN', 'MBC', 'ROTANA']),
  rule('AFRICA', ['AF', 'AFR'], ['AFRICA', 'AFRICAN', 'AFRIQUE', 'DSTV']),
  rule('LATIN', ['LA', 'LATAM', 'LT'], ['LATINO', 'LATINA', 'LATIN', 'LATAM', 'CARIBBEAN', 'CARIBE']),
  rule('ASIA', ['AS', 'ASIA'], ['ASIA', 'ASIAN']),
  rule('NORDIC', ['SC', 'SCAN'], ['NORDIC', 'SCANDINAVE', 'SCANDINAVIA', 'SCANDINAVIAN']),
  rule('SPORTS', ['TS', 'WT', 'PPV'], ['SPORT', 'SPORTS', 'SPOR', 'PPV', 'UFC', 'FIFA', 'UEFA', 'F1', 'FORMULA', 'MOTOGP', 'OLYMPICS', 'EUROLEAGUE', 'FOOTBALL', 'SOCCER',
    'CRICKET', 'TENNIS', 'NBA', 'NFL', 'NHL', 'MLB', 'DAZN', 'ESPN', 'BOXING', 'WWE', 'GOLF', 'RACING']),
  rule('KIDS', [], ['KIDS', 'KID', 'CARTOON', 'CARTOONS', 'CHILDREN', 'INFANTIL', 'ENFANTS', 'KINDER', 'BAMBINI']),
  rule('MUSIC', [], ['MUSIC', 'MUSIK', 'MUSICA', 'MUSIQUE', 'RADIO']),
  rule('NEWS', [], ['NEWS', 'NOTICIAS', 'NACHRICHTEN']),
  rule('DOCS', [], ['DOCUMENTARY', 'DOCUMENTARIES', 'DOCUMENTRIES', 'DOCS', 'DOKU']),
  rule('RELIGION', [], ['ISLAMIC', 'CHRISTIAN', 'RELIGION', 'RELIGIOUS', 'QURAN', 'GOSPEL', 'CHURCH']),
  rule('MOVIES', [], ['CINEMA', 'MOVIE', 'MOVIES', 'FILM', 'FILMS', 'SERIES', 'VOD']),
  rule('NONSTOP', [], ['24 7']),
  rule('UHD', ['4K', '8K'], ['4K', '8K', 'UHD'])
];

export function topicOf(groupName) {
  const name = new GroupName(groupName);
  const hit = RULES.find((r) => (name.tag && r.tags.has(name.tag)) || r.words.some((w) => name.has(w)));
  return hit ? hit.topic : T('OTHER');
}

/** The tile a group is filed under: its country's code, or its topic's key */
export function tileKeyOf(groupName) {
  return countryOf(groupName) || topicOf(groupName).key;
}

/** The group's name without its country ("ALBANIA GJENERALE" as "GJENERALE"); left alone when nothing else remains */
export function withoutCountry(groupName, shown) {
  const code = countryOf(groupName);
  if (!code) return shown;
  const words = shown.split(' ').filter(Boolean);
  const plainWords = words.map((w) => [...plain(w)].filter((c) => /[\p{L}\p{N}]/u.test(c)).join(''));
  const spellings = SPELLINGS.filter((s) => s[1] === code).map((s) => s[0].split(' ').map((w) => [...w].filter((c) => /[\p{L}\p{N}]/u.test(c)).join(''))).sort((a, b) => b.length - a.length);
  for (const parts of spellings) {
    let at = -1;
    for (let i = 0; i + parts.length <= plainWords.length; i++) if (parts.every((p, j) => plainWords[i + j] === p)) { at = i; break; }
    if (at < 0) continue;
    const rest = [...words.slice(0, at), ...words.slice(at + parts.length)].join(' ').trim().replace(/^[\s\-–|:/]+|[\s\-–|:/]+$/g, '');
    return rest || shown;
  }
  return shown;
}
