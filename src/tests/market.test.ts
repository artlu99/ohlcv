import { describe, expect, it } from "bun:test";
import { getNinjaData } from "../lib/ninja";
import { getMassiveData } from "../lib/massive";
import { getYahooData, processRawYahooResponse } from "../lib/yahoo";

describe("Ninja", () => {
  it("returns tick data", async () => {
    const response = await getNinjaData("AAPL");

    expect(response).toBeDefined();
    expect(response.price).toBeGreaterThan(0);
  });
});

describe("Massive", () => {
  it("returns a stock price data", async () => {
    const response = await getMassiveData("AAPL", "2025-11-12");

    expect(response).toBeDefined();
    expect(response.close).toBeGreaterThan(0);
  });
});

describe("Yahoo", () => {
  it("returns a stock price data", async () => {
    const response = await getYahooData("AAPL", "2025-11-12", "2025-11-12");

    expect(response).toBeDefined();

    const res = processRawYahooResponse(response);
    expect(res.length).toBe(1);
    expect(res[0].ticker).toBe("AAPL");
    expect(res[0].dt_string).toBe("2025-11-12");
    expect(res[0].open_trade).toBeGreaterThan(0);
    expect(res[0].high).toBeGreaterThan(0);
    expect(res[0].low).toBeGreaterThan(0);
    expect(res[0].unadj_close).toBeGreaterThan(0);
    expect(res[0].volume).toBeGreaterThan(0);
    expect(res[0].adj_close).toBeGreaterThan(0);
  });
});
