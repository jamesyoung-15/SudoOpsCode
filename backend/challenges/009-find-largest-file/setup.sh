#!/bin/bash

BASE="/home/challenger/size_test"
mkdir -p "$BASE"

# Create small files
dd if=/dev/zero of="$BASE/a.bin" bs=1K count=10 2>/dev/null
dd if=/dev/zero of="$BASE/b.bin" bs=1K count=30 2>/dev/null
dd if=/dev/zero of="$BASE/c.bin" bs=1K count=5 2>/dev/null

# b.bin is the largest
echo "$BASE/b.bin" >/tmp/largest_expected