#!/bin/bash
echo "Running database schema push..."
npx drizzle-kit push
echo "Starting production server..."
NODE_ENV=production node dist/index.js
