#!/bin/bash

EXPECTED=$(cat /tmp/error_expected)

if [ ! -f /tmp/error_count ]; then
    echo "Validation failed: Write the error count to /tmp/error_count."
    exit 1
fi

USER=$(cat /tmp/error_count)

if [ "$USER" = "$EXPECTED" ]; then
    echo "Validation passed."
    exit 0
else
    echo "Validation failed: Expected $EXPECTED but got $USER."
    exit 1
fi