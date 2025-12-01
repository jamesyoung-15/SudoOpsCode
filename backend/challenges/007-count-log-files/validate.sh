#!/bin/bash

EXPECTED=$(cat /tmp/log_count_expected)

if [ ! -f /tmp/user_count ]; then
    echo "Validation failed: You must write your count to /tmp/user_count."
    exit 1
fi

USER_COUNT=$(cat /tmp/user_count)

if [ "$USER_COUNT" = "$EXPECTED" ]; then
    echo "Validation passed."
    exit 0
else
    echo "Validation failed: Expected $EXPECTED but got $USER_COUNT."
    exit 1
fi