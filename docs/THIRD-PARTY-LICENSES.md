# Third-party license inventory

This file is generated from every committed npm lockfile by
`node scripts/generate-third-party-licenses.mjs`. Do not edit it manually.
It is an engineering inventory, not legal advice.

## Snapshot

- Locked package versions: 1134
- Unique package names: 1042
- Unresolved licenses: 0
- Any `UNKNOWN` entry is a release blocker until evidence is reviewed and recorded.

Lockfile SHA-256 values:

- `app/migrator/package-lock.json`: `d3761f1d249121526b3cb4f4a8672c35d8d497ab5dbc89e2deccd35cc048c613`
- `app/package-lock.json`: `6bedb48d0d844b6e8d5c611bdda923b57f24911b79feec05aea9951b937ae67e`
- `functions/generate-thumbnail/package-lock.json`: `d070e05f98c79467af805bb5a1fb08552ac64d02aa5aff50f3fe6635dbbe54a6`

## License summary

| SPDX expression or status | Package versions |
| --- | ---: |
| `(MIT AND Zlib)` | 1 |
| `(MIT OR CC0-1.0)` | 1 |
| `(MIT OR GPL-3.0-or-later)` | 1 |
| `0BSD` | 1 |
| `Apache-2.0` | 157 |
| `Apache-2.0 AND LGPL-3.0-or-later` | 3 |
| `Apache-2.0 AND LGPL-3.0-or-later AND MIT` | 1 |
| `BlueOak-1.0.0` | 5 |
| `BSD-2-Clause` | 10 |
| `BSD-3-Clause` | 24 |
| `CC-BY-3.0` | 1 |
| `CC-BY-4.0` | 1 |
| `CC0-1.0` | 3 |
| `ISC` | 58 |
| `LGPL-3.0-or-later` | 10 |
| `MIT` | 840 |
| `MIT AND ISC` | 1 |
| `MPL-2.0` | 13 |
| `Python-2.0` | 1 |
| `Unlicense` | 2 |

## Locked packages

Scope is `runtime` when a package is non-development in at least one locked
graph. Evidence identifies whether the license came from the lockfile or a
reviewed metadata override.

| Package | Version | License | Graphs | Scope | Evidence |
| --- | --- | --- | --- | --- | --- |
| `@alloc/quick-lru` | `5.2.0` | `MIT` | app | development | lockfile |
| `@babel/code-frame` | `7.29.7` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@babel/compat-data` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/core` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/generator` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/helper-compilation-targets` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/helper-globals` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/helper-module-imports` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/helper-module-transforms` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/helper-string-parser` | `7.29.7` | `MIT` | app | runtime | lockfile |
| `@babel/helper-validator-identifier` | `7.29.7` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@babel/helper-validator-option` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/helpers` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/parser` | `7.29.7` | `MIT` | app | runtime | lockfile |
| `@babel/template` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/traverse` | `7.29.7` | `MIT` | app | development | lockfile |
| `@babel/types` | `7.29.7` | `MIT` | app | runtime | lockfile |
| `@bcoe/v8-coverage` | `1.0.2` | `MIT` | app | development | lockfile |
| `@duckdb/node-api` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-darwin-arm64` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-darwin-x64` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-linux-arm64` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-linux-arm64-musl` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-linux-x64` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-linux-x64-musl` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-win32-arm64` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@duckdb/node-bindings-win32-x64` | `1.5.4-r.1` | `MIT` | app | runtime | lockfile |
| `@electric-sql/pglite` | `0.4.1` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@electric-sql/pglite-socket` | `0.1.1` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@electric-sql/pglite-tools` | `0.3.1` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@emnapi/core` | `1.10.0` | `MIT` | app | development | lockfile |
| `@emnapi/core` | `1.11.1` | `MIT` | app | development | lockfile |
| `@emnapi/runtime` | `1.10.0` | `MIT` | app | development | lockfile |
| `@emnapi/runtime` | `1.11.1` | `MIT` | app | development | lockfile |
| `@emnapi/runtime` | `1.11.2` | `MIT` | app | runtime | lockfile |
| `@emnapi/wasi-threads` | `1.2.1` | `MIT` | app | development | lockfile |
| `@emnapi/wasi-threads` | `1.2.2` | `MIT` | app | development | lockfile |
| `@esbuild/aix-ppc64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/android-arm` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/android-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/android-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/darwin-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/darwin-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/freebsd-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/freebsd-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-arm` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-ia32` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-loong64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-mips64el` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-ppc64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-riscv64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-s390x` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/linux-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/netbsd-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/netbsd-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/openbsd-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/openbsd-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/openharmony-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/sunos-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/win32-arm64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/win32-ia32` | `0.28.1` | `MIT` | app | development | lockfile |
| `@esbuild/win32-x64` | `0.28.1` | `MIT` | app | development | lockfile |
| `@eslint-community/eslint-utils` | `4.9.1` | `MIT` | app | development | lockfile |
| `@eslint-community/regexpp` | `4.12.2` | `MIT` | app | development | lockfile |
| `@eslint/config-array` | `0.21.2` | `Apache-2.0` | app | development | lockfile |
| `@eslint/config-helpers` | `0.4.2` | `Apache-2.0` | app | development | lockfile |
| `@eslint/core` | `0.17.0` | `Apache-2.0` | app | development | lockfile |
| `@eslint/eslintrc` | `3.3.5` | `MIT` | app | development | lockfile |
| `@eslint/js` | `9.39.4` | `MIT` | app | development | lockfile |
| `@eslint/object-schema` | `2.1.7` | `Apache-2.0` | app | development | lockfile |
| `@eslint/plugin-kit` | `0.4.1` | `Apache-2.0` | app | development | lockfile |
| `@fast-csv/format` | `4.3.5` | `MIT` | app | runtime | lockfile |
| `@fast-csv/parse` | `4.3.6` | `MIT` | app | runtime | lockfile |
| `@fastify/busboy` | `3.2.0` | `MIT` | app | runtime | lockfile |
| `@firebase/ai` | `2.13.1` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/analytics` | `0.10.22` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/analytics-compat` | `0.2.28` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/analytics-types` | `0.8.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app` | `0.15.0` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app-check` | `0.12.0` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app-check-compat` | `0.4.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app-check-interop-types` | `0.3.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app-check-types` | `0.5.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app-compat` | `0.5.14` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/app-types` | `0.9.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/auth` | `1.13.3` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/auth-compat` | `0.6.8` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/auth-interop-types` | `0.2.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/auth-types` | `0.13.1` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/component` | `0.7.3` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/data-connect` | `0.7.1` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/database` | `1.1.3` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/database-compat` | `2.1.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/database-types` | `1.0.20` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/firestore` | `4.16.0` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/firestore-compat` | `0.4.11` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/firestore-types` | `3.0.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/functions` | `0.13.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/functions-compat` | `0.4.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/functions-types` | `0.6.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/installations` | `0.6.22` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/installations-compat` | `0.2.22` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/installations-types` | `0.5.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/logger` | `0.5.1` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/messaging` | `0.13.0` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/messaging-compat` | `0.2.27` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/messaging-interop-types` | `0.2.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/performance` | `0.7.12` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/performance-compat` | `0.2.25` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/performance-types` | `0.2.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/remote-config` | `0.8.5` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/remote-config-compat` | `0.2.26` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/remote-config-types` | `0.5.1` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/rules-unit-testing` | `5.0.1` | `Apache-2.0` | app | development | lockfile |
| `@firebase/storage` | `0.14.3` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/storage-compat` | `0.4.3` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/storage-types` | `0.8.4` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/util` | `1.15.1` | `Apache-2.0` | app | runtime | lockfile |
| `@firebase/webchannel-wrapper` | `1.0.6` | `Apache-2.0` | app | runtime | lockfile |
| `@floating-ui/core` | `1.7.5` | `MIT` | app | runtime | lockfile |
| `@floating-ui/dom` | `1.7.6` | `MIT` | app | runtime | lockfile |
| `@floating-ui/react-dom` | `2.1.8` | `MIT` | app | runtime | lockfile |
| `@floating-ui/utils` | `0.2.11` | `MIT` | app | runtime | lockfile |
| `@google-cloud/firestore` | `7.11.6` | `Apache-2.0` | app | runtime | lockfile |
| `@google-cloud/firestore` | `8.6.0` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `@google-cloud/functions-framework` | `5.0.5` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `@google-cloud/paginator` | `5.0.2` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@google-cloud/projectify` | `4.0.0` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@google-cloud/promisify` | `4.0.0` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@google-cloud/storage` | `7.21.0` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@grpc/grpc-js` | `1.14.4` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@grpc/grpc-js` | `1.9.16` | `Apache-2.0` | app | runtime | lockfile |
| `@grpc/proto-loader` | `0.7.15` | `Apache-2.0` | app | runtime | lockfile |
| `@grpc/proto-loader` | `0.8.1` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@hono/node-server` | `1.19.13` | `MIT` | app, app/migrator | runtime | lockfile |
| `@humanfs/core` | `0.19.2` | `Apache-2.0` | app | development | lockfile |
| `@humanfs/node` | `0.16.8` | `Apache-2.0` | app | development | lockfile |
| `@humanfs/types` | `0.15.0` | `Apache-2.0` | app | development | lockfile |
| `@humanwhocodes/module-importer` | `1.0.1` | `Apache-2.0` | app | development | lockfile |
| `@humanwhocodes/retry` | `0.4.3` | `Apache-2.0` | app | development | lockfile |
| `@img/colour` | `1.1.0` | `MIT` | app | runtime | lockfile |
| `@img/sharp-darwin-arm64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-darwin-x64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-libvips-darwin-arm64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-darwin-x64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linux-arm` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linux-arm64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linux-ppc64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linux-riscv64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linux-s390x` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linux-x64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linuxmusl-arm64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-libvips-linuxmusl-x64` | `1.2.4` | `LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-linux-arm` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linux-arm64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linux-ppc64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linux-riscv64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linux-s390x` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linux-x64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linuxmusl-arm64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-linuxmusl-x64` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `@img/sharp-wasm32` | `0.34.5` | `Apache-2.0 AND LGPL-3.0-or-later AND MIT` | app | runtime | lockfile |
| `@img/sharp-win32-arm64` | `0.34.5` | `Apache-2.0 AND LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-win32-ia32` | `0.34.5` | `Apache-2.0 AND LGPL-3.0-or-later` | app | runtime | lockfile |
| `@img/sharp-win32-x64` | `0.34.5` | `Apache-2.0 AND LGPL-3.0-or-later` | app | runtime | lockfile |
| `@isaacs/cliui` | `8.0.2` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `@jridgewell/gen-mapping` | `0.3.13` | `MIT` | app | development | lockfile |
| `@jridgewell/remapping` | `2.3.5` | `MIT` | app | development | lockfile |
| `@jridgewell/resolve-uri` | `3.1.2` | `MIT` | app | development | lockfile |
| `@jridgewell/sourcemap-codec` | `1.5.5` | `MIT` | app | development | lockfile |
| `@jridgewell/trace-mapping` | `0.3.31` | `MIT` | app | development | lockfile |
| `@js-sdsl/ordered-map` | `4.4.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@kurkle/color` | `0.3.4` | `MIT` | app, app/migrator | runtime | lockfile |
| `@napi-rs/wasm-runtime` | `1.1.4` | `MIT` | app | development | lockfile |
| `@napi-rs/wasm-runtime` | `1.1.6` | `MIT` | app | development | lockfile |
| `@next/env` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/eslint-plugin-next` | `16.2.10` | `MIT` | app | development | lockfile |
| `@next/swc-darwin-arm64` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-darwin-x64` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-linux-arm64-gnu` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-linux-arm64-musl` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-linux-x64-gnu` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-linux-x64-musl` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-win32-arm64-msvc` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@next/swc-win32-x64-msvc` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `@nodable/entities` | `2.2.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@nodelib/fs.scandir` | `2.1.5` | `MIT` | app | development | lockfile |
| `@nodelib/fs.stat` | `2.0.5` | `MIT` | app | development | lockfile |
| `@nodelib/fs.walk` | `1.2.8` | `MIT` | app | development | lockfile |
| `@nolyfill/is-core-module` | `1.0.39` | `MIT` | app | development | lockfile |
| `@opentelemetry/api` | `1.9.1` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `@oxc-project/types` | `0.138.0` | `MIT` | app | development | lockfile |
| `@pkgjs/parseargs` | `0.11.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@playwright/test` | `1.61.1` | `Apache-2.0` | app | runtime | lockfile |
| `@prisma/adapter-pg` | `7.8.0` | `Apache-2.0` | app | runtime | lockfile |
| `@prisma/client` | `7.8.0` | `Apache-2.0` | app | runtime | lockfile |
| `@prisma/client-runtime-utils` | `7.8.0` | `Apache-2.0` | app | runtime | lockfile |
| `@prisma/config` | `7.8.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/debug` | `7.2.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/debug` | `7.8.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/dev` | `0.24.3` | `ISC` | app, app/migrator | runtime | lockfile |
| `@prisma/driver-adapter-utils` | `7.8.0` | `Apache-2.0` | app | runtime | lockfile |
| `@prisma/engines` | `7.8.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/engines-version` | `7.8.0-6.3c6e192761c0362d496ed980de936e2f3cebcd3a` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/fetch-engine` | `7.8.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/get-platform` | `7.2.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/get-platform` | `7.8.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/query-plan-executor` | `7.2.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/streams-local` | `0.1.2` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@prisma/studio-core` | `0.27.3` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `@protobufjs/aspromise` | `1.1.2` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/base64` | `1.1.2` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/codegen` | `2.0.5` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/eventemitter` | `1.1.1` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/fetch` | `1.1.1` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/float` | `1.0.2` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/path` | `1.1.2` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/pool` | `1.1.0` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `@protobufjs/utf8` | `1.1.1` | `BSD-3-Clause` | app | runtime | lockfile |
| `@protobufjs/utf8` | `1.1.2` | `BSD-3-Clause` | functions/generate-thumbnail | runtime | lockfile |
| `@puppeteer/browsers` | `3.0.6` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `@radix-ui/number` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/primitive` | `1.1.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/primitive` | `1.1.5` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-accessible-icon` | `1.1.11` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-accordion` | `1.2.16` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-alert-dialog` | `1.1.19` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-arrow` | `1.1.11` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-aspect-ratio` | `1.1.11` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-avatar` | `1.2.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-checkbox` | `1.3.7` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-collapsible` | `1.1.16` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-collection` | `1.1.12` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-compose-refs` | `1.1.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-compose-refs` | `1.1.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-context` | `1.2.0` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-context-menu` | `2.3.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-dialog` | `1.1.19` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-direction` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-dismissable-layer` | `1.1.15` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-dropdown-menu` | `2.1.20` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-focus-guards` | `1.1.4` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-focus-scope` | `1.1.12` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-form` | `0.1.12` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-hover-card` | `1.1.19` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-id` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-label` | `2.1.11` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-menu` | `2.1.20` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-menubar` | `1.1.20` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-navigation-menu` | `1.2.18` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-one-time-password-field` | `0.1.12` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-password-toggle-field` | `0.1.7` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-popover` | `1.1.19` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-popper` | `1.3.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-portal` | `1.1.13` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-presence` | `1.1.7` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-primitive` | `2.1.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-primitive` | `2.1.7` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-progress` | `1.1.12` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-radio-group` | `1.4.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-roving-focus` | `1.1.15` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-scroll-area` | `1.2.14` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-select` | `2.3.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-separator` | `1.1.11` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-slider` | `1.4.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-slot` | `1.2.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-slot` | `1.3.0` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-switch` | `1.3.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-tabs` | `1.1.17` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-toast` | `1.2.19` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-toggle` | `1.1.10` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-toggle` | `1.1.14` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-toggle-group` | `1.1.15` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-toolbar` | `1.1.15` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-tooltip` | `1.2.12` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-callback-ref` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-controllable-state` | `1.2.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-use-controllable-state` | `1.2.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-effect-event` | `0.0.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-use-effect-event` | `0.0.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-escape-keydown` | `1.1.3` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-is-hydrated` | `0.1.1` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-layout-effect` | `1.1.1` | `MIT` | app, app/migrator | runtime | lockfile |
| `@radix-ui/react-use-layout-effect` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-previous` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-rect` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-use-size` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@radix-ui/react-visually-hidden` | `1.2.7` | `MIT` | app | runtime | lockfile |
| `@radix-ui/rect` | `1.1.2` | `MIT` | app | runtime | lockfile |
| `@reduxjs/toolkit` | `2.12.0` | `MIT` | app | runtime | lockfile |
| `@rolldown/binding-android-arm64` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-darwin-arm64` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-darwin-x64` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-freebsd-x64` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-arm-gnueabihf` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-arm64-gnu` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-arm64-musl` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-ppc64-gnu` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-s390x-gnu` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-x64-gnu` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-linux-x64-musl` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-openharmony-arm64` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-wasm32-wasi` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-win32-arm64-msvc` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/binding-win32-x64-msvc` | `1.1.4` | `MIT` | app | development | lockfile |
| `@rolldown/pluginutils` | `1.0.1` | `MIT` | app | development | lockfile |
| `@rtsao/scc` | `1.1.0` | `MIT` | app | development | lockfile |
| `@sparticuz/chromium` | `149.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@standard-schema/spec` | `1.1.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `@standard-schema/utils` | `0.3.0` | `MIT` | app | runtime | lockfile |
| `@swc/helpers` | `0.5.15` | `Apache-2.0` | app | runtime | lockfile |
| `@tailwindcss/node` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-android-arm64` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-darwin-arm64` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-darwin-x64` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-freebsd-x64` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-linux-arm-gnueabihf` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-linux-arm64-gnu` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-linux-arm64-musl` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-linux-x64-gnu` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-linux-x64-musl` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-wasm32-wasi` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-win32-arm64-msvc` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/oxide-win32-x64-msvc` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tailwindcss/postcss` | `4.3.2` | `MIT` | app | development | lockfile |
| `@tootallnate/once` | `2.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@tybys/wasm-util` | `0.10.2` | `MIT` | app | development | lockfile |
| `@tybys/wasm-util` | `0.10.3` | `MIT` | app | development | lockfile |
| `@types/adm-zip` | `0.5.8` | `MIT` | app | development | lockfile |
| `@types/body-parser` | `1.19.6` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/caseless` | `0.12.5` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@types/chai` | `5.2.3` | `MIT` | app | development | lockfile |
| `@types/connect` | `3.4.38` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/d3-array` | `3.2.2` | `MIT` | app | runtime | lockfile |
| `@types/d3-color` | `3.1.3` | `MIT` | app | runtime | lockfile |
| `@types/d3-ease` | `3.0.2` | `MIT` | app | runtime | lockfile |
| `@types/d3-interpolate` | `3.0.4` | `MIT` | app | runtime | lockfile |
| `@types/d3-path` | `3.1.1` | `MIT` | app | runtime | lockfile |
| `@types/d3-scale` | `4.0.9` | `MIT` | app | runtime | lockfile |
| `@types/d3-shape` | `3.1.8` | `MIT` | app | runtime | lockfile |
| `@types/d3-time` | `3.0.4` | `MIT` | app | runtime | lockfile |
| `@types/d3-timer` | `3.0.2` | `MIT` | app | runtime | lockfile |
| `@types/deep-eql` | `4.0.2` | `MIT` | app | development | lockfile |
| `@types/estree` | `1.0.9` | `MIT` | app | development | lockfile |
| `@types/express` | `5.0.6` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/express-serve-static-core` | `5.1.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/http-errors` | `2.0.5` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/json-schema` | `7.0.15` | `MIT` | app | development | lockfile |
| `@types/json5` | `0.0.29` | `MIT` | app | development | lockfile |
| `@types/jsonwebtoken` | `9.0.10` | `MIT` | app | runtime | lockfile |
| `@types/long` | `4.0.2` | `MIT` | app | runtime | lockfile |
| `@types/ms` | `2.1.0` | `MIT` | app | runtime | lockfile |
| `@types/node` | `14.18.63` | `MIT` | app | runtime | lockfile |
| `@types/node` | `26.1.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@types/normalize-package-data` | `2.4.4` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/pegjs` | `0.10.6` | `MIT` | app | runtime | lockfile |
| `@types/pg` | `8.20.0` | `MIT` | app | runtime | lockfile |
| `@types/qs` | `6.15.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/range-parser` | `1.2.7` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/react` | `19.2.17` | `MIT` | app, app/migrator | runtime | lockfile |
| `@types/react-dom` | `19.2.3` | `MIT` | app | runtime | lockfile |
| `@types/request` | `2.48.13` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@types/send` | `1.2.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/serve-static` | `2.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `@types/tough-cookie` | `4.0.5` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `@types/use-sync-external-store` | `0.0.6` | `MIT` | app | runtime | lockfile |
| `@typescript-eslint/eslint-plugin` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/parser` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/project-service` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/scope-manager` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/tsconfig-utils` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/type-utils` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/types` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/typescript-estree` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/utils` | `8.62.1` | `MIT` | app | development | lockfile |
| `@typescript-eslint/visitor-keys` | `8.62.1` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-android-arm-eabi` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-android-arm64` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-darwin-arm64` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-darwin-x64` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-freebsd-x64` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-arm-gnueabihf` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-arm-musleabihf` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-arm64-gnu` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-arm64-musl` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-loong64-gnu` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-loong64-musl` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-ppc64-gnu` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-riscv64-gnu` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-riscv64-musl` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-s390x-gnu` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-x64-gnu` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-linux-x64-musl` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-openharmony-arm64` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-wasm32-wasi` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-win32-arm64-msvc` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-win32-ia32-msvc` | `1.12.2` | `MIT` | app | development | lockfile |
| `@unrs/resolver-binding-win32-x64-msvc` | `1.12.2` | `MIT` | app | development | lockfile |
| `@vitest/coverage-v8` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/expect` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/mocker` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/pretty-format` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/runner` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/snapshot` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/spy` | `4.1.10` | `MIT` | app | development | lockfile |
| `@vitest/utils` | `4.1.10` | `MIT` | app | development | lockfile |
| `abort-controller` | `3.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `accepts` | `2.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `acorn` | `8.17.0` | `MIT` | app | development | lockfile |
| `acorn-jsx` | `5.3.2` | `MIT` | app | development | lockfile |
| `adm-zip` | `0.5.18` | `MIT` | app | runtime | lockfile |
| `agent-base` | `6.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `agent-base` | `7.1.4` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `ajv` | `6.15.0` | `MIT` | app | development | lockfile |
| `ajv` | `8.20.0` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `ajv-formats` | `2.1.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `ansi-regex` | `5.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `ansi-regex` | `6.2.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `ansi-styles` | `4.3.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `ansi-styles` | `6.2.3` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `anynum` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `archiver` | `5.3.2` | `MIT` | app | runtime | lockfile |
| `archiver-utils` | `2.1.0` | `MIT` | app | runtime | lockfile |
| `archiver-utils` | `3.0.4` | `MIT` | app | runtime | lockfile |
| `argparse` | `2.0.1` | `Python-2.0` | app | development | lockfile |
| `aria-hidden` | `1.2.6` | `MIT` | app | runtime | lockfile |
| `aria-query` | `5.3.2` | `Apache-2.0` | app | development | lockfile |
| `array-buffer-byte-length` | `1.0.2` | `MIT` | app | development | lockfile |
| `array-includes` | `3.1.9` | `MIT` | app | development | lockfile |
| `array.prototype.findlast` | `1.2.5` | `MIT` | app | development | lockfile |
| `array.prototype.findlastindex` | `1.2.6` | `MIT` | app | development | lockfile |
| `array.prototype.flat` | `1.3.3` | `MIT` | app | development | lockfile |
| `array.prototype.flatmap` | `1.3.3` | `MIT` | app | development | lockfile |
| `array.prototype.tosorted` | `1.1.4` | `MIT` | app | development | lockfile |
| `arraybuffer.prototype.slice` | `1.0.4` | `MIT` | app | development | lockfile |
| `arrify` | `2.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `assertion-error` | `2.0.1` | `MIT` | app | development | lockfile |
| `ast-types-flow` | `0.0.8` | `MIT` | app | development | lockfile |
| `ast-v8-to-istanbul` | `1.0.4` | `MIT` | app | development | lockfile |
| `async` | `3.2.6` | `MIT` | app | runtime | lockfile |
| `async-function` | `1.0.0` | `MIT` | app | development | lockfile |
| `async-retry` | `1.3.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `asynckit` | `0.4.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `available-typed-arrays` | `1.0.7` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `aws-ssl-profiles` | `1.1.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `axe-core` | `4.12.1` | `MPL-2.0` | app | development | lockfile |
| `axobject-query` | `4.1.0` | `Apache-2.0` | app | development | lockfile |
| `b4a` | `1.8.1` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `balanced-match` | `1.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `balanced-match` | `4.0.4` | `MIT` | app | development | lockfile |
| `bare-events` | `2.9.1` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `bare-fs` | `4.7.4` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `bare-path` | `3.1.1` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `bare-stream` | `2.13.3` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `bare-url` | `2.4.5` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `base64-js` | `1.5.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `baseline-browser-mapping` | `2.10.42` | `Apache-2.0` | app | runtime | lockfile |
| `better-result` | `2.9.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `big-integer` | `1.6.52` | `Unlicense` | app | runtime | lockfile |
| `bignumber.js` | `9.3.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `bl` | `4.1.0` | `MIT` | app | runtime | lockfile |
| `bluebird` | `3.7.2` | `MIT` | app | runtime | lockfile |
| `body-parser` | `2.3.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `brace-expansion` | `1.1.15` | `MIT` | app | runtime | lockfile |
| `brace-expansion` | `2.1.1` | `MIT` | app | runtime | lockfile |
| `brace-expansion` | `2.1.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `brace-expansion` | `5.0.7` | `MIT` | app | development | lockfile |
| `braces` | `3.0.3` | `MIT` | app | development | lockfile |
| `browserslist` | `4.28.4` | `MIT` | app | development | lockfile |
| `buffer` | `5.7.1` | `MIT` | app | runtime | lockfile |
| `buffer-crc32` | `0.2.13` | `MIT` | app | runtime | lockfile |
| `buffer-equal-constant-time` | `1.0.1` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `bytes` | `3.1.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `c12` | `3.3.4` | `MIT` | app, app/migrator | runtime | lockfile |
| `call-bind` | `1.0.9` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `call-bind-apply-helpers` | `1.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `call-bound` | `1.0.4` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `callsites` | `3.1.0` | `MIT` | app | development | lockfile |
| `caniuse-lite` | `1.0.30001800` | `CC-BY-4.0` | app | runtime | lockfile |
| `chai` | `6.2.2` | `MIT` | app | development | lockfile |
| `chalk` | `4.1.2` | `MIT` | app | development | lockfile |
| `chart.js` | `4.5.1` | `MIT` | app, app/migrator | runtime | lockfile |
| `chokidar` | `5.0.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `chromium-bidi` | `16.0.1` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `class-variance-authority` | `0.7.1` | `Apache-2.0` | app | runtime | lockfile |
| `client-only` | `0.0.1` | `MIT` | app | runtime | lockfile |
| `cliui` | `8.0.1` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `cliui` | `9.0.1` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `cloudevents` | `10.0.0` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `clsx` | `2.1.1` | `MIT` | app | runtime | lockfile |
| `color-convert` | `2.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `color-name` | `1.1.4` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `combined-stream` | `1.0.8` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `compress-commons` | `4.1.2` | `MIT` | app | runtime | lockfile |
| `concat-map` | `0.0.1` | `MIT` | app | runtime | lockfile |
| `confbox` | `0.2.4` | `MIT` | app, app/migrator | runtime | lockfile |
| `content-disposition` | `1.1.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `content-type` | `1.0.5` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `content-type` | `2.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `convert-source-map` | `2.0.0` | `MIT` | app | development | lockfile |
| `cookie` | `0.7.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `cookie-signature` | `1.2.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `core-util-is` | `1.0.3` | `MIT` | app | runtime | lockfile |
| `crc-32` | `1.2.2` | `Apache-2.0` | app | runtime | lockfile |
| `crc32-stream` | `4.0.3` | `MIT` | app | runtime | lockfile |
| `cross-spawn` | `7.0.6` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `csstype` | `3.2.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `csv-parse` | `5.6.0` | `MIT` | app | runtime | lockfile |
| `d3-array` | `3.2.4` | `ISC` | app | runtime | lockfile |
| `d3-color` | `3.1.0` | `ISC` | app | runtime | lockfile |
| `d3-ease` | `3.0.1` | `BSD-3-Clause` | app | runtime | lockfile |
| `d3-format` | `3.1.2` | `ISC` | app | runtime | lockfile |
| `d3-interpolate` | `3.0.1` | `ISC` | app | runtime | lockfile |
| `d3-path` | `3.1.0` | `ISC` | app | runtime | lockfile |
| `d3-scale` | `4.0.2` | `ISC` | app | runtime | lockfile |
| `d3-shape` | `3.2.0` | `ISC` | app | runtime | lockfile |
| `d3-time` | `3.1.0` | `ISC` | app | runtime | lockfile |
| `d3-time-format` | `4.1.0` | `ISC` | app | runtime | lockfile |
| `d3-timer` | `3.0.1` | `ISC` | app | runtime | lockfile |
| `damerau-levenshtein` | `1.0.8` | `BSD-2-Clause` | app | development | lockfile |
| `data-uri-to-buffer` | `4.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `data-view-buffer` | `1.0.2` | `MIT` | app | development | lockfile |
| `data-view-byte-length` | `1.0.2` | `MIT` | app | development | lockfile |
| `data-view-byte-offset` | `1.0.1` | `MIT` | app | development | lockfile |
| `dayjs` | `1.11.21` | `MIT` | app | runtime | lockfile |
| `debug` | `3.2.7` | `MIT` | app | development | lockfile |
| `debug` | `4.4.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `decimal.js-light` | `2.5.1` | `MIT` | app | runtime | lockfile |
| `deep-is` | `0.1.4` | `MIT` | app | development | lockfile |
| `deepmerge-ts` | `7.1.5` | `BSD-3-Clause` | app, app/migrator | runtime | lockfile |
| `define-data-property` | `1.1.4` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `define-properties` | `1.2.1` | `MIT` | app | development | lockfile |
| `defu` | `6.1.7` | `MIT` | app, app/migrator | runtime | lockfile |
| `delayed-stream` | `1.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `denque` | `2.1.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `depd` | `2.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `destr` | `2.0.5` | `MIT` | app, app/migrator | runtime | lockfile |
| `detect-libc` | `2.1.2` | `Apache-2.0` | app | runtime | lockfile |
| `detect-node-es` | `1.1.0` | `MIT` | app | runtime | lockfile |
| `devtools-protocol` | `0.0.1638949` | `BSD-3-Clause` | functions/generate-thumbnail | runtime | lockfile |
| `doctrine` | `2.1.0` | `Apache-2.0` | app | development | lockfile |
| `dotenv` | `17.4.2` | `BSD-2-Clause` | app, app/migrator | runtime | lockfile |
| `dunder-proto` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `duplexer2` | `0.1.4` | `BSD-3-Clause` | app | runtime | lockfile |
| `duplexify` | `4.1.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `eastasianwidth` | `0.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `ecdsa-sig-formatter` | `1.0.11` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `ee-first` | `1.1.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `effect` | `3.20.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `electron-to-chromium` | `1.5.387` | `ISC` | app | development | lockfile |
| `emoji-regex` | `10.6.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `emoji-regex` | `8.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `emoji-regex` | `9.2.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `empathic` | `2.0.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `encodeurl` | `2.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `end-of-stream` | `1.4.5` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `enhanced-resolve` | `5.21.6` | `MIT` | app | development | lockfile |
| `env-paths` | `3.0.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `es-abstract` | `1.24.2` | `MIT` | app | development | lockfile |
| `es-abstract-get` | `1.0.0` | `MIT` | app | development | lockfile |
| `es-define-property` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `es-errors` | `1.3.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `es-iterator-helpers` | `1.3.3` | `MIT` | app | development | lockfile |
| `es-module-lexer` | `2.3.0` | `MIT` | app | development | lockfile |
| `es-object-atoms` | `1.1.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `es-set-tostringtag` | `2.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `es-shim-unscopables` | `1.1.0` | `MIT` | app | development | lockfile |
| `es-to-primitive` | `1.3.4` | `MIT` | app | development | lockfile |
| `es-toolkit` | `1.49.0` | `MIT` | app | runtime | lockfile |
| `esbuild` | `0.28.1` | `MIT` | app | development | lockfile |
| `escalade` | `3.2.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `escape-html` | `1.0.3` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `escape-string-regexp` | `4.0.0` | `MIT` | app | development | lockfile |
| `eslint` | `9.39.4` | `MIT` | app | development | lockfile |
| `eslint-config-next` | `16.2.10` | `MIT` | app | development | lockfile |
| `eslint-import-resolver-node` | `0.3.10` | `MIT` | app | development | lockfile |
| `eslint-import-resolver-typescript` | `3.10.1` | `ISC` | app | development | lockfile |
| `eslint-module-utils` | `2.14.0` | `MIT` | app | development | lockfile |
| `eslint-plugin-import` | `2.32.0` | `MIT` | app | development | lockfile |
| `eslint-plugin-jsx-a11y` | `6.10.2` | `MIT` | app | development | lockfile |
| `eslint-plugin-react` | `7.37.5` | `MIT` | app | development | lockfile |
| `eslint-plugin-react-hooks` | `7.1.1` | `MIT` | app | development | lockfile |
| `eslint-scope` | `8.4.0` | `BSD-2-Clause` | app | development | lockfile |
| `eslint-visitor-keys` | `3.4.3` | `Apache-2.0` | app | development | lockfile |
| `eslint-visitor-keys` | `4.2.1` | `Apache-2.0` | app | development | lockfile |
| `eslint-visitor-keys` | `5.0.1` | `Apache-2.0` | app | development | lockfile |
| `espree` | `10.4.0` | `BSD-2-Clause` | app | development | lockfile |
| `esquery` | `1.7.0` | `BSD-3-Clause` | app | development | lockfile |
| `esrecurse` | `4.3.0` | `BSD-2-Clause` | app | development | lockfile |
| `estraverse` | `5.3.0` | `BSD-2-Clause` | app | development | lockfile |
| `estree-walker` | `3.0.3` | `MIT` | app | development | lockfile |
| `esutils` | `2.0.3` | `BSD-2-Clause` | app | development | lockfile |
| `etag` | `1.8.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `event-target-shim` | `5.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `eventemitter3` | `5.0.4` | `MIT` | app | runtime | lockfile |
| `events-universal` | `1.0.1` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `exceljs` | `4.4.0` | `MIT` | app | runtime | lockfile |
| `expect-type` | `1.4.0` | `Apache-2.0` | app | development | lockfile |
| `express` | `5.2.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `exsolve` | `1.1.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `extend` | `3.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `farmhash-modern` | `1.1.0` | `MIT` | app | runtime | lockfile |
| `fast-check` | `3.23.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `fast-csv` | `4.3.6` | `MIT` | app | runtime | lockfile |
| `fast-deep-equal` | `3.1.3` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `fast-fifo` | `1.3.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `fast-glob` | `3.3.1` | `MIT` | app | development | lockfile |
| `fast-json-stable-stringify` | `2.1.0` | `MIT` | app | development | lockfile |
| `fast-levenshtein` | `2.0.6` | `MIT` | app | development | lockfile |
| `fast-uri` | `3.1.3` | `BSD-3-Clause` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `fast-xml-builder` | `1.2.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `fast-xml-parser` | `5.9.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `fastq` | `1.20.1` | `ISC` | app | development | lockfile |
| `faye-websocket` | `0.11.4` | `Apache-2.0` | app | runtime | lockfile |
| `fdir` | `6.5.0` | `MIT` | app | development | lockfile |
| `fetch-blob` | `3.2.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `file-entry-cache` | `8.0.0` | `MIT` | app | development | lockfile |
| `fill-range` | `7.1.1` | `MIT` | app | development | lockfile |
| `finalhandler` | `2.1.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `find-up` | `5.0.0` | `MIT` | app | development | lockfile |
| `find-up-simple` | `1.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `firebase` | `12.15.0` | `Apache-2.0` | app | runtime | lockfile |
| `firebase-admin` | `13.10.0` | `Apache-2.0` | app | runtime | lockfile |
| `flat-cache` | `4.0.1` | `MIT` | app | development | lockfile |
| `flatted` | `3.4.2` | `ISC` | app | development | lockfile |
| `for-each` | `0.3.5` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `foreground-child` | `3.3.1` | `ISC` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `form-data` | `2.5.6` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `formdata-polyfill` | `4.0.10` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `forwarded` | `0.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `fresh` | `2.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `fs-constants` | `1.0.0` | `MIT` | app | runtime | lockfile |
| `fs-extra` | `11.3.1` | `MIT` | app | runtime | lockfile |
| `fs.realpath` | `1.0.0` | `ISC` | app | runtime | lockfile |
| `fsevents` | `2.3.2` | `MIT` | app | runtime | lockfile |
| `fsevents` | `2.3.3` | `MIT` | app | development | lockfile |
| `function-bind` | `1.1.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `function.prototype.name` | `1.2.0` | `MIT` | app | development | lockfile |
| `functional-red-black-tree` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `functions-have-names` | `1.2.3` | `MIT` | app | development | lockfile |
| `gaxios` | `6.7.1` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `gaxios` | `7.1.3` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `gaxios` | `7.1.5` | `Apache-2.0` | app | runtime | lockfile |
| `gaxios` | `7.2.0` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `gcp-metadata` | `6.1.1` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `gcp-metadata` | `8.1.2` | `Apache-2.0` | app | runtime | lockfile |
| `gcp-metadata` | `8.1.3` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `generate-function` | `2.3.1` | `MIT` | app, app/migrator | runtime | lockfile |
| `generator-function` | `2.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `gensync` | `1.0.0-beta.2` | `MIT` | app | development | lockfile |
| `get-caller-file` | `2.0.5` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `get-east-asian-width` | `1.6.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `get-intrinsic` | `1.3.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `get-nonce` | `1.0.1` | `MIT` | app | runtime | lockfile |
| `get-port-please` | `3.2.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `get-proto` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `get-symbol-description` | `1.1.0` | `MIT` | app | development | lockfile |
| `get-tsconfig` | `4.14.0` | `MIT` | app | development | lockfile |
| `giget` | `3.3.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `glob` | `10.5.0` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `glob` | `7.2.3` | `ISC` | app | runtime | lockfile |
| `glob-parent` | `5.1.2` | `ISC` | app | development | lockfile |
| `glob-parent` | `6.0.2` | `ISC` | app | development | lockfile |
| `globals` | `14.0.0` | `MIT` | app | development | lockfile |
| `globals` | `16.4.0` | `MIT` | app | development | lockfile |
| `globalthis` | `1.0.4` | `MIT` | app | development | lockfile |
| `google-auth-library` | `10.5.0` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `google-auth-library` | `10.9.0` | `Apache-2.0` | app | runtime | lockfile |
| `google-auth-library` | `9.15.1` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `google-gax` | `4.6.1` | `Apache-2.0` | app | runtime | lockfile |
| `google-gax` | `5.0.7` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `google-logging-utils` | `0.0.2` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `google-logging-utils` | `1.1.3` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `gopd` | `1.2.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `graceful-fs` | `4.2.11` | `ISC` | app, app/migrator | runtime | lockfile |
| `grammex` | `3.1.12` | `MIT` | app, app/migrator | runtime | lockfile |
| `graphmatch` | `1.1.1` | `MIT` | app, app/migrator | runtime | lockfile |
| `gtoken` | `7.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `gtoken` | `8.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `has-bigints` | `1.1.0` | `MIT` | app | development | lockfile |
| `has-flag` | `4.0.0` | `MIT` | app | development | lockfile |
| `has-property-descriptors` | `1.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `has-proto` | `1.2.0` | `MIT` | app | development | lockfile |
| `has-symbols` | `1.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `has-tostringtag` | `1.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `hasown` | `2.0.4` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `hermes-estree` | `0.25.1` | `MIT` | app | development | lockfile |
| `hermes-parser` | `0.25.1` | `MIT` | app | development | lockfile |
| `hono` | `4.12.28` | `MIT` | app | runtime | lockfile |
| `hono` | `4.12.29` | `MIT` | app/migrator | runtime | lockfile |
| `hosted-git-info` | `7.0.2` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `html-entities` | `2.6.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `html-escaper` | `2.0.2` | `MIT` | app | development | lockfile |
| `http-errors` | `2.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `http-parser-js` | `0.5.10` | `MIT` | app | runtime | lockfile |
| `http-proxy-agent` | `5.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `http-proxy-agent` | `7.0.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `http-status-codes` | `2.3.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `https-proxy-agent` | `5.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `https-proxy-agent` | `7.0.6` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `iconv-lite` | `0.7.3` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `idb` | `7.1.1` | `ISC` | app | runtime | lockfile |
| `ieee754` | `1.2.1` | `BSD-3-Clause` | app | runtime | lockfile |
| `ignore` | `5.3.2` | `MIT` | app | development | lockfile |
| `ignore` | `7.0.5` | `MIT` | app | development | lockfile |
| `immediate` | `3.0.6` | `MIT` | app | runtime | lockfile |
| `immer` | `11.1.11` | `MIT` | app | runtime | lockfile |
| `import-fresh` | `3.3.1` | `MIT` | app | development | lockfile |
| `imurmurhash` | `0.1.4` | `MIT` | app | development | lockfile |
| `index-to-position` | `1.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `inflight` | `1.0.6` | `ISC` | app | runtime | lockfile |
| `inherits` | `2.0.4` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `internal-slot` | `1.1.0` | `MIT` | app | development | lockfile |
| `internmap` | `2.0.3` | `ISC` | app | runtime | lockfile |
| `ipaddr.js` | `1.9.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `is-arguments` | `1.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `is-array-buffer` | `3.0.5` | `MIT` | app | development | lockfile |
| `is-async-function` | `2.1.1` | `MIT` | app | development | lockfile |
| `is-bigint` | `1.1.0` | `MIT` | app | development | lockfile |
| `is-boolean-object` | `1.2.2` | `MIT` | app | development | lockfile |
| `is-bun-module` | `2.0.0` | `MIT` | app | development | lockfile |
| `is-callable` | `1.2.7` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-core-module` | `2.16.2` | `MIT` | app | development | lockfile |
| `is-data-view` | `1.0.2` | `MIT` | app | development | lockfile |
| `is-date-object` | `1.1.0` | `MIT` | app | development | lockfile |
| `is-document.all` | `1.0.0` | `MIT` | app | development | lockfile |
| `is-extglob` | `2.1.1` | `MIT` | app | development | lockfile |
| `is-finalizationregistry` | `1.1.1` | `MIT` | app | development | lockfile |
| `is-fullwidth-code-point` | `3.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-generator-function` | `1.1.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-glob` | `4.0.3` | `MIT` | app | development | lockfile |
| `is-map` | `2.0.3` | `MIT` | app | development | lockfile |
| `is-negative-zero` | `2.0.3` | `MIT` | app | development | lockfile |
| `is-number` | `7.0.0` | `MIT` | app | development | lockfile |
| `is-number-object` | `1.1.1` | `MIT` | app | development | lockfile |
| `is-promise` | `4.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `is-property` | `1.0.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `is-regex` | `1.2.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-set` | `2.0.3` | `MIT` | app | development | lockfile |
| `is-shared-array-buffer` | `1.0.4` | `MIT` | app | development | lockfile |
| `is-stream` | `2.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-string` | `1.1.1` | `MIT` | app | development | lockfile |
| `is-symbol` | `1.1.1` | `MIT` | app | development | lockfile |
| `is-typed-array` | `1.1.15` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-unsafe` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `is-weakmap` | `2.0.2` | `MIT` | app | development | lockfile |
| `is-weakref` | `1.1.1` | `MIT` | app | development | lockfile |
| `is-weakset` | `2.0.4` | `MIT` | app | development | lockfile |
| `isarray` | `1.0.0` | `MIT` | app | runtime | lockfile |
| `isarray` | `2.0.5` | `MIT` | app | development | lockfile |
| `isexe` | `2.0.0` | `ISC` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `istanbul-lib-coverage` | `3.2.2` | `BSD-3-Clause` | app | development | lockfile |
| `istanbul-lib-report` | `3.0.1` | `BSD-3-Clause` | app | development | lockfile |
| `istanbul-reports` | `3.2.0` | `BSD-3-Clause` | app | development | lockfile |
| `iterator.prototype` | `1.1.5` | `MIT` | app | development | lockfile |
| `jackspeak` | `3.4.3` | `BlueOak-1.0.0` | functions/generate-thumbnail | runtime | lockfile |
| `jiti` | `2.7.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `jose` | `4.15.9` | `MIT` | app | runtime | lockfile |
| `js-tokens` | `10.0.0` | `MIT` | app | development | lockfile |
| `js-tokens` | `4.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `js-yaml` | `4.3.0` | `MIT` | app | development | lockfile |
| `jsesc` | `3.1.0` | `MIT` | app | development | lockfile |
| `json-bigint` | `1.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `json-buffer` | `3.0.1` | `MIT` | app | development | lockfile |
| `json-schema-traverse` | `0.4.1` | `MIT` | app | development | lockfile |
| `json-schema-traverse` | `1.0.0` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `json-stable-stringify-without-jsonify` | `1.0.1` | `MIT` | app | development | lockfile |
| `json5` | `1.0.2` | `MIT` | app | development | lockfile |
| `json5` | `2.2.3` | `MIT` | app | development | lockfile |
| `jsonfile` | `6.2.1` | `MIT` | app | runtime | lockfile |
| `jsonwebtoken` | `9.0.3` | `MIT` | app | runtime | lockfile |
| `jsx-ast-utils` | `3.3.5` | `MIT` | app | development | lockfile |
| `jszip` | `3.10.1` | `(MIT OR GPL-3.0-or-later)` | app | runtime | lockfile |
| `jwa` | `2.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `jwks-rsa` | `3.2.2` | `MIT` | app | runtime | lockfile |
| `jws` | `4.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `keyv` | `4.5.4` | `MIT` | app | development | lockfile |
| `language-subtag-registry` | `0.3.23` | `CC0-1.0` | app | development | lockfile |
| `language-tags` | `1.0.9` | `MIT` | app | development | lockfile |
| `lazystream` | `1.0.1` | `MIT` | app | runtime | lockfile |
| `levn` | `0.4.1` | `MIT` | app | development | lockfile |
| `lie` | `3.3.0` | `MIT` | app | runtime | lockfile |
| `lightningcss` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-android-arm64` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-darwin-arm64` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-darwin-x64` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-freebsd-x64` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-linux-arm-gnueabihf` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-linux-arm64-gnu` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-linux-arm64-musl` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-linux-x64-gnu` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-linux-x64-musl` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-win32-arm64-msvc` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `lightningcss-win32-x64-msvc` | `1.32.0` | `MPL-2.0` | app | development | lockfile |
| `limiter` | `1.1.5` | `MIT` | app | runtime | override: the npm tarball includes node_modules/limiter/LICENSE.txt |
| `locate-path` | `6.0.0` | `MIT` | app | development | lockfile |
| `lodash.camelcase` | `4.3.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `lodash.clonedeep` | `4.5.0` | `MIT` | app | runtime | lockfile |
| `lodash.defaults` | `4.2.0` | `MIT` | app | runtime | lockfile |
| `lodash.difference` | `4.5.0` | `MIT` | app | runtime | lockfile |
| `lodash.escaperegexp` | `4.1.2` | `MIT` | app | runtime | lockfile |
| `lodash.flatten` | `4.4.0` | `MIT` | app | runtime | lockfile |
| `lodash.groupby` | `4.6.0` | `MIT` | app | runtime | lockfile |
| `lodash.includes` | `4.3.0` | `MIT` | app | runtime | lockfile |
| `lodash.isboolean` | `3.0.3` | `MIT` | app | runtime | lockfile |
| `lodash.isequal` | `4.5.0` | `MIT` | app | runtime | lockfile |
| `lodash.isfunction` | `3.0.9` | `MIT` | app | runtime | lockfile |
| `lodash.isinteger` | `4.0.4` | `MIT` | app | runtime | lockfile |
| `lodash.isnil` | `4.0.0` | `MIT` | app | runtime | lockfile |
| `lodash.isnumber` | `3.0.3` | `MIT` | app | runtime | lockfile |
| `lodash.isplainobject` | `4.0.6` | `MIT` | app | runtime | lockfile |
| `lodash.isstring` | `4.0.1` | `MIT` | app | runtime | lockfile |
| `lodash.isundefined` | `3.0.1` | `MIT` | app | runtime | lockfile |
| `lodash.merge` | `4.6.2` | `MIT` | app | development | lockfile |
| `lodash.once` | `4.1.1` | `MIT` | app | runtime | lockfile |
| `lodash.union` | `4.6.0` | `MIT` | app | runtime | lockfile |
| `lodash.uniq` | `4.5.0` | `MIT` | app | runtime | lockfile |
| `long` | `5.3.2` | `Apache-2.0` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `loose-envify` | `1.4.0` | `MIT` | app | development | lockfile |
| `lru-cache` | `10.4.3` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `lru-cache` | `5.1.1` | `ISC` | app | development | lockfile |
| `lru-cache` | `6.0.0` | `ISC` | app | runtime | lockfile |
| `lru-memoizer` | `2.3.0` | `MIT` | app | runtime | lockfile |
| `lru.min` | `1.1.4` | `MIT` | app, app/migrator | runtime | lockfile |
| `lucide-react` | `1.23.0` | `ISC` | app | runtime | lockfile |
| `magic-string` | `0.30.21` | `MIT` | app | development | lockfile |
| `magicast` | `0.5.3` | `MIT` | app | runtime | lockfile |
| `make-dir` | `4.0.0` | `MIT` | app | development | lockfile |
| `math-intrinsics` | `1.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `media-typer` | `1.1.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `merge-descriptors` | `2.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `merge2` | `1.4.1` | `MIT` | app | development | lockfile |
| `micromatch` | `4.0.8` | `MIT` | app | development | lockfile |
| `mime` | `3.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `mime-db` | `1.52.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `mime-db` | `1.54.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `mime-types` | `2.1.35` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `mime-types` | `3.0.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `minimatch` | `10.2.5` | `BlueOak-1.0.0` | app | development | lockfile |
| `minimatch` | `3.1.5` | `ISC` | app | runtime | lockfile |
| `minimatch` | `5.1.9` | `ISC` | app | runtime | lockfile |
| `minimatch` | `9.0.9` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `minimist` | `1.2.8` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `minipass` | `7.1.3` | `BlueOak-1.0.0` | functions/generate-thumbnail | runtime | lockfile |
| `mitt` | `3.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `modern-tar` | `0.7.6` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `ms` | `2.1.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `mysql2` | `3.15.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `named-placeholders` | `1.1.6` | `MIT` | app, app/migrator | runtime | lockfile |
| `nanoid` | `3.3.15` | `MIT` | app | runtime | lockfile |
| `napi-postinstall` | `0.3.4` | `MIT` | app | development | lockfile |
| `natural-compare` | `1.4.0` | `MIT` | app | development | lockfile |
| `negotiator` | `1.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `next` | `16.2.10` | `MIT` | app | runtime | lockfile |
| `next-themes` | `0.4.6` | `MIT` | app | runtime | lockfile |
| `node-domexception` | `1.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `node-exports-info` | `1.6.2` | `MIT` | app | development | lockfile |
| `node-fetch` | `2.7.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `node-fetch` | `3.3.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `node-int64` | `0.4.0` | `MIT` | app | runtime | lockfile |
| `node-releases` | `2.0.50` | `MIT` | app | development | lockfile |
| `node-sql-parser` | `5.4.0` | `Apache-2.0` | app | runtime | lockfile |
| `normalize-package-data` | `6.0.2` | `BSD-2-Clause` | functions/generate-thumbnail | runtime | lockfile |
| `normalize-path` | `3.0.0` | `MIT` | app | runtime | lockfile |
| `object-assign` | `4.1.1` | `MIT` | app | development | lockfile |
| `object-hash` | `3.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `object-inspect` | `1.13.4` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `object-keys` | `1.1.1` | `MIT` | app | development | lockfile |
| `object.assign` | `4.1.7` | `MIT` | app | development | lockfile |
| `object.entries` | `1.1.9` | `MIT` | app | development | lockfile |
| `object.fromentries` | `2.0.8` | `MIT` | app | development | lockfile |
| `object.groupby` | `1.0.3` | `MIT` | app | development | lockfile |
| `object.values` | `1.2.1` | `MIT` | app | development | lockfile |
| `obug` | `2.1.3` | `MIT` | app | development | lockfile |
| `ohash` | `2.0.11` | `MIT` | app, app/migrator | runtime | lockfile |
| `on-finished` | `2.4.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `once` | `1.4.0` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `optionator` | `0.9.4` | `MIT` | app | development | lockfile |
| `own-keys` | `1.0.1` | `MIT` | app | development | lockfile |
| `p-limit` | `3.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `p-locate` | `5.0.0` | `MIT` | app | development | lockfile |
| `package-json-from-dist` | `1.0.1` | `BlueOak-1.0.0` | functions/generate-thumbnail | runtime | lockfile |
| `pako` | `1.0.11` | `(MIT AND Zlib)` | app | runtime | lockfile |
| `parent-module` | `1.0.1` | `MIT` | app | development | lockfile |
| `parse-json` | `8.3.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `parseurl` | `1.3.3` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `path-exists` | `4.0.0` | `MIT` | app | development | lockfile |
| `path-expression-matcher` | `1.6.1` | `MIT` | app | runtime | lockfile |
| `path-expression-matcher` | `1.6.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `path-is-absolute` | `1.0.1` | `MIT` | app | runtime | lockfile |
| `path-key` | `3.1.1` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `path-parse` | `1.0.7` | `MIT` | app | development | lockfile |
| `path-scurry` | `1.11.1` | `BlueOak-1.0.0` | functions/generate-thumbnail | runtime | lockfile |
| `path-to-regexp` | `8.4.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `pathe` | `2.0.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `perfect-debounce` | `2.1.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `pg` | `8.22.0` | `MIT` | app | runtime | lockfile |
| `pg-cloudflare` | `1.4.0` | `MIT` | app | runtime | lockfile |
| `pg-connection-string` | `2.14.0` | `MIT` | app | runtime | lockfile |
| `pg-int8` | `1.0.1` | `ISC` | app | runtime | lockfile |
| `pg-pool` | `3.14.0` | `MIT` | app | runtime | lockfile |
| `pg-protocol` | `1.15.0` | `MIT` | app | runtime | lockfile |
| `pg-types` | `2.2.0` | `MIT` | app | runtime | lockfile |
| `pgpass` | `1.0.5` | `MIT` | app | runtime | lockfile |
| `picocolors` | `1.1.1` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `picomatch` | `2.3.2` | `MIT` | app | development | lockfile |
| `picomatch` | `4.0.5` | `MIT` | app | development | lockfile |
| `pkg-types` | `2.3.1` | `MIT` | app, app/migrator | runtime | lockfile |
| `playwright` | `1.61.1` | `Apache-2.0` | app | runtime | lockfile |
| `playwright-core` | `1.61.1` | `Apache-2.0` | app | runtime | lockfile |
| `possible-typed-array-names` | `1.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `postcss` | `8.5.16` | `MIT` | app | runtime | lockfile |
| `postgres` | `3.4.7` | `Unlicense` | app, app/migrator | runtime | lockfile |
| `postgres-array` | `2.0.0` | `MIT` | app | runtime | lockfile |
| `postgres-array` | `3.0.4` | `MIT` | app | runtime | lockfile |
| `postgres-bytea` | `1.0.1` | `MIT` | app | runtime | lockfile |
| `postgres-date` | `1.0.7` | `MIT` | app | runtime | lockfile |
| `postgres-interval` | `1.2.0` | `MIT` | app | runtime | lockfile |
| `prelude-ls` | `1.2.1` | `MIT` | app | development | lockfile |
| `prisma` | `7.8.0` | `Apache-2.0` | app, app/migrator | runtime | lockfile |
| `process` | `0.11.10` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `process-nextick-args` | `2.0.1` | `MIT` | app | runtime | lockfile |
| `prop-types` | `15.8.1` | `MIT` | app | development | lockfile |
| `proper-lockfile` | `4.1.2` | `MIT` | app, app/migrator | runtime | lockfile |
| `proto3-json-serializer` | `2.0.2` | `Apache-2.0` | app | runtime | lockfile |
| `proto3-json-serializer` | `3.0.4` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `protobufjs` | `7.6.5` | `BSD-3-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `proxy-addr` | `2.0.7` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `pump` | `3.0.4` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `punycode` | `2.3.1` | `MIT` | app | development | lockfile |
| `puppeteer-core` | `25.3.0` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `pure-rand` | `6.1.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `qs` | `6.15.3` | `BSD-3-Clause` | functions/generate-thumbnail | runtime | lockfile |
| `queue-microtask` | `1.2.3` | `MIT` | app | development | lockfile |
| `radix-ui` | `1.6.2` | `MIT` | app | runtime | lockfile |
| `range-parser` | `1.3.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `raw-body` | `3.0.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `rc9` | `3.0.1` | `MIT` | app, app/migrator | runtime | lockfile |
| `re2js` | `0.4.3` | `MIT` | app | runtime | lockfile |
| `react` | `19.2.7` | `MIT` | app, app/migrator | runtime | lockfile |
| `react-dom` | `19.2.7` | `MIT` | app, app/migrator | runtime | lockfile |
| `react-is` | `16.13.1` | `MIT` | app | development | lockfile |
| `react-is` | `19.2.7` | `MIT` | app | runtime | lockfile |
| `react-redux` | `9.3.0` | `MIT` | app | runtime | lockfile |
| `react-remove-scroll` | `2.7.2` | `MIT` | app | runtime | lockfile |
| `react-remove-scroll-bar` | `2.3.8` | `MIT` | app | runtime | lockfile |
| `react-style-singleton` | `2.2.3` | `MIT` | app | runtime | lockfile |
| `read-package-up` | `11.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `read-pkg` | `9.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `readable-stream` | `2.3.8` | `MIT` | app | runtime | lockfile |
| `readable-stream` | `3.6.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `readdir-glob` | `1.1.3` | `Apache-2.0` | app | runtime | lockfile |
| `readdirp` | `5.0.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `recharts` | `3.9.2` | `MIT` | app | runtime | lockfile |
| `redux` | `5.0.1` | `MIT` | app | runtime | lockfile |
| `redux-thunk` | `3.1.0` | `MIT` | app | runtime | lockfile |
| `reflect.getprototypeof` | `1.0.10` | `MIT` | app | development | lockfile |
| `regexp.prototype.flags` | `1.5.4` | `MIT` | app | development | lockfile |
| `remeda` | `2.33.4` | `MIT` | app, app/migrator | runtime | lockfile |
| `require-directory` | `2.1.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `require-from-string` | `2.0.2` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `reselect` | `5.2.0` | `MIT` | app | runtime | lockfile |
| `resolve` | `2.0.0-next.7` | `MIT` | app | development | lockfile |
| `resolve-from` | `4.0.0` | `MIT` | app | development | lockfile |
| `resolve-pkg-maps` | `1.0.0` | `MIT` | app | development | lockfile |
| `retry` | `0.12.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `retry` | `0.13.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `retry-request` | `7.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `retry-request` | `8.0.3` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `reusify` | `1.1.0` | `MIT` | app | development | lockfile |
| `rimraf` | `5.0.10` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `rolldown` | `1.1.4` | `MIT` | app | development | lockfile |
| `router` | `2.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `run-parallel` | `1.2.0` | `MIT` | app | development | lockfile |
| `safe-array-concat` | `1.1.4` | `MIT` | app | development | lockfile |
| `safe-buffer` | `5.1.2` | `MIT` | app | runtime | lockfile |
| `safe-buffer` | `5.2.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `safe-push-apply` | `1.0.0` | `MIT` | app | development | lockfile |
| `safe-regex-test` | `1.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `safer-buffer` | `2.1.2` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `saxes` | `5.0.1` | `ISC` | app | runtime | lockfile |
| `scheduler` | `0.27.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `semver` | `6.3.1` | `ISC` | app | development | lockfile |
| `semver` | `7.8.5` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `send` | `1.2.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `seq-queue` | `0.0.5` | `MIT` | app, app/migrator | runtime | override: the npm tarball includes node_modules/seq-queue/LICENSE |
| `serve-static` | `2.2.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `set-function-length` | `1.2.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `set-function-name` | `2.0.2` | `MIT` | app | development | lockfile |
| `set-proto` | `1.0.0` | `MIT` | app | development | lockfile |
| `setimmediate` | `1.0.5` | `MIT` | app | runtime | lockfile |
| `setprototypeof` | `1.2.0` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `sharp` | `0.34.5` | `Apache-2.0` | app | runtime | lockfile |
| `shebang-command` | `2.0.0` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `shebang-regex` | `3.0.0` | `MIT` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `side-channel` | `1.1.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `side-channel-list` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `side-channel-map` | `1.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `side-channel-weakmap` | `1.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `siginfo` | `2.0.0` | `ISC` | app | development | lockfile |
| `signal-exit` | `3.0.7` | `ISC` | app, app/migrator | runtime | lockfile |
| `signal-exit` | `4.1.0` | `ISC` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `sonner` | `2.0.7` | `MIT` | app | runtime | lockfile |
| `source-map-js` | `1.2.1` | `BSD-3-Clause` | app | runtime | lockfile |
| `spdx-correct` | `3.2.0` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `spdx-exceptions` | `2.5.0` | `CC-BY-3.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `spdx-expression-parse` | `3.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `spdx-expression-parse` | `4.0.0` | `MIT` | app | development | lockfile |
| `spdx-license-ids` | `3.0.23` | `CC0-1.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `spdx-license-list` | `6.11.0` | `CC0-1.0` | app | development | lockfile |
| `split2` | `4.2.0` | `ISC` | app | runtime | lockfile |
| `sqlstring` | `2.3.3` | `MIT` | app, app/migrator | runtime | lockfile |
| `stable-hash` | `0.0.5` | `MIT` | app | development | lockfile |
| `stackback` | `0.0.2` | `MIT` | app | development | lockfile |
| `statuses` | `2.0.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `std-env` | `3.10.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `std-env` | `4.1.0` | `MIT` | app | development | lockfile |
| `stop-iteration-iterator` | `1.1.0` | `MIT` | app | development | lockfile |
| `stream-events` | `1.0.5` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `stream-shift` | `1.0.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `streamx` | `2.28.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `string_decoder` | `1.1.1` | `MIT` | app | runtime | lockfile |
| `string_decoder` | `1.3.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `string-width` | `4.2.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `string-width` | `5.1.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `string-width` | `7.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `string.prototype.includes` | `2.0.1` | `MIT` | app | development | lockfile |
| `string.prototype.matchall` | `4.0.12` | `MIT` | app | development | lockfile |
| `string.prototype.repeat` | `1.0.0` | `MIT` | app | development | lockfile |
| `string.prototype.trim` | `1.2.11` | `MIT` | app | development | lockfile |
| `string.prototype.trimend` | `1.0.10` | `MIT` | app | development | lockfile |
| `string.prototype.trimstart` | `1.0.8` | `MIT` | app | development | lockfile |
| `strip-ansi` | `6.0.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `strip-ansi` | `7.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `strip-bom` | `3.0.0` | `MIT` | app | development | lockfile |
| `strip-json-comments` | `3.1.1` | `MIT` | app | development | lockfile |
| `strnum` | `2.4.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `stubs` | `3.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `styled-jsx` | `5.1.6` | `MIT` | app | runtime | lockfile |
| `supports-color` | `7.2.0` | `MIT` | app | development | lockfile |
| `supports-preserve-symlinks-flag` | `1.0.0` | `MIT` | app | development | lockfile |
| `tailwind-merge` | `3.6.0` | `MIT` | app | runtime | lockfile |
| `tailwindcss` | `4.3.2` | `MIT` | app | development | lockfile |
| `tapable` | `2.3.3` | `MIT` | app | development | lockfile |
| `tar-fs` | `3.1.3` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `tar-stream` | `2.2.0` | `MIT` | app | runtime | lockfile |
| `tar-stream` | `3.2.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `teeny-request` | `10.1.3` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `teeny-request` | `9.0.0` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `teex` | `1.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `text-decoder` | `1.2.7` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `tiny-invariant` | `1.3.3` | `MIT` | app | runtime | lockfile |
| `tinybench` | `2.9.0` | `MIT` | app | development | lockfile |
| `tinyexec` | `1.2.4` | `MIT` | app | development | lockfile |
| `tinyglobby` | `0.2.17` | `MIT` | app | development | lockfile |
| `tinyrainbow` | `3.1.0` | `MIT` | app | development | lockfile |
| `tmp` | `0.2.7` | `MIT` | app | runtime | lockfile |
| `to-regex-range` | `5.0.1` | `MIT` | app | development | lockfile |
| `toidentifier` | `1.0.1` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `tr46` | `0.0.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `ts-api-utils` | `2.5.0` | `MIT` | app | development | lockfile |
| `tsconfig-paths` | `3.15.0` | `MIT` | app | development | lockfile |
| `tslib` | `2.8.1` | `0BSD` | app | runtime | lockfile |
| `tsx` | `4.23.0` | `MIT` | app | development | lockfile |
| `tw-animate-css` | `1.4.0` | `MIT` | app | development | lockfile |
| `type-check` | `0.4.0` | `MIT` | app | development | lockfile |
| `type-fest` | `4.41.0` | `(MIT OR CC0-1.0)` | functions/generate-thumbnail | runtime | lockfile |
| `type-is` | `2.1.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `typed-array-buffer` | `1.0.3` | `MIT` | app | development | lockfile |
| `typed-array-byte-length` | `1.0.3` | `MIT` | app | development | lockfile |
| `typed-array-byte-offset` | `1.0.4` | `MIT` | app | development | lockfile |
| `typed-array-length` | `1.0.8` | `MIT` | app | development | lockfile |
| `typed-query-selector` | `2.12.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `typescript` | `6.0.3` | `Apache-2.0` | app, functions/generate-thumbnail | runtime | lockfile |
| `typescript-eslint` | `8.62.1` | `MIT` | app | development | lockfile |
| `unbox-primitive` | `1.1.0` | `MIT` | app | development | lockfile |
| `undici-types` | `8.3.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `unicorn-magic` | `0.1.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `universalify` | `2.0.1` | `MIT` | app | runtime | lockfile |
| `unpipe` | `1.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `unrs-resolver` | `1.12.2` | `MIT` | app | development | lockfile |
| `unzipper` | `0.12.5` | `MIT` | app | runtime | lockfile |
| `update-browserslist-db` | `1.2.3` | `MIT` | app | development | lockfile |
| `uri-js` | `4.4.1` | `BSD-2-Clause` | app | development | lockfile |
| `use-callback-ref` | `1.3.3` | `MIT` | app | runtime | lockfile |
| `use-sidecar` | `1.1.3` | `MIT` | app | runtime | lockfile |
| `use-sync-external-store` | `1.6.0` | `MIT` | app | runtime | lockfile |
| `util` | `0.12.5` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `util-deprecate` | `1.0.2` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `uuid` | `11.1.1` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `valibot` | `1.2.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `validate-npm-package-license` | `3.0.4` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `vary` | `1.1.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `victory-vendor` | `37.3.6` | `MIT AND ISC` | app | runtime | lockfile |
| `vite` | `8.1.3` | `MIT` | app | development | lockfile |
| `vitest` | `4.1.10` | `MIT` | app | development | lockfile |
| `web-streams-polyfill` | `3.3.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `web-vitals` | `4.2.4` | `Apache-2.0` | app | runtime | lockfile |
| `webdriver-bidi-protocol` | `0.4.2` | `Apache-2.0` | functions/generate-thumbnail | runtime | lockfile |
| `webidl-conversions` | `3.0.1` | `BSD-2-Clause` | app, functions/generate-thumbnail | runtime | lockfile |
| `websocket-driver` | `0.7.5` | `Apache-2.0` | app | runtime | lockfile |
| `websocket-extensions` | `0.1.4` | `Apache-2.0` | app | runtime | lockfile |
| `whatwg-url` | `5.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `which` | `2.0.2` | `ISC` | app, app/migrator, functions/generate-thumbnail | runtime | lockfile |
| `which-boxed-primitive` | `1.1.1` | `MIT` | app | development | lockfile |
| `which-builtin-type` | `1.2.1` | `MIT` | app | development | lockfile |
| `which-collection` | `1.0.2` | `MIT` | app | development | lockfile |
| `which-typed-array` | `1.1.22` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `why-is-node-running` | `2.3.0` | `MIT` | app | development | lockfile |
| `word-wrap` | `1.2.5` | `MIT` | app | development | lockfile |
| `wrap-ansi` | `7.0.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `wrap-ansi` | `8.1.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `wrap-ansi` | `9.0.2` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `wrappy` | `1.0.2` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `ws` | `8.21.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `xml-naming` | `0.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `xmlchars` | `2.2.0` | `MIT` | app | runtime | lockfile |
| `xtend` | `4.0.2` | `MIT` | app | runtime | lockfile |
| `y18n` | `5.0.8` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `yallist` | `3.1.1` | `ISC` | app | development | lockfile |
| `yallist` | `4.0.0` | `ISC` | app | runtime | lockfile |
| `yargs` | `17.7.3` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `yargs` | `18.0.0` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `yargs-parser` | `21.1.1` | `ISC` | app, functions/generate-thumbnail | runtime | lockfile |
| `yargs-parser` | `22.0.0` | `ISC` | functions/generate-thumbnail | runtime | lockfile |
| `yocto-queue` | `0.1.0` | `MIT` | app, functions/generate-thumbnail | runtime | lockfile |
| `zeptomatch` | `2.1.0` | `MIT` | app, app/migrator | runtime | lockfile |
| `zip-stream` | `4.1.1` | `MIT` | app | runtime | lockfile |
| `zod` | `3.25.76` | `MIT` | functions/generate-thumbnail | runtime | lockfile |
| `zod` | `4.4.3` | `MIT` | app | development | lockfile |
| `zod-validation-error` | `4.0.2` | `MIT` | app | development | lockfile |
