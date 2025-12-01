#!/bin/bash

BASE="/home/challenger/search_challenge"

mkdir -p "$BASE"

# Create many nested folders
for i in $(seq 1 20); do
    mkdir -p "$BASE/dir_$i"
    for j in $(seq 1 10); do
        echo "dummy content" > "$BASE/dir_$i/file_$j.txt"
    done
done

# Create the target file in a random-ish place
TARGET="$BASE/dir_17/secret_file.txt"
echo "FLAG: success" > "$TARGET"

echo "$TARGET" > /tmp/target_file_path