import { z } from "zod";

const baseFields = {
  requestId: z.string().uuid(),
  propertyId: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
};

export const propertyImageRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    ...baseFields,
    kind: z.literal("maintenance_request"),
    issue: z.string().min(5).max(300),
    location: z.string().min(2).max(120),
    urgency: z.enum(["routine", "urgent"]),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("tenant_document"),
    documentType: z.enum(["lease", "move_in", "insurance", "notice"]),
    tenantName: z.string().min(1).max(120),
    originalFilename: z.string().min(1).max(180),
  }),
  z.object({
    ...baseFields,
    kind: z.literal("inspection_reminder"),
    inspectionType: z.enum(["move_out", "annual", "safety"]),
    dueDate: z.string().date(),
    areas: z.array(z.string().min(2).max(60)).min(1).max(8),
  }),
]);

export type PropertyImageRequest = z.infer<typeof propertyImageRequestSchema>;

export type ImagePlan = {
  category: PropertyImageRequest["kind"];
  prompt: string;
  altText: string;
};

export function planPropertyImage(input: PropertyImageRequest): ImagePlan {
  if (input.kind === "maintenance_request") {
    return {
      category: input.kind,
      prompt: [
        "Create a clean property-maintenance coordination image for a web dashboard.",
        `Show this issue: ${input.issue}.`,
        `Setting: ${input.location}. Priority: ${input.urgency}.`,
        "Use a realistic editorial style, clear lighting, no people, no logos, and no text.",
      ].join(" "),
      altText: `${input.urgency} maintenance request at ${input.location}`,
    };
  }

  if (input.kind === "tenant_document") {
    return {
      category: input.kind,
      prompt: [
        "Create a neutral document-cover image for a property management web dashboard.",
        `Represent the category ${input.documentType} with a tidy desk and an unsigned blank document.`,
        "Do not include names, signatures, addresses, logos, or readable text.",
      ].join(" "),
      altText: `${input.documentType} tenant document cover`,
    };
  }

  return {
    category: input.kind,
    prompt: [
      "Create a practical property-inspection reminder image for a web dashboard.",
      `Inspection: ${input.inspectionType}. Areas: ${input.areas.join(", ")}.`,
      "Show an inspector clipboard in a well-kept rental interior, with no people, logos, or readable text.",
    ].join(" "),
    altText: `${input.inspectionType} inspection due ${input.dueDate}`,
  };
}
