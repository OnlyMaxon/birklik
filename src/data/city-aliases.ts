const CITY_ALIASES: Record<string, string> = {
  // Qəbələ
  gebele: 'Qəbələ',
  gabala: 'Qəbələ',
  kabala: 'Qəbələ',
  qebele: 'Qəbələ',
  // Gəncə
  ganja: 'Gəncə',
  gence: 'Gəncə',
  gyanja: 'Gəncə',
  // Sumqayıt
  sumgait: 'Sumqayıt',
  sumqayit: 'Sumqayıt',
  sumgayit: 'Sumqayıt',
  // Şəki
  sheki: 'Şəki',
  seki: 'Şəki',
  shaki: 'Şəki',
  // Lənkəran
  lankaran: 'Lənkəran',
  lenkaran: 'Lənkəran',
  // Naxçıvan
  nakhchivan: 'Naxçıvan',
  naxcivan: 'Naxçıvan',
  nakhichevan: 'Naxçıvan',
  // Şirvan
  shirvan: 'Şirvan',
  // Quba
  guba: 'Quba',
  // İsmayıllı
  ismailli: 'İsmayıllı',
  ismayilli: 'İsmayıllı',
  ismaili: 'İsmayıllı',
  // Şamaxı
  shamakhi: 'Şamaxı',
  shamaki: 'Şamaxı',
  samaxi: 'Şamaxı',
  // Şuşa
  shusha: 'Şuşa',
  shushi: 'Şuşa',
  // Mingəçevir
  mingachevir: 'Mingəçevir',
  mingecevir: 'Mingəçevir',
  mingeçevir: 'Mingəçevir',
  // Yevlax
  yevlakh: 'Yevlax',
  yevlak: 'Yevlax',
  // Zaqatala
  zagatala: 'Zaqatala',
  zagатала: 'Zaqatala',
  // Balakən
  balakan: 'Balakən',
  balaken: 'Balakən',
  // Cəlilabad
  jalilabad: 'Cəlilabad',
  djalilabad: 'Cəlilabad',
  // Masallı
  masally: 'Masallı',
  masali: 'Masallı',
  masalli: 'Masallı',
  // Neftçala
  neftchala: 'Neftçala',
  neftcala: 'Neftçala',
  // Şəmkir
  shamkir: 'Şəmkir',
  semkir: 'Şəmkir',
  shamkur: 'Şəmkir',
  // Göyçay
  goychay: 'Göyçay',
  goycay: 'Göyçay',
  geokchay: 'Göyçay',
  // Saatlı
  saatly: 'Saatlı',
  saatli: 'Saatlı',
  // Ağdam
  agdam: 'Ağdam',
  // Ağstafa
  agstafa: 'Ağstafa',
  // Gədəbəy
  gedabey: 'Gədəbəy',
  gadabay: 'Gədəbəy',
  // Kürdəmir
  kurdamir: 'Kürdəmir',
  kürdemir: 'Kürdəmir',
  // Beyləqan
  beylagan: 'Beyləqan',
  beylagen: 'Beyləqan',
  // Şabran
  shabran: 'Şabran',
  // Qax
  gakh: 'Qax',
  qakh: 'Qax',
  // Oğuz
  oghuz: 'Oğuz',
  oguz: 'Oğuz',
  // Füzuli
  fuzuli: 'Füzuli',
  // Daşkəsən
  dashkasan: 'Daşkəsən',
  daskesen: 'Daşkəsən',
  // İmişli
  imishli: 'İmişli',
  imisli: 'İmişli',
  // Lerik
  lerik: 'Lerik',
  // Biləsuvar
  bilasuvar: 'Biləsuvar',
  bilsuvar: 'Biləsuvar',
}

/**
 * Replaces known English/Russian city transliterations with official Azerbaijani names.
 * Used before geocoding API calls.
 */
export function resolveCity(query: string): string {
  const lower = query.toLowerCase().trim()
  if (CITY_ALIASES[lower]) return CITY_ALIASES[lower]
  for (const [alias, official] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) {
      return query.replace(new RegExp(alias, 'gi'), official)
    }
  }
  return query
}

/**
 * Returns original query + official Azerbaijani name if an alias is found.
 * Used for client-side search filtering to match both spellings.
 */
export function expandSearchTerms(query: string): string[] {
  const terms = [query.toLowerCase()]
  const lower = query.toLowerCase().trim()
  for (const [alias, official] of Object.entries(CITY_ALIASES)) {
    if (lower === alias || lower.includes(alias)) {
      const officialLower = official.toLowerCase()
      if (!terms.includes(officialLower)) terms.push(officialLower)
    }
  }
  return terms
}
