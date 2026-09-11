/** ISO 3166-1 alpha-2 country codes (UN M.49 common set). */
export const COUNTRY_CODES = [
  "AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ",
  "BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR",
  "IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL","CN","CX","CC",
  "CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO",
  "EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF",
  "GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY",
  "HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM",
  "JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY",
  "LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX",
  "FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI",
  "NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH",
  "PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC",
  "WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS",
  "SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK",
  "TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU",
  "VE","VN","VG","VI","WF","EH","YE","ZM","ZW",
] as const;

export type CountryOption = { code: string; name: string };

export function getCountryOptions(locale: "en" | "fr" = "en"): CountryOption[] {
  const display = new Intl.DisplayNames([locale === "fr" ? "fr" : "en"], { type: "region" });
  return COUNTRY_CODES.map((code) => ({
    code,
    name: display.of(code) ?? code,
  })).sort((a, b) => a.name.localeCompare(b.name, locale === "fr" ? "fr" : "en"));
}

export function resolveCountryCode(raw: string | null | undefined): string {
  if (!raw) return "CA";
  const trimmed = raw.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const upper = trimmed.toUpperCase();
  if (upper === "CANADA") return "CA";
  if (upper === "UNITED STATES" || upper === "USA" || upper === "UNITED STATES OF AMERICA") return "US";
  if (upper === "UNITED KINGDOM" || upper === "UK" || upper === "GREAT BRITAIN") return "GB";
  const en = getCountryOptions("en");
  const fr = getCountryOptions("fr");
  const hit =
    en.find((c) => c.name.toLowerCase() === trimmed.toLowerCase()) ??
    fr.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  return hit?.code ?? "CA";
}

export function countryLabel(code: string, locale: "en" | "fr" = "en"): string {
  try {
    return new Intl.DisplayNames([locale === "fr" ? "fr" : "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
