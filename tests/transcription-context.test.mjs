import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/transcribe/route.ts";

const service={shopName:"Shyam Appliances",category:"appliances",language:"te-IN"};
function request(language="te-IN", context=service) {
  const form=new FormData();
  form.set("consent","true"); form.set("language_code",language); form.set("service",JSON.stringify(context));
  form.set("audio_file",new File(["fixture-only"],"fixture.wav",{type:"audio/wav"}));
  return new Request("http://localhost:3000/api/transcribe",{method:"POST",headers:{Origin:"http://localhost:3000"},body:form});
}
test("Telugu transcription forwards selected language and appliance vocabulary",async()=>{
  const previous=process.env.GNANI_API_KEY, original=globalThis.fetch;
  process.env.GNANI_API_KEY="fixture-only";
  try {
    globalThis.fetch=async(url,options)=>{
      assert.equal(options.body.get("language_code"),"te-IN");
      assert.match(options.body.get("topic"),/Appliance/);
      assert.ok(!options.body.get("keyterms").includes("Samsung"));
      return Response.json({transcript:"పంప్ మార్చవద్దు.",detected_language_code:"te-IN"});
    };
    const response=await POST(request()); assert.equal(response.status,200);
    assert.equal((await response.json()).language,"te-IN");
  } finally { globalThis.fetch=original; previous===undefined?delete process.env.GNANI_API_KEY:process.env.GNANI_API_KEY=previous; }
});
test("mismatched language and unsupported service settings are rejected before provider calls",async()=>{
  assert.equal((await POST(request("hi-IN,en-IN"))).status,400);
  assert.equal((await POST(request("te-IN",{...service,category:"unknown"}))).status,400);
});
