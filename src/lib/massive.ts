import { fetcher } from "itty-fetcher";
import { Static, Type } from "typebox";
import { Compile } from "typebox/compile";
import { ApiCache } from "./cache";

const massiveApi = fetcher({
  base: `https://api.massive.com/v1`,
  headers: {
    Host: "api.massive.com",
    Authorization: `Bearer ${process.env.MASSIVE_API_KEY}`,
  },
});

const MassiveResponse = Type.Object({
  afterHours: Type.Optional(Type.Number()),
  close: Type.Number(),
  from: Type.String(),
  high: Type.Number(),
  low: Type.Number(),
  open: Type.Number(),
  preMarket: Type.Optional(Type.Number()),
  status: Type.String(),
  symbol: Type.String(),
  volume: Type.Number(),
});
type MassiveResponse = Static<typeof MassiveResponse>;
const MassiveResponseSchema = Compile(MassiveResponse);

// Cache instance: historical data never expires, errors cached for 5 minutes
export const massiveCache = new ApiCache<MassiveResponse>({
  successTTL: 0, // Never expire (historical data doesn't change)
  errorTTL: 5 * 60, // 5 minutes for errors
  maxKeys: 10000,
  maxErrorKeys: 1000,
  isCacheableError: (error) => {
    // Don't cache validation errors - they indicate data problems
    if (error.message.includes("Invalid response")) {
      return false;
    }
    // Cache network errors, API errors, rate limits, etc.
    return true;
  },
});

export const getMassiveData = async (
  symbol: string,
  asof: string
): Promise<MassiveResponse> => {
  const cacheKey = `${symbol}:${asof}`;

  return massiveCache.getOrFetch(cacheKey, async () => {
    console.log(`Fetching ${symbol} on ${asof} from Massive API`);

    const response = await massiveApi.get<MassiveResponse>(
      `/open-close/${symbol}/${asof}?adjusted=true`
    );

    // Validate response
    const validationResult = MassiveResponseSchema.Check(response);
    if (!validationResult) {
      throw new Error(
        `Invalid response from Massive API for ${symbol} on ${asof}: ${JSON.stringify(
          response
        )}`
      );
    }

    return response;
  });
};
