#!/usr/bin/env bash
# Usage: bash tools/ci/wait-for.sh <url> <name> <log-file>
# Waits up to 120 seconds for <url> to answer with a success status.
set -u

url="$1"
name="$2"
log="$3"

for attempt in $(seq 1 60); do
  if curl -sf "$url" > /dev/null; then
    echo "$name is ready ($url)"
    exit 0
  fi
  sleep 2
done

echo "$name did not become ready within 120 seconds: $url"
echo "----- $log -----"
cat "$log" || true
exit 1