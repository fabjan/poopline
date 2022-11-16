#! /bin/bash

set -e
set -u
set -o pipefail

progname=$(basename "$0")

log() {
    echo "[$progname]" "$@" >&2
}

error() {
    printf "\033[31m%s %s\033[0m\n" "[$progname]" "$@"
}

## the pipeline steps can produce junk, so we'll put it in a temp dir
WORKDIR=$(mktemp -d ./poopline_test.XXXXXX)
pushd "$WORKDIR" >/dev/null

run_test () {
    local test_job="$1"
    local expect_fail="${2:-no}"
    local workflow_file="../test/test_workflow.yml"
    local expect_stdout="../test/expect/$test_job.stdout"
    local expect_stderr="../test/expect/$test_job.stderr"
    local actual_stdout="$test_job.stdout"
    local actual_stderr="$test_job.stderr"

    if [[ "$expect_fail" == "fail" ]]; then
        set +e
        set +o pipefail
        deno run --allow-all ../poopline.ts --yes --workflow "$workflow_file" --job "$test_job" 2>"$actual_stderr" >"$actual_stdout"
        local exit_code=$?
        set -e
        set -o pipefail
        if [[ $exit_code -eq 0 ]]; then
            error "expected test $test_job to fail, but it succeeded"
            exit 1
        fi
    else
        deno run --allow-all ../poopline.ts --yes --quiet --workflow "$workflow_file" --job "$test_job" 2>"$actual_stderr" >"$actual_stdout"
    fi

    diff -u "$expect_stderr" "$actual_stderr"
    diff -u "$expect_stdout" "$actual_stdout"
    log "$test_job: OK"
}

run_test doesnt_exist fail
run_test echo_works
run_test redirection_and_diff

log "Cleaning up..."
popd >/dev/null
rm "$WORKDIR"/*.stderr
rm "$WORKDIR"/*.stdout
rm "$WORKDIR"/*.txt
rmdir "$WORKDIR"
