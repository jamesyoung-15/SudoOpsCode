#!/bin/bash

BASE="/home/challenger/file_count"

mkdir -p "$BASE"

# Create mixed files
for i in $(seq 1 50); do
    echo "data" > "$BASE/file_$i.txt"
done

for i in $(seq 1 30); do
    echo "logentry" > "$BASE/log_$i.log"
done

# Save correct count for validation
echo 30 > /tmp/log_count_expected