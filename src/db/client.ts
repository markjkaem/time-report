import { Client } from "@planetscale/database";
import { drizzle } from "drizzle-orm/planetscale-serverless";

import { credentials } from "./config";
import * as schema from "./schema";

const ps = new Client(credentials);
// If using PlanetScale Boost:
// (async () => {
//   if (process.env.PS_PROXY) return;
//   await ps.execute("SET @@boost_cached_queries = true");
// })();

// @ts-expect-error - https://github.com/drizzle-team/drizzle-orm/pull/1801
export const db = drizzle(ps, {
  schema,
  logger: {
    logQuery(query: string, params: unknown[]): void {
      // console.log("[DRIZZLE]", { query, params });
    },
  },
});