#!/bin/sh
set -e

mkdir -p /data

echo "Running database migrations..."
npm run setup

echo "Starting Profit Brain AI..."
exec npm run start
