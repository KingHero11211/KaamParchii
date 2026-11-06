import test from "node:test";
import assert from "node:assert/strict";
import { validateServiceContext, defaultServiceContext, legacyServiceContext, serviceCategories, speechCode } from "../src/lib/service-context.ts";
import { createJob, emptyIntake, readJobs, updateJob } from "../src/lib/jobs.ts";
import { serviceForJob } from "../src/lib/service-context.ts";
import { validateProposal, callPrompt } from "../src/lib/customer-calls.ts";
import { validateExtraction, extractionKeys } from "../src/lib/extraction.ts";

test("validates explicit Telugu service context without trusting arbitrary category or language values", () => {
  const context = validateServiceContext({shopName:"Shyam Repairs",category:"appliances",language:"te-IN"});
  assert.equal(speechCode(context.language),"te-IN");
  assert.equal(serviceCategories[context.category].label,"Appliances & AC");
  for (const change of [{language:"bhojpuri"},{category:"arbitrary"},{shopName:""},{shopName:"<break>"}])
    assert.throws(()=>validateServiceContext({...context,...change}));
});
test("new jobs keep a frozen context across reload and technician updates, and legacy jobs still load",()=>{
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try {
    const service={shopName:"Shyam Appliance Care",category:"appliances",language:"te-IN"};
    const job=createJob({...emptyIntake,customerName:"శ్యామ్",device:"వాషింగ్ మెషిన్",issue:"నీరు బయటకు రావడం లేదు"},service);
    service.shopName="Changed later";
    assert.equal(serviceForJob(readJobs()[0]).shopName,"Shyam Appliance Care");
    updateJob(job.id,{status:"In progress",technicianNotes:"Inspection pending"});
    assert.equal(readJobs()[0].service.language,"te-IN");
    const legacy={...job}; delete legacy.service;
    values.set("repair-handover.jobs.v1",JSON.stringify([legacy]));
    assert.equal(serviceForJob(readJobs()[0]).shopName,"Nukkad Mobile Care");
  } finally { delete globalThis.localStorage; }
});
test("approval proposals validate and freeze category, shop and selected language",()=>{
  const proposal=validateProposal({jobId:"11111111-1111-4111-8111-111111111111",reference:"KP",customerName:"Shyam",phone:"",device:"Pump",instructions:"Ask before replacing",originalLimit:"600",total:"900",actions:["Replace pump"],service:{shopName:"Shyam Repairs",category:"home",language:"te-IN"}},false);
  const prompt=callPrompt(proposal);
  assert.match(prompt,/Speak Telugu/); assert.match(prompt,/Home maintenance/); assert.match(prompt,/Shyam Repairs/);
  assert.throws(()=>validateProposal({...proposal,service:{...proposal.service,language:"bhojpuri"}},false));
});
test("Telugu restrictions omitted by the model are preserved from the transcript",()=>{
  const fields=Object.fromEntries(extractionKeys.map(key=>[key,{value:"",evidence:""}]));
  const transcript="పంప్ మార్చవద్దు. ఆరు వందలు దాటితే ముందు నాకు కాల్ చేయండి.";
  const result=validateExtraction({fields,instructionClauses:[],clarifications:[]},transcript);
  assert.ok(result.fields.instructions.value.includes("పంప్ మార్చవద్దు."));
  assert.ok(result.fields.instructions.value.includes("ముందు నాకు కాల్ చేయండి."));
});
test("new jobs default to general repairs while legacy requests preserve phone/Hinglish context",()=>{
  assert.equal(defaultServiceContext.category,"general");
  assert.equal(validateServiceContext(undefined).shopName,legacyServiceContext.shopName);
  assert.equal(speechCode("hi-en"),"hi-IN,en-IN");
});
