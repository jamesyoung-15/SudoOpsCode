#!/bin/bash

BASE="/home/challenger/logs"
mkdir -p "$BASE"

cat > "$BASE/app.log" << 'EOF'
[INFO] Application started
[INFO] Processing request
[ERROR] Failed to load module
[INFO] Retrying
[ERROR] Timeout while connecting
[INFO] Done
EOF

# Expected count (2 errors)
echo 2 >/tmp/error_expected