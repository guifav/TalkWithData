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

## Amazon Linux NSS and NSPR source mapping

Every NSS and NSPR file in the checksum-pinned `al2023.tar.br` is byte-identical
to the corresponding file in these immutable x86_64 RPMs indexed by Amazon
Linux 2023 release `2023.11.20260526`:

| Binary RPM | SHA-256 |
| --- | --- |
| `nspr-4.35.0-7.amzn2023.0.1.x86_64.rpm` | `88c71810bd10fbc18eb36d3e09af66688fe3dc4dbb9ea89e0be06288aef1fbd6` |
| `nss-3.90.0-7.amzn2023.0.1.x86_64.rpm` | `022f66f7f3ef96747a462f3344d6ee792ebb33e0a740591dc3895078bf29e07c` |
| `nss-softokn-3.90.0-7.amzn2023.0.1.x86_64.rpm` | `8bfb9efa21d957f1418fc73097f48f984f7a5bacdeb3ac64930250ec977698af` |
| `nss-softokn-freebl-3.90.0-7.amzn2023.0.1.x86_64.rpm` | `85fde1a8bac535e89a61e7532c18a2d1e25f12c279babd328fcf3cc1bf86091c` |
| `nss-util-3.90.0-7.amzn2023.0.1.x86_64.rpm` | `88de82dbc60633ce9df38c54af644c04fe8e6fd2d18238037660c6e08ec6ead8` |

Amazon Linux builds both NSS and NSPR from the combined source RPM below. It
is the corresponding Source Code Form for those binary RPMs and is available
from Amazon's immutable, content-addressed package store:

- Source RPM: `nss-3.90.0-7.amzn2023.0.1.src.rpm`
- SHA-256: `a30b86aa61b0b4afd66c3b3cad93bdd10c5cb04d313c50be857a32536841f2e0`
- Download: <https://cdn.amazonlinux.com/al2023/blobstore/a30b86aa61b0b4afd66c3b3cad93bdd10c5cb04d313c50be857a32536841f2e0/nss-3.90.0-7.amzn2023.0.1.src.rpm>
- Release package index: <https://docs.aws.amazon.com/linux/al2023/release-notes/all-packages-AL2023.11.html>
- Sparticuz packaging script: <https://github.com/Sparticuz/chromium/blob/3dbad602c0229d0bcfbccd3e9474536d5353a2fd/_/ec2/build-x64.sh>

The immutable binary RPMs use the same content-addressed URL pattern, with the
table SHA-256 as both the `blobstore` directory and the integrity value. This
mapping ties the reviewed `al2023.tar.br` hash to exact redistributable binaries
and to their corresponding source package.

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
- Exact Amazon Linux NSS and NSPR source RPM: see the mapping above.
- Expat source: <https://github.com/libexpat/libexpat>

The Chromium credits file is compressed only to avoid adding roughly 19 MB of
repeated license text to Git history. It remains byte-for-byte recoverable with
`gzip -dc CHROMIUM-THIRD-PARTY-CREDITS.html.gz`.
