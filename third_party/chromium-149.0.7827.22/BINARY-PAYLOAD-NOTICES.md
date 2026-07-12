# Chromium binary payload notices

This directory records the license material for the binary payloads shipped by
`@sparticuz/chromium@149.0.0`. That package embeds Chromium
`149.0.7827.22`, SwiftShader, Open Sans fonts, and Amazon Linux 2023 runtime
libraries in Brotli archives.

## Exact payloads

| File | SHA-256 |
| --- | --- |
| `al2023.tar.br` | `7c24a0e1752f53cbc1b8f97a756d157c07cc773c1f4f4201690a040f9fa951e5` |
| `chromium.br` | `37ba84bfa72f40ca761f31d11c24fda42e70f4ee621c28e7f363ca777b97bd7a` |
| `fonts.tar.br` | `b8580ef8abe530cdeccbd420ceaa5906ee8a60fb1e0505f22e07c59c88f65af5` |
| `swiftshader.tar.br` | `49cfdf5cf3d15ed1eb5e636619f325ff38c609e27d43d06a129dc54f88f67e29` |

## Included license material

- `CHROMIUM-LICENSE.txt` is the Chromium license from the upstream
  `149.0.7827.22` source tag.
- `CHROMIUM-THIRD-PARTY-CREDITS.html.gz` is the exact generated
  `chrome://credits` document from the official Chrome for Testing
  `149.0.7827.22` distribution. It includes the notices for Chromium's bundled
  dependencies, including SwiftShader. Its uncompressed SHA-256 is
  `22cd4c075db6902a00277db17384f53447c20adfb943c0edb906c4f2382554a0`.
  Its deterministic gzip SHA-256 is
  `6741b481e0877535f4919878acc815b8155a744aae643c25d5881eb03cdb4820`.
- `OFL-1.1.txt` covers the Open Sans font files in `fonts.tar.br`.
- `MPL-2.0.txt` covers the NSS and NSPR libraries in `al2023.tar.br`, including
  `libnss3`, `libnssutil3`, `libsoftokn3`, `libfreebl3`, `libfreeblpriv3`,
  `libnspr4`, `libplc4`, and `libplds4`.
- `MIT.txt` covers the Expat library in `al2023.tar.br`.

The three SPDX-named standard texts are generated from the locked
`spdx-license-list@6.11.0` development dependency while packaging the function.

## Upstream sources

- Chromium source and license:
  <https://chromium.googlesource.com/chromium/src/+/refs/tags/149.0.7827.22/>
- Chrome for Testing artifact index:
  <https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json>
- Sparticuz Chromium release:
  <https://github.com/Sparticuz/chromium/releases/tag/v149.0.0>
- Open Sans source: <https://github.com/googlefonts/opensans>
- NSS source: <https://hg.mozilla.org/projects/nss/>
- NSPR source: <https://hg.mozilla.org/projects/nspr/>
- Expat source: <https://github.com/libexpat/libexpat>

The Chromium credits file is compressed only to avoid adding roughly 19 MB of
repeated license text to Git history. It remains byte-for-byte recoverable with
`gzip -dc CHROMIUM-THIRD-PARTY-CREDITS.html.gz`.
