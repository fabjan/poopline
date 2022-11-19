# Poopline

Poopline is a shitty tool to run CI jobs locally.

It just parses workflow files and runs the commands in a shell.
It's not much, but it can run a subset of your CI pipeline locally and
maybe save you some grepping, copy-pasting and waiting.

## Requirements

[Deno](https://deno.land)

## Usage

You can download and run this script with Deno:

```
deno run --allow-read --allow-run https://raw.githubusercontent.com/fabjan/poopline/0.1.2/poopline.ts [options]
```

Or download it first and then run it:

```shell session
$ curl https://raw.githubusercontent.com/fabjan/poopline/0.1.2/poopline.ts > ~/bin/poopline
$ chmod +x ~/bin/poopline
```

```
poopline [options]
```

| Option | Parameter | Description | Default |
|--------|-----------|-------------|---------|
| --version |  | print version and exit |  |
| --help |  | show help text and exit |  |
| --workflow | filename | workflow file to run |  |
| --job | job_name | job in workflow to run |  |
| --preview |  | print what commands would be run without running anything |  |
| --yes |  | assume yes for all prompts |  |
| --verbose |  | print more information |  |
| --quiet |  | print (almost) nothing |  |
| --debug |  | print extra debug information |  |
| --shell | path | shell to use for commands | /bin/bash |
| --output-limit | num_bytes | truncate subcommand output | 104857600 |

### Examples

(`--allow-read` is required for Deno to let Poopline read the workflow file.)

```shell session
$ deno run --allow-read https://raw.githubusercontent.com/fabjan/poopline/0.1.2/poopline.ts --yes --preview
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

(`--allow-run` is required for Deno to let Poopline run the commands.)

```shell session
$ deno run --allow-read --allow-run https://raw.githubusercontent.com/fabjan/poopline/0.1.2/poopline.ts --quiet --yes
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

### 0.1.2
* add shebang to script
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
