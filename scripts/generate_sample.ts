import { randomUUID } from "node:crypto";
import { generatePropertyImage } from "../src/property_image_service.js";

const result = await generatePropertyImage({
  requestId: randomUUID(),
  propertyId: "harbor-view-204",
  kind: "inspection_reminder",
  inspectionType: "annual",
  dueDate: "2026-10-15",
  areas: ["smoke alarms", "kitchen", "balcony"],
});

console.log(JSON.stringify(result, null, 2));
