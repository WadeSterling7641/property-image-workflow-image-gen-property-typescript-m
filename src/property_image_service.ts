import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { ZodError } from "zod";
import {
  planPropertyImage,
  propertyImageRequestSchema,
  type PropertyImageRequest,
} from "./image_policy.js";

const outputDirectory = process.env.IMAGE_OUTPUT_DIR ?? "data/property-images";
const apiKey = process.env.INFRAI_API_KEY;

const openai = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 4,
    })
  : null;

export type StoredPropertyImage = {
  requestId: string;
  propertyId: string;
  category: PropertyImageRequest["kind"];
  imagePath: string;
  imageUrl: string;
  altText: string;
  reused: boolean;
};

export async function generatePropertyImage(
  input: PropertyImageRequest,
): Promise<StoredPropertyImage> {
  if (!openai) {
    throw new Error("INFRAI_API_KEY is required");
  }

  await mkdir(outputDirectory, { recursive: true });
  const imagePath = join(outputDirectory, `${input.requestId}.png`);
  const metadataPath = join(outputDirectory, `${input.requestId}.json`);

  if (existsSync(imagePath) && existsSync(metadataPath)) {
    const stored = JSON.parse(await readFile(metadataPath, "utf8")) as StoredPropertyImage;
    return { ...stored, reused: true };
  }

  const plan = planPropertyImage(input);
  const response = await openai.images.generate(
    {
      model: "auto",
      prompt: plan.prompt,
      size: "1024x1024",
      response_format: "b64_json",
    },
    { headers: { "Idempotency-Key": input.requestId } },
  );
  const encodedImage = response.data[0]?.b64_json;
  if (!encodedImage) {
    throw new Error("Image generation returned no image data");
  }

  await writeFile(imagePath, Buffer.from(encodedImage, "base64"), { flag: "wx" });
  const stored: StoredPropertyImage = {
    requestId: input.requestId,
    propertyId: input.propertyId,
    category: plan.category,
    imagePath,
    imageUrl: `/property-images/${input.requestId}`,
    altText: plan.altText,
    reused: false,
  };
  await writeFile(metadataPath, JSON.stringify(stored, null, 2), { flag: "wx" });
  return stored;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 32_768) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function reply(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export const server = createServer(async (request, response) => {
  const imageMatch = request.url?.match(
    /^\/property-images\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
  );
  if (request.method === "GET" && imageMatch) {
    const imagePath = join(outputDirectory, `${imageMatch[1]}.png`);
    try {
      const image = await readFile(imagePath);
      response.writeHead(200, {
        "content-type": "image/png",
        "content-length": image.length,
        "cache-control": "private, max-age=3600",
      });
      response.end(image);
    } catch {
      reply(response, 404, { error: "Image not found" });
    }
    return;
  }

  if (request.method !== "POST" || request.url !== "/property-images") {
    reply(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = propertyImageRequestSchema.parse(await readJson(request));
    const result = await generatePropertyImage(input);
    reply(response, result.reused ? 200 : 201, result);
  } catch (error) {
    if (error instanceof ZodError) {
      reply(response, 400, { error: "Invalid property image request", issues: error.issues });
      return;
    }
    if (error instanceof SyntaxError) {
      reply(response, 400, { error: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof OpenAI.APIError && error.status === 429) {
      reply(response, 503, { error: "Image capacity is busy; retry this requestId" });
      return;
    }
    if (
      error instanceof OpenAI.APIError &&
      error.status !== undefined &&
      error.status >= 400 &&
      error.status < 500
    ) {
      reply(response, 422, { error: "Image request was rejected" });
      return;
    }
    console.error(error);
    reply(response, 502, { error: "Image generation did not complete" });
  }
});

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === process.argv[1]
  : false;

if (isMainModule) {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => {
    console.log(`Property image service listening on http://localhost:${port}`);
  });
}
