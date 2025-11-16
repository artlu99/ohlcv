import { cors } from "@elysiajs/cors";
import { Patterns, cron } from "@elysiajs/cron";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
import { differenceInDays, isWeekend, subMonths } from "date-fns";
import { Elysia, t } from "elysia";
import invariant from "tiny-invariant";
import {
  getChartData,
  getDatabaseStatus,
  getKnownTickers,
  upsertChartData,
} from "./lib/db";
import { pluralize } from "./lib/helpers";
import {
  JobStatus,
  JobType,
  addJob,
  allJobs,
  jobsStatus,
  setJobStatus,
  splitKey,
} from "./lib/jobs";
import { ChartDataSchema, TickDataSchema } from "./lib/open-api-schema";
import { getTicks, injectTicks } from "./lib/ticks";
import { fixHistoricalTimestamps, getYahooData, processRawYahooResponse } from "./lib/yahoo";

const PORT = process.env.NODE_ENV === "production" ? process.env.PORT : 3000;

// Elysia API endpoints
export const app = new Elysia()
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST"], // OPTIONS is automatically handled by CORS
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  )
  .use(
    cron({
      name: "heartbeat",
      pattern: Patterns.EVERY_10_MINUTES,
      run: () => {
        const status = jobsStatus();

        console.log(
          `${new Date().toISOString()}: ${status.total} jobs, ${
            status.pending
          } pending, ${status.running} running, ${
            status.completed
          } completed, ${status.failed} failed`
        );
      },
    })
  )
  .use(
    cron({
      name: "poll-jobs",
      pattern: Patterns.EVERY_SECOND,
      run: async () => {
        for (const [key, { status, timestamp }] of allJobs()) {
          const { ticker, type: jobType } = splitKey(key);
          if (status === JobStatus.PENDING) {
            // Mark as RUNNING atomically to prevent concurrent processing
            setJobStatus(ticker, jobType, JobStatus.RUNNING);

            try {
              const res = await getYahooData(
                ticker,
                "2025-11-12", // ignored start date
                "2025-11-12", // ignored end date
                jobType === JobType.FULL_UPDATE
                  ? "5y"
                  : jobType === JobType.PARTIAL_UPDATE
                  ? "5d"
                  : "1d"
              );

              const chartData = processRawYahooResponse(res);
              if (chartData.length === 0) {
                setJobStatus(ticker, jobType, JobStatus.FAILED);
                console.error(`No chart data found for ${ticker}`);
                continue;
              }

              try {
                await upsertChartData(chartData);
                setJobStatus(ticker, jobType, JobStatus.COMPLETED);
              } catch (error) {
                setJobStatus(ticker, jobType, JobStatus.FAILED);
                console.error(
                  `Error updating chart data for ${ticker}: ${JSON.stringify(
                    error
                  )}`
                );
              }
            } catch (error) {
              setJobStatus(ticker, jobType, JobStatus.FAILED);
              console.error(
                `Error getting chart data for ${ticker}: ${JSON.stringify(
                  error
                )}`
              );
            }
          }
        }
      },
    })
  )
  .get("/ready", () => ({ status: "ready" }), {
    detail: {
      summary: "Ready check",
      description: "Returns ready status",
      tags: ["Health"],
    },
    response: {
      200: t.Object({ status: t.Literal("ready") }),
    },
  })
  .get("/live", () => ({ uptime: 1 + Math.floor(process.uptime()) }), {
    detail: {
      summary: "Uptime",
      description: "Returns uptime in seconds",
      tags: ["Health"],
    },
    response: {
      200: t.Object({ uptime: t.Number({ description: "Uptime in seconds" }) }),
    },
  })
  .get("/db", () => getDatabaseStatus(), {
    detail: {
      summary: "Database status",
      description: "Returns database status",
      tags: ["Health"],
    },
    response: {
      200: t.Object({
        n: t.Number({ description: "Number of tickers" }),
        most_stale_5: t.Array(
          t.Object({
            ticker: t.String({ description: "Ticker symbol" }),
            n: t.Number({ description: "Number of rows" }),
            last: t.Date({ description: "Last updated" }),
          }),
          { description: "Most stale 5 tickers" }
        ),
      }),
    },
  })
  .get("/all-ticks", () => getTicks(), {
    detail: {
      summary: "Get all ticks",
      description:
        "Retrieves tick data, including ticker, timestamp, and adjusted close price",
      tags: ["Live Data"],
    },
    response: {
      200: t.Array(TickDataSchema, { description: "Array of tick data" }),
    },
  })
  .get(
    "/chart-data/:ticker",
    ({ params, query }) => {
      const { ticker } = params;
      const { start_date, end_date } = query;
      if (!ticker) {
        return {
          error: "ticker is required",
        };
      }

      const sdate =
        start_date ?? subMonths(new Date(), 6).toLocaleDateString("en-CA");
      const edate = end_date ?? new Date().toLocaleDateString("en-CA");
      const chartData = getChartData(ticker, sdate, edate);

      if (!chartData || chartData.length === 0) {
        console.log(`no data for ${ticker}, adding full update job`);
        addJob(ticker, JobType.FULL_UPDATE);
      } else {
        invariant(chartData.length > 0, `${ticker} has no data`);

        // daysBehind is positive if the data is behind the end_date
        const daysBehind = differenceInDays(
          new Date(edate),
          new Date(chartData.slice(-1)[0].timestamp)
        );
        if (daysBehind >= 1 && !isWeekend(new Date(edate))) {
          console.log(
            `${ticker} is ${pluralize(
              daysBehind,
              "day"
            )} behind, adding partial update job`
          );
          addJob(ticker, JobType.PARTIAL_UPDATE);
        }
      }

      return fixHistoricalTimestamps(injectTicks(chartData));
    },
    {
      params: t.Object({
        ticker: t.String({ description: "Ticker symbol" }),
      }),
      query: t.Object({
        start_date: t.Optional(
          t.String({ description: "Start date (YYYY-MM-DD)", format: "date" })
        ),
        end_date: t.Optional(
          t.String({ description: "End date (YYYY-MM-DD)", format: "date" })
        ),
      }),
      detail: {
        summary: "Get chart data for a ticker",
        description:
          "Retrieves chart data for a ticker, including ticker, timestamp, and adjusted close price",
        tags: ["Chart Data"],
      },
      response: {
        200: t.Union([
          t.Array(ChartDataSchema, { description: "Array of chart data" }),
          t.Object({ error: t.String({ description: "Error message" }) }),
        ]),
      },
    }
  )
  .post(
    "/force-update",
    () => {
      const allTickers = getKnownTickers();
      for (const ticker of allTickers) {
        addJob(ticker, JobType.LIVE_ONLY);
      }
      return { message: `Started live update for all tickers` };
    },
    {
      detail: {
        summary: "Force live update for all tickers",
        description:
          "Forces an update of live market data for all known tickers",
        tags: ["Live Data"],
      },
      response: {
        200: t.Object({ message: t.String({ description: "Message" }) }),
      },
    }
  )
  .post(
    "/force-update/:ticker",
    ({ params }) => {
      const { ticker } = params;
      addJob(ticker, JobType.FULL_UPDATE);
      return { message: `Started full update for ${ticker}` };
    },
    {
      params: t.Object({
        ticker: t.String({ description: "Ticker symbol" }),
      }),
      detail: {
        summary: "Force full update for a ticker",
        description:
          "Forces an update of the full chart data for a specific ticker",
        tags: ["Chart Data", "Live Data"],
      },
      response: {
        200: t.Object({ message: t.String({ description: "Message" }) }),
      },
    }
  )
  .use(
    openapi({
      path: "/docs",
      references: fromTypes(),
      documentation: {
        info: {
          title: "OHLCV API",
          description: "API for OHLCV data",
          version: "1.0.0",
          license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
          },
        },
      },
    })
  )
  .use(staticPlugin({ assets: "public", prefix: "" }))
  .listen(PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
