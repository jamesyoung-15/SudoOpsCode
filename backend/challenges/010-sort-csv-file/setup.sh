#!/bin/bash

BASE="/home/challenger/csv_test"
mkdir -p "$BASE"

cat > "$BASE/data.csv" << 'EOF'
alice,3
bob,1
charlie,2
EOF

# Expected sorted output by 2nd column:
printf "bob,1\ncharlie,2\nalice,3\n" > /tmp/csv_expected