import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/transcribe/route.ts";

// Malformed bodies stop at validation: these checks cannot send audio to Gnani.
function request(origin, host = "localhost:3000") {
  return new Request("http://0.0.0.0:3000/api/transcribe", {
    method: "POST", headers: { origin, host, "Content-Type": "application/json" }, body: "{}",
  });
}

test("same-origin browser passes origin guard despite an internal bind address", async () => {
  assert.equal((await POST(request("http://localhost:3000"))).status, 400);
});
test("unrelated website stays blocked", async () => {
  assert.equal((await POST(request("https://unrelated.example"))).status, 403);
});
test("different port stays blocked", async () => {
  assert.equal((await POST(request("http://localhost:4000"))).status, 403);
});
