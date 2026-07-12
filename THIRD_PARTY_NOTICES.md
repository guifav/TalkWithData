# Third-party notices

Talk With Data is licensed under MIT, but individual third-party components and
assets remain under their own licenses. This file must accompany release
artifacts that contain the items below. The complete locked package inventory is
in [docs/THIRD-PARTY-LICENSES.md](docs/THIRD-PARTY-LICENSES.md).

This notice inventory is an engineering record, not legal advice. Artifact
publishers remain responsible for confirming that the licenses and notices in
the actual artifact are complete.

The production application and migration containers store this file, the locked
inventory, the project license, and generated package license bundles under
`/app/licenses`. The packaged thumbnail function carries the same records under
its `licenses` directory.

The thumbnail function also redistributes compressed Chromium, SwiftShader,
Open Sans, and Amazon Linux runtime payloads through
`@sparticuz/chromium@149.0.0`. Their exact checksums, upstream sources, Chromium
license, generated Chromium third-party credits, and the additional OFL, MPL,
and MIT texts are bundled under that package's `supplements` directory. The
source record is maintained in
`third_party/chromium-149.0.7827.22/BINARY-PAYLOAD-NOTICES.md`.

## Lucide favicon and icons

`app/public/favicon.svg` is derived from Lucide's `layout-dashboard` icon. The
application also bundles icons through `lucide-react`.

Source: <https://github.com/lucide-icons/lucide>

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

Some Lucide icons bundled by the application are derived from the Feather
project and remain under the following MIT license.

The MIT License (MIT)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Inter font

Next.js self-hosts Inter font files in application build output through
`next/font/google`.

Source: <https://github.com/rsms/inter>

Copyright (c) 2016 The Inter Project Authors
(<https://github.com/rsms/inter>)

This Font Software is licensed under the SIL Open Font License, Version 1.1.

SIL OPEN FONT LICENSE Version 1.1, 26 February 2007

PREAMBLE

The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS

"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting, in part or in whole, any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS

Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created using
the Font Software.

TERMINATION

This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

## Data and attribution licenses in locked packages

The following locked runtime data packages require attribution when their
licensed material is redistributed:

- `caniuse-lite@1.0.30001800`, maintained by Ben Briggs and the Browserslist
  contributors, <https://github.com/browserslist/caniuse-lite>, CC BY 4.0,
  <https://creativecommons.org/licenses/by/4.0/>.
- `spdx-exceptions@2.5.0`, authored by The Linux Foundation with contributors,
  <https://github.com/kemitchell/spdx-exceptions.json>, CC BY 3.0,
  <https://creativecommons.org/licenses/by/3.0/>.

No modifications to those datasets are maintained in this repository. Normal
package installation or build transformations may change their packaging.

## Apache upstream notices

Artifacts containing the following packages must preserve these upstream
notices.

### Playwright

Playwright

Copyright (c) Microsoft Corporation

This software contains code derived from the Puppeteer project
(<https://github.com/puppeteer/puppeteer>), available under the Apache 2.0
license.

### Prisma Studio Core

This software includes brand elements owned by Prisma Data, Inc.

Use in production is permitted under the Apache 2.0 license, provided that
Prisma branding is preserved.

You may not remove or obscure logos, UI marks, or references to Prisma unless
you have purchased a commercial license.

See: <https://www.prisma.io/terms>

### bare-path

Copyright 2023 Holepunch Inc

Licensed under the Apache License, Version 2.0. This component also contains
material copyright Joyent, Inc. and other Node contributors under the MIT
License. The installed package contains the complete combined notice.

## LGPL and MPL components

The locked graph contains optional platform-specific libvips packages under
`LGPL-3.0-or-later`, but the application globally disables image optimization
and removes `sharp` plus `@img/sharp-*` from the standalone release artifact.
The container smoke fails if those native package directories are present. They
therefore do not form part of the published application container.

Artifacts that contain `axe-core` or Lightning CSS preserve their package
licenses under the generated npm bundle.

## Node and Alpine container base

The application and migration images inherit the pinned `node:22-alpine` digest
recorded in `scripts/base-image-policy.json`. Each image carries an exact
inventory of the inherited Alpine packages, their applicable SPDX texts, and
the preserved Node.js, Yarn, npm, and Corepack notices under
`/app/licenses/base`. `SOURCE-AVAILABILITY.md` records exact Alpine aports
commits for packages under GPL or LGPL terms. A digest, runtime version, package
version, or declared license change fails the build until the policy is reviewed
and updated.
