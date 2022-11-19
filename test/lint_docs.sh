#! /bin/bash

set -e
set -u
set -o pipefail

echo -n "Checking that the options from the CLI and README are in sync..."
help_output=$(./poopline.ts --help)
help_options=$(echo "$help_output" | grep '^  --')
help_options=$(echo "$help_options" | tr -d '[]')
readme_output=$(cat README.md)
readme_options=$(echo "$readme_output" | grep '^| --')
# normalize the options
help_options=$(echo "$help_options" | tr -s ' ' | sort)
readme_options=$(echo "$readme_options" | tr -d '|' | tr -s ' ' | sort)
# compare
diff -bu <(echo "$help_options") <(echo "$readme_options")
echo OK

echo -n "Checking that the version from the CLI and README are in sync..."
readme_version=$(echo "$readme_output" | grep -o "poopline/[^/]*" | cut -d/ -f2 | sort | uniq)
cli_version=$(./poopline.ts --version | cut -d' ' -f2)
if [[ "$readme_version" != "$cli_version" ]]; then
    echo "Version mismatch: README.md says $readme_version, but the cli says $cli_version"
    exit 1
fi
echo OK
