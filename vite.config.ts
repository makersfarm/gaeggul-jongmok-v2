import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { buildAnalysis } from "./server/analysis";
import { getFinancialSnapshot } from "./server/dart";
import { getMarketRows, getTechnicalSnapshot } from "./server/market";

function json(res: any, data: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [
      react(),
      {
        name: "gaeggul-data-api",
        configureServer(server) {
          server.middlewares.use("/api/market", async (_req, res) => {
            try {
              const rows = await getMarketRows();
              json(res, { source: "naver-finance", rows });
            } catch (error) {
              json(res, { error: error instanceof Error ? error.message : "market failed" }, 502);
            }
          });

          server.middlewares.use("/api/analysis", async (req, res) => {
            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const code = url.searchParams.get("code") ?? "005930";
              const rows = await getMarketRows();
              const stock = rows.find((row) => row.code === code) ?? rows[0];
              const [financial, technical] = await Promise.all([
                getFinancialSnapshot(stock.code),
                getTechnicalSnapshot(stock.code),
              ]);
              json(res, buildAnalysis(stock, financial, technical));
            } catch (error) {
              json(res, { error: error instanceof Error ? error.message : "analysis failed" }, 502);
            }
          });
        },
      },
    ],
    server: {
      allowedHosts: true,
    },
  };
});
