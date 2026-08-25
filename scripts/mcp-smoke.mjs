import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.env.MCP_ENDPOINT ?? "http://127.0.0.1:3025/mcp";
const secret = process.env.MCP_SHARED_SECRET;

if (!secret) {
  throw new Error("MCP_SHARED_SECRET is required");
}

const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: {
    headers: { authorization: `Bearer ${secret}` },
  },
});
const client = new Client({ name: "import-price-smoke-test", version: "1.0.0" });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  const calculation = await client.callTool({
    name: "calculate_import_price",
    arguments: {
      mode: "SIMPLE",
      unitForeignPrice: 217,
      exchangeRate: 5.5,
      quantity: 12,
      overseasShippingPct: 35,
      domesticPackingPct: 10,
      gpMarginPct: 20,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        endpoint,
        tools: tools.tools.map((tool) => tool.name),
        calculation: calculation.structuredContent,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
