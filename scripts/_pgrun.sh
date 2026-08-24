#!/usr/bin/env bash
#
# Helper invoked from the PowerShell provisioning scripts as:
#
#   wsl -d Ubuntu -- bash /mnt/e/.../scripts/_pgrun.sh <tool> <urlfile> <out> <err> [args...]
#
# Every argument is a plain path or a pg_dump/psql flag -- no quotes, no
# semicolons, no $ expansion. That is deliberate: wsl.exe STRIPS QUOTES from the
# command argument, so a connection string containing ';' (legal in a generated
# password) gets split and the tail is executed as a shell command. Passing the
# URL inside the argument list, in any quoting, is not safe.
#
# The URL is therefore read from a file, and stdout/stderr are redirected here
# inside the script where the redirects cannot be mangled.

set -uo pipefail

TOOL="$1"      # pg_dump | psql
URLFILE="$2"   # file whose first line is the connection URL
OUT="$3"       # stdout destination
ERR="$4"       # stderr destination
shift 4

if [ ! -r "$URLFILE" ]; then
  echo "connection-url file not readable: $URLFILE" > "$ERR"
  exit 66
fi

URL="$(head -n 1 "$URLFILE")"
if [ -z "$URL" ]; then
  echo "connection-url file is empty: $URLFILE" > "$ERR"
  exit 66
fi

if ! command -v "$TOOL" >/dev/null 2>&1; then
  echo "$TOOL is not installed in this WSL distro" > "$ERR"
  exit 127
fi

"$TOOL" "$@" "$URL" > "$OUT" 2> "$ERR"
exit $?
