#!/bin/bash

# Validation script for Challenge 001: Create a file named 'complete.txt' in /tmp
if [ -f /tmp/complete.txt ]; then
    echo "Validation passed: File /tmp/complete.txt exists."
    exit 0
else
    echo "Validation failed: File /tmp/complete.txt not found."
    exit 1
fi