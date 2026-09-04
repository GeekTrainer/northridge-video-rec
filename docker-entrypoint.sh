#!/bin/sh
# Start the gateway and each department in production mode as one container.
set -eu

pids=""

stop_services() {
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
}

trap stop_services INT TERM EXIT

node apps/video/server.js --prod &
pids="$pids $!"
node apps/music/server.ts --prod &
pids="$pids $!"
node apps/books/server.ts --prod &
pids="$pids $!"
node gateway/server.ts &
pids="$pids $!"

# Exit if any service stops, allowing the platform to restart the container.
while :; do
  for pid in $pids; do
    if ! kill -0 "$pid" 2>/dev/null; then
      if wait "$pid"; then
        exit 0
      else
        exit $?
      fi
    fi
  done
  sleep 1
done
