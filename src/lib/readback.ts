import type { Intake } from "./jobs";

export const MAX_READBACK_CHARS = 6000;
const small = ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस", "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस", "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस", "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास", "पचास", "इक्यावन", "बावन", "तिरपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ", "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर", "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उनासी", "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सतासी", "अट्ठासी", "नवासी", "नब्बे", "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे"];

function words(number: number): string {
  if (number < 100) return small[number];
  for (const [size, unit] of [[10000000, "करोड़"], [100000, "लाख"], [1000, "हज़ार"], [100, "सौ"]] as const) {
    if (number >= size) return `${words(Math.floor(number / size))} ${unit}${number % size ? ` ${words(number % size)}` : ""}`;
  }
  throw new Error("Cannot format this number.");
}

export function rupeesInHindi(value: string): string {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 999999999.99) throw new Error("The spending limit is outside the supported read-back range. Review it manually.");
  const [whole, fraction = ""] = value.split(".");
  const paise = Number(fraction.padEnd(2, "0"));
  return `${words(Number(whole))} रुपये${paise ? ` ${words(paise)} पैसे` : ""}`;
}

function spokenValue(value: string): string {
  // Do not interpret user-provided angle brackets as Timbre expressive tags.
  const plain = value.trim().replaceAll("<", " less than ").replaceAll(">", " greater than ").replace(/[\r\n\t]+/g, " ");
  return plain.replace(/\d+(?:,\d+)*(?:\.\d+)?/g, (raw: string, offset: number) => {
    const integerPart = raw.split(".")[0];
    const validGrouping = !integerPart.includes(",") || /^\d{1,3}(?:,\d{3})+$/.test(integerPart) || /^\d{1,2}(?:,\d{2})*,\d{3}$/.test(integerPart);
    // Ambiguous comma lists, leading zeros and alphanumeric IDs are identifiers,
    // not amounts. Preserve each digit and separator instead of combining them.
    const identifier = (integerPart.length > 1 && integerPart.startsWith("0")) || /[\p{L}\p{N}]/u.test(plain[offset - 1] ?? "") || /[\p{L}\p{N}]/u.test(plain[offset + raw.length] ?? "");
    if (!validGrouping || identifier) return ` ${[...raw].map(char => /\d/.test(char) ? small[Number(char)] : char === "." ? "दशमलव" : char).join(" ")} `;
    const clean = raw.replaceAll(",", "");
    const [whole, fraction] = clean.split(".");
    const integer = Number(whole);
    const base = integer <= 999999999 ? words(integer) : [...whole].map(digit => small[Number(digit)]).join(" ");
    return ` ${fraction ? `${base} दशमलव ${[...fraction].map(digit => small[Number(digit)]).join(" ")}` : base} `;
  }).replace(/\s+/g, " ").trim();
}

export function buildReadback(intake: Intake): string {
  const values = Object.values(intake);
  if (values.some(value => typeof value !== "string" || value.length > 2000)) throw new Error("A field is too long for spoken review. Shorten it manually; no text was truncated.");
  const value = (key: keyof Intake) => intake[key].trim() ? spokenValue(intake[key]) : "दर्ज नहीं किया गया";
  let date = "दर्ज नहीं की गई";
  if (intake.promisedDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(intake.promisedDate) || Number.isNaN(Date.parse(intake.promisedDate)) || new Date(intake.promisedDate).toISOString().slice(0, 10) !== intake.promisedDate) throw new Error("Check the completion date before spoken review.");
    const [year, month, day] = intake.promisedDate.split("-").map(Number);
    const months = ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"];
    date = `${words(day)} ${months[month - 1]} ${words(year)}`;
  }
  const contact = intake.contact.trim() ? spokenValue(intake.contact.replace(/\d/g, digit => `${small[Number(digit)]} `)) : "दर्ज नहीं किया गया";
  const text = [
    "कृपया फ़ोन जमा करने की यह जानकारी सुनकर जाँच लें।",
    `ग्राहक का नाम: ${value("customerName")}। संपर्क: ${contact}।`,
    `डिवाइस: ${value("device")}। ग्राहक ने बताई समस्या: ${value("issue")}।`,
    `जमा करते समय दर्ज हालत: ${value("condition")}। साथ मिले सामान की जानकारी: ${value("accessories")}।`,
    `ग्राहक के पूरे निर्देश: ${value("instructions")}।`,
    `खर्च की बताई सीमा: ${intake.spendingLimit.trim() ? rupeesInHindi(intake.spendingLimit.trim()) : "दर्ज नहीं की गई"}।`,
    `अनुमति की शर्त: ${intake.approval === "Ask before any paid work" ? "किसी भी भुगतान वाले काम से पहले ग्राहक की अनुमति लें" : "दर्ज नहीं की गई"}।`,
    `तय की गई काम पूरा करने की तारीख: ${date}।`,
    "यह केवल जमा की गई जानकारी है, मरम्मत की अनुमति नहीं है। कोई गलती या अधूरी बात हो तो पहले सुधारें। पुष्टि अलग से की जाएगी।",
  ].join("\n");
  if (text.length > MAX_READBACK_CHARS) throw new Error("The summary is too long for one read-back. Shorten the fields manually; no instructions were truncated.");
  return text;
}
