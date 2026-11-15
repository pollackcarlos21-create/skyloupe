# @skyloupe/next

App Router helper. `withSkyloupe` adds the webpack loader only while `next dev` is running.

```ts
import { withSkyloupe } from "@skyloupe/next";

export default withSkyloupe({});
```

Mount `@skyloupe/devtools` from a client component when `process.env.NODE_ENV !== "production"`.
