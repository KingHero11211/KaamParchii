import type { Intake } from "./jobs";
type Language = "te-IN" | "en-IN";
const te = ["సున్నా", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది", "పది", "పదకొండు", "పన్నెండు", "పదమూడు", "పద్నాలుగు", "పదిహేను", "పదహారు", "పదిహేడు", "పద్దెనిమిది", "పంతొమ్మిది"];
const en = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
function words(n: number, language: Language): string {
  const small = language === "te-IN" ? te : en;
  if (n < 20) return small[n];
  if (n < 100) {
    const tens = language === "te-IN" ? ["", "", "ఇరవై", "ముప్పై", "నలభై", "యాభై", "అరవై", "డెబ్బై", "ఎనభై", "తొంభై"] : ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + small[n % 10] : "");
  }
  for (const [size, english, singular, plural] of [[10000000,"crore","కోటి","కోట్లు"],[100000,"lakh","లక్ష","లక్షలు"],[1000,"thousand","వెయ్యి","వేలు"],[100,"hundred","వంద","వందలు"]] as const) {
    if (n >= size) {
      const count = Math.floor(n / size);
      const unit = language === "te-IN" ? (count === 1 ? singular : words(count, language) + " " + plural) : words(count, language) + " " + english;
      return unit + (n % size ? " " + words(n % size, language) : "");
    }
  }
  throw new Error("Unsupported spoken number.");
}
export function moneyWords(value: string, language: Language): string {
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 999999999.99) throw new Error("Check the amount before spoken review.");
  const [whole, fraction = ""] = value.split(".");
  const paise = Number(fraction.padEnd(2,"0"));
  return words(Number(whole),language) + (language === "te-IN" ? " రూపాయలు" : " rupees") +
    (paise ? " " + words(paise,language) + (language === "te-IN" ? " పైసలు" : " paise") : "");
}
export function spokenText(value: string, language: Language, digitsOnly = false): string {
  const small = language === "te-IN" ? te : en;
  const point = language === "te-IN" ? "దశాంశం" : "point";
  const plain = value.trim().replaceAll("<",language === "te-IN" ? " కంటే తక్కువ " : " less than ").replaceAll(">",language === "te-IN" ? " కంటే ఎక్కువ " : " greater than ").replace(/[\r\n\t]+/g," ");
  return plain.replace(/\d+(?:,\d+)*(?:\.\d+)?/g,(raw,offset: number)=>{
    const integer = raw.split(".")[0];
    const grouping = !integer.includes(",") || /^\d{1,3}(?:,\d{3})+$/.test(integer) || /^\d{1,2}(?:,\d{2})*,\d{3}$/.test(integer);
    const identifier = digitsOnly || (integer.length > 1 && integer.startsWith("0")) || /[\p{L}\p{N}]/u.test(plain[offset-1]||"") || /[\p{L}\p{N}]/u.test(plain[offset+raw.length]||"");
    if (!grouping || identifier) return " " + [...raw].map(c=>/\d/.test(c)?small[Number(c)]:c==="."?point:c).join(" ") + " ";
    const [whole,fraction] = raw.replaceAll(",","").split(".");
    const base = Number(whole) <= 999999999 ? words(Number(whole),language) : [...whole].map(c=>small[Number(c)]).join(" ");
    return " " + base + (fraction ? " " + point + " " + [...fraction].map(c=>small[Number(c)]).join(" ") : "") + " ";
  }).replace(/\s+/g," ").trim();
}
export function localizedReadback(intake: Intake, language: Language): string {
  const telugu = language === "te-IN";
  const missing = telugu ? "నమోదు కాలేదు" : "Not recorded";
  const value = (key: keyof Intake) => intake[key].trim() ? spokenText(intake[key],language,key === "contact") : missing;
  let date = missing;
  if (intake.promisedDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(intake.promisedDate) || Number.isNaN(Date.parse(intake.promisedDate)) || new Date(intake.promisedDate).toISOString().slice(0,10)!==intake.promisedDate) throw new Error("Check the completion date before spoken review.");
    const [year,month,day]=intake.promisedDate.split("-").map(Number);
    const monthName = new Intl.DateTimeFormat(telugu?"te-IN":"en-IN",{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,day)));
    date=words(day,language)+" "+monthName+" "+words(year,language);
  }
  const labels=telugu?["కస్టమర్ పేరు","సంప్రదింపు వివరాలు","వస్తువు లేదా ఆస్తి","కస్టమర్ చెప్పిన సమస్య","నమోదు చేసిన స్థితి","అందుకున్న ఇతర వస్తువులు","కస్టమర్ పూర్తి సూచనలు"]:["Customer name","Contact","Item or asset","Customer-reported problem","Recorded condition","Accessories received","Complete customer instructions"];
  const keys=["customerName","contact","device","issue","condition","accessories","instructions"] as const;
  return [
    telugu?"దయచేసి ఈ మరమ్మతు లేదా నిర్వహణ వివరాలు విని సరిచూసుకోండి.":"Please listen and check this repair or maintenance intake.",
    ...keys.map((key,i)=>labels[i]+": "+value(key)+"."),
    (telugu?"ఖర్చు పరిమితి: ":"Spending limit: ")+(intake.spendingLimit?moneyWords(intake.spendingLimit,language):missing)+".",
    (telugu?"అనుమతి నిబంధన: ":"Approval requirement: ")+(intake.approval==="Ask before any paid work"?(telugu?"చెల్లింపు అవసరమైన ఏ పని ప్రారంభించే ముందు కస్టమర్ అనుమతి తీసుకోండి":"Ask the customer before any paid work"):missing)+".",
    (telugu?"పని పూర్తయ్యే తేదీ: ":"Agreed completion date: ")+date+".",
    telugu?"ఇది వివరాల నమోదు మాత్రమే. మరమ్మతులకు అనుమతి కాదు. తప్పులు ఉంటే ముందుగా సరిచేయండి. ధృవీకరణ విడిగా జరుగుతుంది.":"This records the handover, not repair permission. Correct missing or inaccurate details first. Confirmation is separate.",
  ].join("\n");
}
