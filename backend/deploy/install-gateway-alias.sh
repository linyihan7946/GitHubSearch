#!/bin/sh
set -eu

gateway_root="${GATEWAY_ROOT:-/opt/aigenimage-gateway}"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_file="$script_dir/githubsearch-uppercase.conf"
target_file="$gateway_root/routes/githubsearch-uppercase.conf"

mkdir -p "$gateway_root/routes"
cp "$source_file" "$target_file"

docker exec aigenimage-gateway nginx -t
docker exec aigenimage-gateway nginx -s reload

printf 'GitHubSearch alias installed: /GitHubSearch/ -> /githubsearch/\n'
