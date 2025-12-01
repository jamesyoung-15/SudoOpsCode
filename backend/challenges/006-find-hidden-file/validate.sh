#!/bin/bash

TARGET=$(cat /tmp/target_file_path)

if [ ! -f "$TARGET" ]; then
    echo "Validation failed: Target file not found in filesystem."
    exit 1
fi

if grep -q "FOUND" "$TARGET" 2>/dev/null; then
    echo "Validation passed."
    exit 0
else
    echo "Validation failed: You must write the word FOUND into the target file."
    exit 1
fi
