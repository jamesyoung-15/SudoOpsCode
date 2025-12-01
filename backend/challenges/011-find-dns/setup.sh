#!/bin/bash

BASE="/home/challenger/network_info"
mkdir -p "$BASE"

cat > "$BASE/resolv.conf" << 'EOF'
# Static resolver configuration for challenge
nameserver 8.8.8.8
nameserver 1.1.1.1
search example.local
EOF

# Expected: primary DNS = 8.8.8.8
echo "8.8.8.8" >/tmp/dns_expected