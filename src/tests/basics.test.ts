import { describe, expect, it } from "bun:test";
import { app } from "..";

describe("Elysia", () => {
  it("returns ready status", async () => {
    const response = await app
      .handle(new Request("http://localhost/ready"))
      .then((res) => res.json());

    expect(response).toBeDefined();
    expect(response.status).toBe("ready");
  });

  it("returns uptime", async () => {
    const response = await app
      .handle(new Request("http://localhost/live"))
      .then((res) => res.json());

    expect(response).toBeDefined();
    expect(response.uptime).toBeGreaterThan(0);
  });

  it("returns database status", async () => {
    const response = await app
      .handle(new Request("http://localhost/db"))
      .then((res) => res.json());

    expect(response).toBeDefined();
    expect(response.n).toBeGreaterThan(0);
    expect(response.most_stale_5).toBeDefined();
    expect(response.most_stale_5.length).toBeLessThanOrEqual(5);
  });

  it("returns all ticks", async () => {
    const response = await app
      .handle(new Request("http://localhost/all-ticks"))
      .then((res) => res.json());

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThanOrEqual(0);
  });

  it("returns chart data for a ticker", async () => {
    const response = await app
      .handle(
        new Request(
          "http://localhost/chart-data/AAPL?start_date=2025-11-12&end_date=2025-11-12"
        )
      )
      .then((res) => res.json());

    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(0);
    expect(response[0].ticker).toBe("AAPL");
    expect(response[0].dt_string).toBe("2025-11-12");
    expect(response[0].open_trade).toBe(275.08);
    expect(response[0].high).toBe(275.73);
    expect(response[0].low).toBe(271.87);
    expect(response[0].unadj_close).toBe(273.44);
    expect(response[0].volume).toBe(34398678);
    expect(response[0].adj_close).toBe(273.44);
  });
});
