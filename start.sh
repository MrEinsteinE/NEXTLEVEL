#!/usr/bin/env bash
set -e
echo "NEXTLEVEL - local launcher"
[ -d node_modules ] || { echo "Installing frontend deps..."; npm install; }
[ -d backend/node_modules ] || { echo "Installing backend deps..."; (cd backend && npm install); }
echo "Starting backend (5000) + frontend (3000)..."
(cd backend && npm run dev) &
BACK=$!
trap "kill $BACK 2>/dev/null" EXIT
sleep 4
npm run dev
