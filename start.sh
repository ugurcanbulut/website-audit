#!/bin/sh
set -e

echo "Running database migrations..."
node run-migrations.cjs 2>&1 || echo "Migration warning (may already be up to date)"

echo "Starting application..."
exec node server.js
