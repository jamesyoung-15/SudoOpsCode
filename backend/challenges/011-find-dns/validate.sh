#!/bin/bash

EXPECTED=$(cat /tmp/dns_expected)

if [ ! -f /tmp/dns_found ]; then
    echo "Validation failed: Write the primary DNS to /tmp/dns_found."
    exit 1
fi

FOUND=$(cat /tmp/dns_found)

if [ "$FOUND" = "$EXPECTED" ]; then
    echo "Validation passed."
    exit 0
else
    echo "Validation failed: Expected $EXPECTED but got $FOUND."
    exit 1
fi