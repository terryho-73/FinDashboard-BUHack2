/**
 * Hong Kong general holidays (公眾假期 / red days), gazetted by the HKSAR Government.
 * Source: https://www.gov.hk/en/about/abouthk/holiday/ (2024–2027 lists)
 * Substitution rules for Sundays are already reflected in these dates (not computed here).
 */

export type HkPublicHoliday = {
  date: string
  en: string
  zh: string
}

/** Flat gazetted list — one row per statutory general holiday (excluding “every Sunday”). */
const GAZETTED_HOLIDAYS: HkPublicHoliday[] = [
  // 2024 — https://www.gov.hk/en/about/abouthk/holiday/2024.htm
  { date: "2024-01-01", en: "New Year's Day", zh: "一月一日（元旦）" },
  { date: "2024-02-10", en: "Lunar New Year's Day", zh: "農曆年初一" },
  { date: "2024-02-11", en: "The second day of Lunar New Year", zh: "農曆年初二" },
  { date: "2024-02-12", en: "The third day of Lunar New Year", zh: "農曆年初三" },
  { date: "2024-03-29", en: "Good Friday", zh: "耶穌受難節" },
  { date: "2024-03-30", en: "The day following Good Friday", zh: "耶穌受難節翌日" },
  { date: "2024-04-01", en: "Easter Monday", zh: "復活節星期一" },
  { date: "2024-04-04", en: "Ching Ming Festival", zh: "清明節" },
  { date: "2024-05-01", en: "Labour Day", zh: "勞動節" },
  { date: "2024-05-15", en: "The Birthday of the Buddha", zh: "佛誕" },
  { date: "2024-06-10", en: "Tuen Ng Festival", zh: "端午節" },
  { date: "2024-07-01", en: "HKSAR Establishment Day", zh: "香港特別行政區成立紀念日" },
  { date: "2024-09-18", en: "The day following the Chinese Mid-Autumn Festival", zh: "中秋節翌日" },
  { date: "2024-10-01", en: "National Day", zh: "國慶日" },
  { date: "2024-10-11", en: "Chung Yeung Festival", zh: "重陽節" },
  { date: "2024-12-25", en: "Christmas Day", zh: "聖誕節" },
  { date: "2024-12-26", en: "The first weekday after Christmas Day", zh: "聖誕節後第一個周日" },

  // 2025
  { date: "2025-01-01", en: "New Year's Day", zh: "一月一日（元旦）" },
  { date: "2025-01-29", en: "Lunar New Year's Day", zh: "農曆年初一" },
  { date: "2025-01-30", en: "The second day of Lunar New Year", zh: "農曆年初二" },
  { date: "2025-01-31", en: "The third day of Lunar New Year", zh: "農曆年初三" },
  { date: "2025-04-04", en: "Ching Ming Festival", zh: "清明節" },
  { date: "2025-04-18", en: "Good Friday", zh: "耶穌受難節" },
  { date: "2025-04-19", en: "The day following Good Friday", zh: "耶穌受難節翌日" },
  { date: "2025-04-21", en: "Easter Monday", zh: "復活節星期一" },
  { date: "2025-05-01", en: "Labour Day", zh: "勞動節" },
  { date: "2025-05-05", en: "The Birthday of the Buddha", zh: "佛誕" },
  { date: "2025-05-31", en: "Tuen Ng Festival", zh: "端午節" },
  { date: "2025-07-01", en: "HKSAR Establishment Day", zh: "香港特別行政區成立紀念日" },
  { date: "2025-10-01", en: "National Day", zh: "國慶日" },
  { date: "2025-10-07", en: "The day following the Chinese Mid-Autumn Festival", zh: "中秋節翌日" },
  { date: "2025-10-29", en: "Chung Yeung Festival", zh: "重陽節" },
  { date: "2025-12-25", en: "Christmas Day", zh: "聖誕節" },
  { date: "2025-12-26", en: "The first weekday after Christmas Day", zh: "聖誕節後第一個周日" },

  // 2026 — includes Sunday substitution days per gov press release
  { date: "2026-01-01", en: "New Year's Day", zh: "一月一日（元旦）" },
  { date: "2026-02-17", en: "Lunar New Year's Day", zh: "農曆年初一" },
  { date: "2026-02-18", en: "The second day of Lunar New Year", zh: "農曆年初二" },
  { date: "2026-02-19", en: "The third day of Lunar New Year", zh: "農曆年初三" },
  { date: "2026-04-03", en: "Good Friday", zh: "耶穌受難節" },
  { date: "2026-04-04", en: "The day following Good Friday", zh: "耶穌受難節翌日" },
  { date: "2026-04-06", en: "The day following Ching Ming Festival", zh: "清明節翌日" },
  { date: "2026-04-07", en: "The day following Easter Monday", zh: "復活節星期一翌日" },
  { date: "2026-05-01", en: "Labour Day", zh: "勞動節" },
  { date: "2026-05-25", en: "The day following the Birthday of the Buddha", zh: "佛誕翌日" },
  { date: "2026-06-19", en: "Tuen Ng Festival", zh: "端午節" },
  { date: "2026-07-01", en: "HKSAR Establishment Day", zh: "香港特別行政區成立紀念日" },
  { date: "2026-09-26", en: "The day following the Chinese Mid-Autumn Festival", zh: "中秋節翌日" },
  { date: "2026-10-01", en: "National Day", zh: "國慶日" },
  { date: "2026-10-19", en: "The day following Chung Yeung Festival", zh: "重陽節翌日" },
  { date: "2026-12-25", en: "Christmas Day", zh: "聖誕節" },
  { date: "2026-12-26", en: "The first weekday after Christmas Day", zh: "聖誕節後第一個周日" },

  // 2027
  { date: "2027-01-01", en: "New Year's Day", zh: "一月一日（元旦）" },
  { date: "2027-02-06", en: "Lunar New Year's Day", zh: "農曆年初一" },
  { date: "2027-02-08", en: "The third day of Lunar New Year", zh: "農曆年初三" },
  { date: "2027-02-09", en: "The fourth day of Lunar New Year", zh: "農曆年初四" },
  { date: "2027-03-26", en: "Good Friday", zh: "耶穌受難節" },
  { date: "2027-03-27", en: "The day following Good Friday", zh: "耶穌受難節翌日" },
  { date: "2027-03-29", en: "Easter Monday", zh: "復活節星期一" },
  { date: "2027-04-05", en: "Ching Ming Festival", zh: "清明節" },
  { date: "2027-05-01", en: "Labour Day", zh: "勞動節" },
  { date: "2027-05-13", en: "The Birthday of the Buddha", zh: "佛誕" },
  { date: "2027-06-09", en: "Tuen Ng Festival", zh: "端午節" },
  { date: "2027-07-01", en: "HKSAR Establishment Day", zh: "香港特別行政區成立紀念日" },
  { date: "2027-09-16", en: "The day following the Chinese Mid-Autumn Festival", zh: "中秋節翌日" },
  { date: "2027-10-01", en: "National Day", zh: "國慶日" },
  { date: "2027-10-08", en: "Chung Yeung Festival", zh: "重陽節" },
  { date: "2027-12-25", en: "Christmas Day", zh: "聖誕節" },
  { date: "2027-12-27", en: "The first weekday after Christmas Day", zh: "聖誕節後第一個周日" },
]

const BY_DATE = new Map<string, HkPublicHoliday>(
  GAZETTED_HOLIDAYS.map((h) => [h.date, h]),
)

const SUPPORTED_YEARS = [2024, 2025, 2026, 2027] as const

export function getHkPublicHoliday(iso: string): HkPublicHoliday | undefined {
  return BY_DATE.get(iso)
}

export function getHkPublicHolidaysInMonth(year: number, monthIndex0: number): HkPublicHoliday[] {
  const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-`
  return GAZETTED_HOLIDAYS.filter((h) => h.date.startsWith(prefix))
}

export function isHolidayYearSupported(year: number): boolean {
  return (SUPPORTED_YEARS as readonly number[]).includes(year)
}

export function supportedHolidayYears(): readonly number[] {
  return SUPPORTED_YEARS
}