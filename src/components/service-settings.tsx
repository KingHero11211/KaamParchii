"use client";

import { conversationLanguages, serviceCategories, type ServiceContext } from "@/lib/service-context";

export default function ServiceSettings({ value, disabled, onChange }: { value: ServiceContext; disabled: boolean; onChange: (value: ServiceContext) => void }) {
  return <section className="panel" aria-labelledby="service-settings-heading" style={{ marginBottom: 24 }}>
    <div className="panel-head"><div><h2 id="service-settings-heading">Your shop & conversation</h2><p className="hint">These settings are saved with this job card.</p></div></div>
    <div className="form-body"><div className="fields">
      <div className="field full"><label htmlFor="service-shop">Shop / service business name</label><input id="service-shop" value={value.shopName} maxLength={100} disabled={disabled} onChange={e=>onChange({...value,shopName:e.target.value})} /></div>
      <div className="field"><label htmlFor="service-category">Service category</label><select id="service-category" value={value.category} disabled={disabled} onChange={e=>onChange({...value,category:e.target.value as ServiceContext["category"]})}>
        {Object.entries(serviceCategories).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}
      </select></div>
      <div className="field"><label htmlFor="service-language">Conversation language</label><select id="service-language" value={value.language} disabled={disabled} onChange={e=>onChange({...value,language:e.target.value as ServiceContext["language"]})}>
        {Object.entries(conversationLanguages).map(([key,item])=><option key={key} value={key}>{item.label}</option>)}
      </select></div>
    </div><p className="hint">Used for speech recognition, spoken review, warnings and live conversation. Existing text stays as entered. Changing these settings clears working audio and suggestions; review the transcript again. The interface and receipt labels remain in English.</p></div>
  </section>;
}
