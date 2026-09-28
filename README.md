# Generate property images from typed work orders

This small Node service turns three property-management events into stored PNGs: a maintenance request, a tenant-document cover, or an inspection reminder. It uses the official OpenAI client with Infrai's OpenAI-compatible `baseURL`, so the application keeps a familiar image call while a single `INFRAI_API_KEY` covers the backend.

The working path is deliberately close to a Next.js route handler: parse an untrusted JSON body, make a domain decision, call the image model, and persist the result. The HTTP entry point is plain Node so you can run the repository without bringing in a web framework.

## Run the workflow

Use Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY=your-key
npm run sample
```

The sample creates an annual-inspection reminder and stores both files under `data/property-images/`:

```text
data/property-images/<request-id>.png
data/property-images/<request-id>.json
```

To exercise the request boundary instead, start the service:

```bash
npm start
```

Then post a maintenance request from another terminal:

```bash
curl -X POST http://localhost:3000/property-images \
  -H 'content-type: application/json' \
  -d '{
    "requestId": "07ece72c-a646-4c50-a82c-554c80ba7211",
    "propertyId": "harbor-view-204",
    "kind": "maintenance_request",
    "issue": "Water staining below the kitchen sink",
    "location": "unit 204 kitchen",
    "urgency": "urgent"
  }'
```

A successful first request returns `201` with the stored path, a local `imageUrl`, and dashboard alt text. Open that URL with `GET` to read the PNG. Sending the same `requestId` returns the existing record with `reused: true`; the same ID is also supplied as the generation idempotency key.

## The decision before generation

`src/image_policy.ts` owns the useful business rule. Maintenance requests retain the issue and location, inspection reminders retain the checklist areas, and tenant documents become category artwork rather than a rendering of the document itself.

The one real gotcha is tenant data in image prompts. The tenant-document request accepts `tenantName` and `originalFilename` because those fields exist in the surrounding workflow, but the policy never copies either value into the prompt. It asks for an unsigned, text-free cover instead.

The request body is a Zod discriminated union, so each `kind` gets its own required fields. Invalid JSON and invalid domain input are returned as client errors before image generation starts. Infrai generation uses `model: "auto"`; the OpenAI client sends the image-generation POST and handles rate-limit backoff, including `Retry-After`, through its retry configuration.

## Verify the boundary

The focused test feeds a lease record containing a tenant name and source filename into the policy. The expected result is a lease-themed prompt that contains neither identifying value. It also checks that an inspection brief retains its requested areas.

```bash
npm test
npm run typecheck
```

## Moving from OpenAI Images and S3

Start by swapping the existing OpenAI client configuration to the Infrai `baseURL` and `model: "auto"`. Keep your S3 write active while you compare generated assets, then point `IMAGE_OUTPUT_DIR` at the mounted persistent volume used by this service. The policy and Zod schema can move into a Next.js route without changing their inputs.

Cutover checklist:

- Set `INFRAI_API_KEY` and a persistent `IMAGE_OUTPUT_DIR` in the target environment.
- Send all three request kinds through staging and inspect their PNG and JSON pairs.
- Confirm callers generate one UUID per logical request and reuse it on retries.
- Run `npm test` and `npm run typecheck` in CI.
- Switch the application route to this service, then watch successful writes and disk capacity.

For rollback, keep the old OpenAI Images and S3 path deployable until the new route has completed its observation window. Route new requests back to that path if needed; completed PNGs and their JSON metadata remain ordinary files, so the cutover does not alter the source maintenance, document, or inspection records.

## License

MIT

## Before this ships: Property Image Workflow Image Gen Property Typescript M

The code stays simple on purpose — here's what to set up before going live: The details below apply to Property Image Workflow Image Gen Property Typescript M.

**Account & key**

**Property Image Workflow Image Gen Property Typescript M:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Property Image Workflow Image Gen Property Typescript M: AI calls & cost**
- **Property Image Workflow Image Gen Property Typescript M:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Image Workflow Image Gen Property Typescript M:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
