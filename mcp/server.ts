import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { isEmailAllowed } from "../lib/auth/allowlist";
import { ensureUserRecord } from "../lib/auth/user-record";
import type { CurrentUser } from "../lib/auth/types";
import type { ProjectInput } from "../lib/domain/project";
import {
  calculatePricing,
  emptyPricingInput,
  type PricingInput,
} from "../lib/domain/pricing";
import { projectInputSchema } from "../lib/domain/schemas";
import { categoryRepository, projectRepository } from "../lib/repositories";

const port = Number(process.env.MCP_PORT ?? 3025);
const host = process.env.MCP_HOST ?? "127.0.0.1";
const sharedSecret = process.env.MCP_SHARED_SECRET?.trim();

type ExpressRequest = {
  path: string;
  body: unknown;
  header(name: string): string | undefined;
};
type ExpressResponse = {
  headersSent: boolean;
  json(body: unknown): void;
  on(event: "close", listener: () => void): void;
  status(code: number): ExpressResponse;
};
type ExpressNext = () => void;

const pricingInputSchema = z.object({
  mode: z.enum(["SIMPLE", "ADVANCED"]).default("SIMPLE"),
  unitForeignPrice: z.number().nonnegative(),
  exchangeRate: z.number().positive(),
  quantity: z.number().positive(),
  overseasShippingPct: z.number().nonnegative().default(0),
  domesticPackingPct: z.number().nonnegative().default(0),
  internationalFreight: z.number().nonnegative().default(0),
  insurance: z.number().nonnegative().default(0),
  dutyRatePct: z.number().nonnegative().default(0),
  otherTaxFees: z.number().nonnegative().default(0),
  brokerFee: z.number().nonnegative().default(0),
  domesticLogistics: z.number().nonnegative().default(0),
  otherExpenses: z.number().nonnegative().default(0),
  vatRatePct: z.number().nonnegative().default(7),
  includeVatInCost: z.boolean().default(true),
  gpMarginPct: z.number().min(0).lt(100).default(30),
});

const projectSaveSchema = pricingInputSchema.extend({
  productName: z.string().min(1).max(200),
  detail: z.string().max(2000).default(""),
  projectDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(today()),
  categoryId: z.string().nullable().default(null),
  currencyCode: z.string().min(3).max(3).default("CNY"),
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function requireBearer(request: { headers: { authorization?: string } }) {
  if (!sharedSecret) return true;
  return request.headers.authorization === `Bearer ${sharedSecret}`;
}

async function owner(): Promise<CurrentUser> {
  const email = (
    process.env.MCP_OWNER_EMAIL ??
    process.env.DEV_AUTH_EMAIL ??
    process.env.ALLOWED_EMAILS?.split(",")[0] ??
    ""
  )
    .trim()
    .toLowerCase();

  if (!email || !isEmailAllowed(email)) {
    throw new Error("MCP_OWNER_EMAIL must be set and included in ALLOWED_EMAILS.");
  }

  return ensureUserRecord({
    email,
    name: process.env.MCP_OWNER_NAME ?? "Nart (MCP)",
    image: null,
  });
}

function buildPricingInput(input: z.infer<typeof pricingInputSchema>): PricingInput {
  return {
    ...emptyPricingInput,
    ...input,
  };
}

function buildProjectInput(input: z.infer<typeof projectSaveSchema>): ProjectInput {
  return projectInputSchema.parse({
    ...buildPricingInput(input),
    productName: input.productName,
    detail: input.detail,
    projectDate: input.projectDate,
    categoryId: input.categoryId,
    currencyCode: input.currencyCode,
  });
}

function projectUrl(id: string) {
  const baseUrl =
    process.env.PRODUCT_PRICE_PUBLIC_URL ??
    process.env.AUTH_URL ??
    "http://127.0.0.1:3016";
  return `${baseUrl.replace(/\/$/, "")}/?projectId=${encodeURIComponent(id)}`;
}

function structured(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function createServer() {
  const server = new McpServer(
    { name: "import-price-studio", version: "1.0.0" },
    {
      instructions:
        "Use calculate_import_price for import-cost estimates. Read tools are safe. save_project creates a new project for the configured owner and should only be used when the user asks to save.",
    },
  );

  server.registerTool(
    "calculate_import_price",
    {
      title: "Calculate import price",
      description:
        "Calculate import cost, cost per unit, recommended selling price, profit, and shipping breakdown.",
      inputSchema: pricingInputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const result = calculatePricing(buildPricingInput(input));
      return {
        structuredContent: structured(result),
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "search_projects",
    {
      title: "Search import price projects",
      description:
        "Search saved projects by text, category, or calculation mode for the configured owner.",
      inputSchema: z.object({
        query: z.string().default(""),
        categoryId: z.string().optional(),
        mode: z.enum(["SIMPLE", "ADVANCED"]).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, categoryId, mode, limit }) => {
      const currentUser = await owner();
      const projects = await projectRepository.list(currentUser.id, {
        query: query || undefined,
        categoryId,
        mode,
      });
      const results = projects.slice(0, limit).map((project) => ({
        id: project.id,
        title: project.productName,
        url: projectUrl(project.id),
        category: project.category?.name ?? null,
        mode: project.mode,
        totalCost: project.totalCost,
        sellingPricePerUnit: project.sellingPricePerUnit,
        updatedAt: project.updatedAt,
      }));
      return {
        structuredContent: { results },
        content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get import price project",
      description: "Read one saved import price project by ID.",
      inputSchema: z.object({ id: z.string().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const currentUser = await owner();
      const project = await projectRepository.get(currentUser.id, id);
      if (!project) {
        return {
          isError: true,
          content: [{ type: "text", text: "Project not found." }],
        };
      }
      return {
        structuredContent: { project, url: projectUrl(project.id) },
        content: [
          {
            type: "text",
            text: JSON.stringify({ project, url: projectUrl(project.id) }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "save_project",
    {
      title: "Save import price project",
      description:
        "Create a new saved import price project for the configured owner.",
      inputSchema: projectSaveSchema,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async (input) => {
      const currentUser = await owner();
      const categories = await categoryRepository.list(currentUser.id);
      const project = await projectRepository.create(currentUser.id, {
        ...buildProjectInput(input),
        categoryId:
          input.categoryId ?? categories.find((category) => category.isActive)?.id ?? null,
      });
      return {
        structuredContent: { project, url: projectUrl(project.id) },
        content: [
          {
            type: "text",
            text: `Saved project ${project.productName}: ${projectUrl(project.id)}`,
          },
        ],
      };
    },
  );

  return server;
}

const app = createMcpExpressApp({ host });

app.use((req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
  if (req.path !== "/mcp") {
    next();
    return;
  }
  if (requireBearer({ headers: { authorization: req.header("authorization") } })) {
    next();
    return;
  }
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized" },
    id: null,
  });
});

app.get("/health", (_req: ExpressRequest, res: ExpressResponse) => {
  res.json({ status: "ok", service: "import-price-studio-mcp" });
});

app.post("/mcp", async (req: ExpressRequest, res: ExpressResponse) => {
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req as never, res as never, req.body);
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.listen(port, host, () => {
  console.log(`Import Price Studio MCP listening on http://${host}:${port}/mcp`);
});
