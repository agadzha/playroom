#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install the LTS version from https://nodejs.org/ and run this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First launch: installing server dependencies (internet required once)..."
  npm install
  if [ $? -ne 0 ]; then echo "Install failed. Check internet and try again."; read -r -p "Press Enter to close..."; exit 1; fi
fi
npm start
