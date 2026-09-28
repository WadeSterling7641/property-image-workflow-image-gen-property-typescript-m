import assert from "node:assert/strict";
import test from "node:test";
import { planPropertyImage, propertyImageRequestSchema } from "../src/image_policy.js";

test("tenant document artwork omits tenant identity and source filename", () => {
  const input = propertyImageRequestSchema.parse({
    requestId: "9ce40f68-b51e-4cb4-a79c-65694730e10a",
    propertyId: "cedar-12",
    kind: "tenant_document",
    documentType: "lease",
    tenantName: "Morgan Li",
    originalFilename: "morgan-li-signed-lease.pdf",
  });

  const plan = planPropertyImage(input);

  assert.equal(plan.category, "tenant_document");
  assert.match(plan.prompt, /lease/);
  assert.doesNotMatch(plan.prompt, /Morgan Li/);
  assert.doesNotMatch(plan.prompt, /morgan-li-signed-lease/);
  assert.match(plan.prompt, /Do not include names/);
});

test("inspection reminders keep the operational areas in the image brief", () => {
  const input = propertyImageRequestSchema.parse({
    requestId: "bc98539b-3e4e-4478-8db6-fb60354127b0",
    propertyId: "cedar-12",
    kind: "inspection_reminder",
    inspectionType: "safety",
    dueDate: "2026-11-04",
    areas: ["smoke alarms", "boiler room"],
  });

  const plan = planPropertyImage(input);

  assert.match(plan.prompt, /smoke alarms, boiler room/);
  assert.equal(plan.altText, "safety inspection due 2026-11-04");
});
