#!/bin/sh

ARGS="$@"

if [ ! -z "$REGISTRY_USE_HTTP" ]; then
    ARGS="--http ${ARGS}"
fi

if [ ! -z "$REGISTRY_PORT" ]; then
    ARGS="--port ${REGISTRY_PORT} ${ARGS}"
fi

echo "Running: node index.js $ARGS"

eval "node index.js $ARGS"
