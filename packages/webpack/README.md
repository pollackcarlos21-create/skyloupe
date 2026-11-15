# @skyloupe/webpack

Development loader. It stamps `data-skyloupe-source` and injects `.skyloupe/session.json` into `layout` and `main` modules. `"use client"` stays the first line.

```js
import { applySkyloupeWebpack } from "@skyloupe/webpack";

applySkyloupeWebpack(config, { dev: true, root: __dirname });
```
