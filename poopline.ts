/**
 * Poopline - https://github.com/fabjan/poopline
 *
 * Poopline is a shitty tool to run CI jobs locally.
 *
 * It just parses workflow files and runs the commands in a shell.
 * It's not much, but it can run a subset of your CI pipeline locally and
 * maybe save you some grepping, copy-pasting and waiting.
 */

const VERSION = "0.1.1";
const TAGLINE = `Poopline ${VERSION} - Run CI jobs locally`;

import { parse } from "https://deno.land/std@0.163.0/flags/mod.ts";
import {
  blue,
  green,
  red,
  yellow,
} from "https://deno.land/std@0.163.0/fmt/colors.ts";
import { copyN } from "https://deno.land/std@0.163.0/io/util.ts";
import {
  basename,
  join as joinPath,
} from "https://deno.land/std@0.163.0/path/mod.ts";

import YAML from "https://esm.sh/yaml@2.1.3";

type FlagDesc = { name: string; desc: string; defaultValue?: any };

const flags: Map<string, FlagDesc> = new Map();

function flag(name: string, desc: string, defaultValue?: any) {
  if (flags.has(name)) {
    throw new Error(`flag ${name} already registered`);
  }
  flags.set(name, { name, desc, defaultValue });
  return (parsed: Record<string, any>) => parsed[name] ?? defaultValue;
}

//
// register command line flags
//

const flagVersion = flag("version", "print version and exit");
const flagHelp = flag("help", "show this help");
const flagWorkflow = flag("workflow", "workflow file to run");
const flagJob = flag("job", "job in workflow to run");
const flagPreview = flag("preview", "just print what would run");
const flagYes = flag("yes", "assume yes for all prompts", false);
const flagVerbose = flag("verbose", "print more information", false);
const flagQuiet = flag("quiet", "print (almost) nothing", false);
const flagDebug = flag("debug", "print extra debug information", false);
const flagShell = flag("shell", "shell to use for commands", "/bin/bash");
const flagOutputLimit = flag(
  "output-limit",
  "truncate subcommand output after this many bytes",
  100 * 1024 * 1024,
);

//
// parse command line arguments, check environment
//

function printUsageAndExit(exitCode: number): never {
  console.log(TAGLINE);
  console.log("Usage: poopline [options]");
  console.log("");
  console.log("Options:");
  const longestName = Math.max(
    ...Array.from(flags.values()).map((f) => f.name.length),
  );
  const longestDesc = Math.max(
    ...Array.from(flags.values()).map((f) => f.desc.length),
  );
  for (const [_name, flag] of flags.entries()) {
    const name = flag.name.padEnd(longestName);
    let desc = flag.desc;
    if (flag.defaultValue !== undefined) {
      desc = desc.padEnd(longestDesc);
      desc = desc + ` (default: ${flag.defaultValue})`;
    }
    console.log(`  --${name}  ${desc}`);
  }
  Deno.exit(exitCode);
}

const opts = parse(Deno.args);

for (const name of Object.keys(opts)) {
  if (name === "_") {
    continue;
  }
  if (!flags.has(name)) {
    console.error(`unknown option: --${name}`);
    printUsageAndExit(1);
  }
}

//
// parse options
//

let filename = flagWorkflow(opts);
let jobname = flagJob(opts);
const preview = flagPreview(opts);
const yessir = flagYes(opts);
const outputLimit = flagOutputLimit(opts);
const commandShell = flagShell(opts);
const beVerbose = flagVerbose(opts);
const beQuiet = flagQuiet(opts);
const debugging = flagDebug(opts);

const interactive = Deno.isatty(Deno.stdin.rid) && !yessir;
const consoleColumns = interactive ? Deno?.consoleSize()?.columns : 79;

//
// prepare some helper functions
//

function print(...args: any[]) {
  console.error(...args);
}

const log = {
  error: (...args: string[]) => print(red("ERROR:"), ...args.map(red)),
  notice: (...args: string[]) => print(...args.map(blue)),
  brief: (...args: string[]) => !beQuiet && print(...args),
  verbose: (...args: string[]) => beVerbose && print(...args),
  debug: (...args: string[]) => debugging && print(...args),
};

function halt(s: string): never {
  log.error(s);
  Deno.exit(1);
}

function confirmUnlessYes(message: string) {
  if (yessir) {
    return true;
  }
  if (!interactive) {
    log.notice("use --yes to skip confirmation");
    halt("trying to confirm, but not interactive");
  }
  return confirm(message);
}

function promptUnlessYes(message: string, defaultValue?: string) {
  if (!interactive) {
    log.notice("--yes is not compatible with prompts");
    halt("trying to prompt, but not interactive");
  }
  return prompt(message, defaultValue);
}

// this can be changed while running, hence 'let'
let bannerLabel = "";

function banner(...text: string[]) {
  const label = bannerLabel ? `(${bannerLabel})` : "";
  const lineLength = Math.min(40, consoleColumns);

  const topLine = "=".repeat(Math.max(0, lineLength - label.length));
  const bottomLine = "=".repeat(lineLength);

  // I think it makes it easier to scan the output.
  log.brief(blue(`*${label}${topLine}*`));
  for (const line of text) {
    log.brief(blue(`* ${line}`));
  }
  log.brief(blue(`*${bottomLine}*`));
}

//
// some sanity checks before we start
//

if ([beQuiet, beVerbose, debugging].filter(Boolean).length > 1) {
  halt("You can only use one of --quiet, --verbose, --debug");
}

// this script can't build command lines for other shells
if (!["bash", "zsh"].includes(basename(commandShell))) {
  halt(`unsupported shell: ${commandShell}`);
}

if (flagVersion(opts)) {
  console.log(TAGLINE);
  Deno.exit(0);
}

if (flagHelp(opts)) {
  printUsageAndExit(0);
}

//
// let's go
//

if (filename == null) {
  log.notice(
    "No filename provided, trying to find a workflow file (use --workflow)",
  );

  const workflowDir = ".github/workflows";
  const workflowFiles = [];

  try {
    const files = Deno.readDir(workflowDir);
    for await (const file of files) {
      if (file.isFile && file.name.match(/\.(yml|yaml)$/)) {
        workflowFiles.push(file.name);
        break;
      }
    }
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      halt(`${workflowDir} not found`);
    }
    halt(`Error searching in ${workflowDir}: ${e}`);
  }

  if (workflowFiles.length === 0) {
    halt(`No workflows found in ${workflowDir}`);
  }
  if (workflowFiles.length > 1) {
    halt("Multiple workflows found, please specify one");
  }

  filename = joinPath(workflowDir, workflowFiles[0]);
  log.notice(`Found workflow file ${filename}`);
}

const text = await Deno.readTextFile(filename);

const workflow = YAML.parse(text);
if (!workflow) {
  halt("Found nothing in workflow file");
}
if (!workflow.jobs) {
  halt(`No jobs found in ${filename}`);
}

if (!jobname) {
  const jobnames = Object.keys(workflow.jobs);
  if (jobnames.length === 1) {
    jobname = jobnames[0];
  } else {
    log.notice(
      `Multiple jobs found in ${filename}, please specify one (or use --job)`,
    );
    for (const job of jobnames) {
      log.brief(`  - ${job}`);
    }
    jobname = promptUnlessYes("job to run:", jobnames[0]);
  }
}
if (!jobname) {
  halt("No job name provided");
}

bannerLabel = jobname;

const job = workflow.jobs[jobname];
if (!job) {
  halt(`No job named ${jobname} found in ${filename}`);
}

if (!job.steps) {
  halt(`No steps found in job ${jobname}`);
}

const numSteps = job.steps.length;

// transform index to step number (1-based) of uniform width
function fmtStep(i: number, of: number) {
  const n = String(i + 1).padStart(String(of).length);
  return `${n}`;
}

// transform index to step number (1-based) out of total
function fmtStepOf(i: number, of: number) {
  return `${i + 1}/${of}`;
}

banner(`${numSteps} commands to run:`);

for (const [i, step] of job.steps.entries()) {
  const bullet = `${fmtStep(i, numSteps)}.`;
  const indent = " ".repeat(bullet.length);
  const stepName = step.name || "<unnamed>";
  if (step.run) {
    log.brief(bullet, green("_"), green(stepName));
    log.brief(indent, green("$"), green(step.run));
  } else if (step.uses) {
    log.brief(bullet, red("X"), stepName, `(${yellow(step.uses)})`);
    if (step.with) {
      log.debug(`     ${JSON.stringify(step.with)}`);
    }
    log.debug(JSON.stringify(step));
  }
}

if (preview) {
  Deno.exit(0);
}

if (!yessir) {
  log.notice("you will be asked to confirm each step before it is run");
}

if (!confirmUnlessYes("do you want to continue?")) {
  Deno.exit(1);
}

banner(`Running job '${jobname}'...`);

async function truncPipe(limit: number, r: Deno.Reader, w: Deno.Writer) {
  const copied = await copyN(r, w, limit);
  if (copied === limit) {
    const message = `...OUTPUT TRUNCATED AT ${limit} BYTES\n`;
    w.write(new TextEncoder().encode(yellow(message.repeat(3))));
  }
}

for (const [i, step] of job.steps.entries()) {
  const stepID = "Step " + fmtStepOf(i, numSteps);
  const stepName = step.name || "<unnamed>";
  if (!step.run) {
    log.brief(stepID, stepName, yellow("skipped"), `(can't run ${step.uses})`);
    log.verbose("cannot run locally:", step.uses);
    continue;
  }

  const command = [commandShell].concat(["-c", step.run]);

  banner(`${stepID} -- ${step.name}`);
  log.brief(" ", green("$"), green(step.run));

  if (confirmUnlessYes("run this step?")) {
    log.notice(`running: ${command.join(" ")}`);
    const p = Deno.run({
      cmd: command,
      stdout: "piped",
      stderr: "piped",
    });
    truncPipe(outputLimit, p.stdout!, Deno.stdout);
    truncPipe(outputLimit, p.stderr!, Deno.stderr);

    const { code } = await p.status();
    if (code !== 0) {
      log.error(`command failed with exit code ${code}`);
      halt("command failed");
    } else {
      log.brief(green("command succeeded"));
    }
  }
}

banner("All steps completed successfully");
