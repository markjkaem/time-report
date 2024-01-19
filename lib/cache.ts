import "server-only";

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from "next/cache";

import { tson } from "~/lib/tson";

export async function withUnstableCache<
  T extends (...args: any[]) => any,
>(opts: { fn: T; args: Parameters<T>; tags: string[] }) {
  const cachedResult = await unstable_cache(
    async (...args) => {
      const result = await opts.fn(...args);
      return tson.serialize(result);
    },
    opts.tags,
    { tags: opts.tags },
  )(...opts.args);

  return tson.deserialize<Awaited<ReturnType<T>>>(cachedResult);
}