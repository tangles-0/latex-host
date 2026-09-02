#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATIONS_ON_STARTUP:-false}" = "true" ]; then
  echo "Synchronizing database schema..."
  ./node_modules/.bin/drizzle-kit push --config ./drizzle.config.ts
fi

exec node server.js
