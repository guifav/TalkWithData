#!/bin/sh
# Fail when an upstream image tag no longer resolves to the reviewed digest.
set -eu

read_single_digest() {
  label=$1
  shift
  digests=$(sed -n "$@" | sort -u)
  count=$(printf '%s\n' "$digests" | sed '/^$/d' | wc -l | tr -d ' ')

  if [ "$count" -ne 1 ]; then
    echo "Expected exactly one digest for $label, found $count" >&2
    exit 1
  fi

  printf '%s' "$digests"
}

verify_digest() {
  image=$1
  pinned=$2
  tag=${image#postgres:}

  if ! response=$(curl --fail --silent --show-error \
    --retry 4 --retry-delay 2 --retry-all-errors \
    --connect-timeout 10 --max-time 60 \
    "https://hub.docker.com/v2/namespaces/library/repositories/postgres/tags/$tag"); then
    echo "::error title=Container registry unavailable::Could not resolve the official $image tag after retries"
    exit 1
  fi

  if ! current=$(printf '%s' "$response" | python3 -c '
import json
import re
import sys

digest = json.load(sys.stdin).get("digest", "")
if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
    raise SystemExit("Docker Hub response did not contain a valid manifest digest")
print(digest)
'); then
    echo "::error title=Invalid registry response::Could not read the official $image manifest digest"
    exit 1
  fi

  if [ "$current" != "$pinned" ]; then
    echo "::error title=Container image pin is stale::$image resolves to $current but the repository pins $pinned"
    exit 1
  fi

  echo "$image matches reviewed digest $pinned"
}

ci_digest=$(read_single_digest "postgres:16 CI service" \
  's/.*image: postgres:16@\(sha256:[0-9a-f]\{64\}\).*/\1/p' \
  .github/workflows/ci.yml)

local_digest=$(read_single_digest "postgres:16-alpine setup examples" \
  's/.*postgres:16-alpine@\(sha256:[0-9a-f]\{64\}\).*/\1/p' \
  CONTRIBUTING.md docs/DEPLOYMENT.md)

verify_digest "postgres:16" "$ci_digest"
verify_digest "postgres:16-alpine" "$local_digest"
