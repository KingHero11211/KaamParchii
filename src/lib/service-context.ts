export const conversationLanguages = {
  "hi-en": { label: "Hindi / Hinglish", speechCode: "hi-IN,en-IN", name: "Hindi/Hinglish", html: "hi" },
  "en-IN": { label: "English", speechCode: "en-IN", name: "English", html: "en" },
  "te-IN": { label: "Telugu · తెలుగు", speechCode: "te-IN", name: "Telugu", html: "te" },
} as const;
export type ConversationLanguage = keyof typeof conversationLanguages;
export const serviceCategories = {
  general: { label: "General repair & maintenance", example: "Water pump, furniture, or another item / asset", topic: "General repair and maintenance", keyterms: ["inspection", "repair", "maintenance", "replacement", "labour"], sample: "Water pump", issue: "Customer reports intermittent operation.", instruction: "Inspect first. Ask before replacing any parts.", accessories: "No accessories received (sample)." },
  electronics: { label: "Electronics & devices", example: "Phone, laptop, television, or other electronics", topic: "Electronics repair", keyterms: ["charging port", "display", "motherboard", "data", "charger"], sample: "Samsung Galaxy M32", issue: "Customer reports intermittent charging.", instruction: "Preserve data. Ask before resetting or replacing parts.", accessories: "One charging cable; no adapter (sample)." },
  appliances: { label: "Appliances & AC", example: "Washing machine, refrigerator, AC, or other appliance", topic: "Appliance and air-conditioner repair", keyterms: ["compressor", "refrigerant", "motor", "filter", "drain pump"], sample: "Front-load washing machine", issue: "Customer reports that water does not drain.", instruction: "Inspect first. Ask before replacing the pump or adding charges.", accessories: "Drain hose included (sample)." },
  vehicles: { label: "Vehicle service", example: "Bike, car, bicycle, model or registration reference", topic: "Vehicle repair and servicing", keyterms: ["brake pads", "engine oil", "tyre", "battery", "clutch"], sample: "Commuter motorcycle", issue: "Customer reports a noise while braking.", instruction: "Inspect the brakes. Ask before replacing tyres or parts.", accessories: "One key received (sample)." },
  home: { label: "Home maintenance", example: "Kitchen tap, electrical fitting, door, or work location", topic: "Home maintenance, plumbing, electrical and carpentry work", keyterms: ["leak", "wiring", "switch", "tiles", "pipe"], sample: "Kitchen sink plumbing", issue: "Customer reports a leak below the sink.", instruction: "Fix the leak. Ask before breaking tiles or replacing fittings.", accessories: "No items taken into custody (sample)." },
} as const;
export type ServiceCategory = keyof typeof serviceCategories;
export type ServiceContext = { shopName: string; category: ServiceCategory; language: ConversationLanguage };
export const defaultServiceContext: ServiceContext = { shopName: "Nukkad Repair Care", category: "general", language: "hi-en" };
export const legacyServiceContext: ServiceContext = { shopName: "Nukkad Mobile Care", category: "electronics", language: "hi-en" };

export function validateServiceContext(value: unknown): ServiceContext {
  if (value === undefined) return { ...legacyServiceContext };
  if (!value || typeof value !== "object") throw new Error("Choose the shop, service category and conversation language.");
  const raw = value as ServiceContext;
  if (typeof raw.shopName !== "string" || !raw.shopName.trim() || raw.shopName.length > 100 || /[<>\r\n]|\{[{%#]/u.test(raw.shopName) ||
      !Object.hasOwn(serviceCategories, raw.category) || !Object.hasOwn(conversationLanguages, raw.language))
    throw new Error("Choose a valid shop name, service category and conversation language.");
  return { shopName: raw.shopName.trim(), category: raw.category, language: raw.language };
}
export function speechCode(language: ConversationLanguage): string { return conversationLanguages[language].speechCode; }
export function serviceForJob(job: { service?: ServiceContext }): ServiceContext { return validateServiceContext(job.service); }

export function sampleDetails(service: ServiceContext) {
  const preset = serviceCategories[service.category];
  const telugu = {
    general: { device: "నీటి పంప్", issue: "పంప్ అప్పుడప్పుడు ఆగిపోతోందని కస్టమర్ చెప్పారు.", instructions: "ముందు తనిఖీ చేయండి. భాగాలు మార్చే ముందు అనుమతి తీసుకోండి.", accessories: "ఇతర వస్తువులు అందుకోలేదు (నమూనా)." },
    electronics: { device: "Samsung Galaxy M32", issue: "ఫోన్ అప్పుడప్పుడు ఛార్జ్ కావడం లేదని కస్టమర్ చెప్పారు.", instructions: "డేటా తొలగించవద్దు. రీసెట్ చేసే ముందు లేదా భాగాలు మార్చే ముందు అనుమతి తీసుకోండి.", accessories: "ఒక ఛార్జింగ్ కేబుల్ ఉంది. అడాప్టర్ లేదు (నమూనా)." },
    appliances: { device: "వాషింగ్ మెషిన్", issue: "నీరు బయటకు రావడం లేదని కస్టమర్ చెప్పారు.", instructions: "ముందు తనిఖీ చేయండి. పంప్ మార్చే ముందు లేదా అదనపు ఖర్చుకు అనుమతి తీసుకోండి.", accessories: "డ్రెయిన్ గొట్టం ఉంది (నమూనా)." },
    vehicles: { device: "మోటార్ సైకిల్", issue: "బ్రేక్ వేసినప్పుడు శబ్దం వస్తోందని కస్టమర్ చెప్పారు.", instructions: "బ్రేకులు తనిఖీ చేయండి. టైర్లు లేదా భాగాలు మార్చే ముందు అనుమతి తీసుకోండి.", accessories: "ఒక తాళం అందుకుంది (నమూనా)." },
    home: { device: "వంటగది సింక్ పైపు", issue: "సింక్ కింద నీరు కారుతోందని కస్టమర్ చెప్పారు.", instructions: "నీటి లీక్ సరిచేయండి. టైల్స్ పగలగొట్టే ముందు లేదా ఫిట్టింగులు మార్చే ముందు అనుమతి తీసుకోండి.", accessories: "ఏ వస్తువులూ దుకాణానికి తీసుకురాలేదు (నమూనా)." },
  };
  return service.language === "te-IN"
    ? { customerName: "శ్యామ్ (నమూనా)", condition: "తనిఖీ చేయలేదు (నమూనా).", ...telugu[service.category] }
    : { customerName: "Shyam (sample)", device: preset.sample, issue: preset.issue, condition: "Not inspected (sample).", accessories: preset.accessories, instructions: preset.instruction };
}
