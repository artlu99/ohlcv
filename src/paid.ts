import { Hono } from "hono";
import invariant from "tiny-invariant";
// import { Resource, paymentMiddleware } from "x402-hono";

const honoApp = new Hono();

// const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
// invariant(facilitatorUrl, "FACILITATOR_URL is required");

honoApp
  // .use(
  //   paymentMiddleware(
  //     payTo,
  //     {
  //       "/": {
  //         price: "$0.0001",
  //         network: "base", // use base-sepolia for testing
  //       },
  //     },
  //     {
  //       url: facilitatorUrl,
  //     }
  //   )
  // )
  .get("/", (c) => {
    invariant(process.env.ADDRESS, "ADDRESS is required");
    const payTo = process.env.ADDRESS as `0x${string}`;

    return c.text(`Hello, thank you for paying ${payTo}!`);
  });

// Export the Hono app as a handler
export { honoApp };
