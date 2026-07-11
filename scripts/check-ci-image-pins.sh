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
  current=$(docker buildx imagetools inspect "docker.io/library/$image" --format '{{json .Manifest.Digest}}' | tr -d '"')

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
