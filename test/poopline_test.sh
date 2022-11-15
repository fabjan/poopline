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

FAILED_TEST=""

PARENTDIR=$(pwd)
WORKDIR=$(mktemp -d poopline_test.XXXXXX)

cleanup() {
    local position="$1"
    local code="$2"
    local command="$3"

    if [[ "$code" != "0" ]]; then
        error "Failed command (near $position):"
        error "> ${command}"
        error "Test failed: $FAILED_TEST"
        head ./*
        log "Left workdir in place: $WORKDIR"
    else
        log "Cleaning up..."
        cd "$PARENTDIR"
        rm "$WORKDIR"/*.stderr
        rm "$WORKDIR"/*.stdout
        rm "$WORKDIR"/*.txt
        rmdir "$WORKDIR"
    fi
}

trap 'cleanup "${LINENO}/${BASH_LINENO}" "$?" "$BASH_COMMAND"' ERR EXIT

cd "$WORKDIR"

run_poopline () {
    deno run --allow-read --allow-run ../poopline.ts --yes --quiet "$@"
}

run_test () {
    local test_job="$1"
    local expect_fail="${2-no}"
    local workflow_file="../test/test_workflow.yml"
    local expect_stdout="../test/expect/$test_job.stdout"
    local actual_stdout="$test_job.stdout"
    local expect_stderr="../test/expect/$test_job.stderr"
    local actual_stderr="$test_job.stderr"

    FAILED_TEST="$test_job"
    if [ "$expect_fail" = "fail" ]; then
        set +e
        set +o pipefail
    fi
    run_poopline --workflow "$workflow_file" --job "$test_job" 2>"$actual_stderr" >"$actual_stdout"
    set -e
    set -o pipefail

    diff -u "$expect_stderr" "$actual_stderr"
    diff -u "$expect_stdout" "$actual_stdout"
    FAILED_TEST=""
    log "$test_job: OK"
}

run_test doesnt_exist fail
run_test echo_works
run_test redirection_and_diff
