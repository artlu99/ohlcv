import { fetcher } from "itty-fetcher";
import { Static, Type } from "typebox";
import { Compile } from "typebox/compile";
import { ApiCache } from "./cache";

const ninjaApi = fetcher({
  base: `https://api.api-ninjas.com/v1`,
  headers: {
    "X-API-Key": `${process.env.NINJA_API_KEY}`,
  },
});

const NinjaResponse = Type.Object({
  ticker: Type.String(),
  name: Type.String(),
  price: Type.Number(),
  exchange: Type.String(),
updated: Type.Number(),
  currency: Type.String(),
});
type NinjaResponse = Static<typeof NinjaResponse>;
const NinjaResponseSchema = Compile(NinjaResponse);

// Cache instance: historical data never expires, errors cached for 5 minutes
export const ninjaCache = new ApiCache<NinjaResponse>({
  successTTL: 60 * 60 * 8, // 8 hours
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

export const getNinjaData = async (
  ticker: string,
): Promise<NinjaResponse> => {
  const cacheKey = `${ticker}`;

  return ninjaCache.getOrFetch(cacheKey, async () => {
    console.log(`Fetching ${ticker} from Ninja API`);

    const response = await ninjaApi.get<NinjaResponse>(
      `/stockprice?ticker=${ticker}`
    );

    // Validate response
    const validationResult = NinjaResponseSchema.Check(response);
    if (!validationResult) {
      throw new Error(
        `Invalid response from Ninja API for ${ticker}: ${JSON.stringify(
          response
        )}`
      );
    }

    return response;
  });
};
