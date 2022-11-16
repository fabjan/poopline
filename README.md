# Poopline

Poopline is a shitty tool to run CI jobs locally.

It just parses workflow files and runs the commands in a shell.
It's not much, but it can run a subset of your CI pipeline locally and
maybe save you some grepping, copy-pasting and waiting.

## Requirements

[Deno](https://deno.land)

## Usage

```
Poopline 0.1.1 - Run CI jobs locally
Usage: poopline [options]

Options:
  --version       print version and exit
  --help          show this help
  --workflow      workflow file to run
  --job           job in workflow to run
  --preview       just print what would run
  --yes           assume yes for all prompts                       (default: false)
  --verbose       print more information                           (default: false)
  --quiet         print (almost) nothing                           (default: false)
  --debug         print extra debug information                    (default: false)
  --shell         shell to use for commands                        (default: /bin/bash)
  --output-limit  truncate subcommand output after this many bytes (default: 104857600)
```

For example, in this repository:

```shell session
$ deno run --allow-read poopline.ts --preview
No filename provided, trying to find a workflow file (use --workflow)
Found workflow file .github/workflows/ci.yml
*(inception)=============================*
* 5 commands to run:
*========================================*
1. X Checkout (actions/checkout@v3)
2. X Setup Deno first (denoland/setup-deno@v1)
3. _ Lint
   $ deno fmt --check poopline.ts
4. _ Get deps
   $ deno cache poopline.ts
5. _ Run poopline on test data
   $ test/poopline_test.sh

$
```

```shell session
$ deno run --allow-read --allow-run poopline.ts --quiet --yes
No filename provided, trying to find a workflow file (use --workflow)
Found workflow file .github/workflows/ci.yml
running: /bin/bash -c deno fmt --check poopline.ts
Checked 1 file
running: /bin/bash -c deno cache poopline.ts
running: /bin/bash -c test/poopline_test.sh
[poopline_test.sh] doesnt_exist: OK
[poopline_test.sh] echo_works: OK
[poopline_test.sh] redirection_and_diff: OK
[poopline_test.sh] Cleaning up...

$
```

## Changelog

### 0.1.1
* add --preview flag
### 0.1.0
* initial release

## Testing

Run the test shell script:

```shell
$ test/poopline_test.sh
[poopline_test.sh] doesnt_exist: OK
[poopline_test.sh] echo_works: OK
[poopline_test.sh] redirection_and_diff: OK
[poopline_test.sh] Cleaning up...
```
