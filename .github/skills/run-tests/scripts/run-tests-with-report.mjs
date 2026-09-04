#!/usr/bin/env node
// Runs the project test workflow and writes a failure-focused Markdown report.

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const reportBase = process.env.AGENT_TEST_REPORT_DIR
  ? path.resolve(process.env.AGENT_TEST_REPORT_DIR)
  : path.join(repoRoot, '.copilot-test-reports');
const timestamp = new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
const reportDir = path.join(reportBase, timestamp);

const suites = [
  {
    name: 'Database seed',
    command: npmCommand(),
    args: ['run', 'db:reset'],
    logFile: 'db-reset.log',
  },
  {
    name: 'Unit tests',
    command: 'bash',
    args: ['.github/skills/run-tests/scripts/run-unit-tests.sh'],
    logFile: 'unit-tests.log',
  },
  {
    name: 'End-to-end tests',
    command: 'bash',
    args: ['.github/skills/run-tests/scripts/run-e2e-tests.sh'],
    logFile: 'e2e-tests.log',
  },
];

await mkdir(reportDir, { recursive: true });

const results = [];
for (const suite of suites) {
  const result = await runSuite(suite);
  results.push(result);

  if (suite.name === 'Database seed' && result.exitCode !== 0) {
    break;
  }
}

const reportPath = path.join(reportDir, 'report.md');
const summaryPath = path.join(reportDir, 'summary.json');

await writeFile(reportPath, buildMarkdownReport(results), 'utf8');
await writeFile(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2), 'utf8');

const failed = results.filter((result) => result.exitCode !== 0);
console.log(`\nTest report: ${path.relative(repoRoot, reportPath)}`);
console.log(`Summary JSON: ${path.relative(repoRoot, summaryPath)}`);

if (failed.length > 0) {
  console.error(`Failed steps: ${failed.map((result) => result.name).join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('All test steps passed.');
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runSuite(suite) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const logPath = path.join(reportDir, suite.logFile);
    const logStream = createWriteStream(logPath, { flags: 'w' });
    const commandLine = [suite.command, ...suite.args].join(' ');
    let output = '';

    console.log(`\n==> ${suite.name}`);
    console.log(`$ ${commandLine}`);
    logStream.write(`$ ${commandLine}\n\n`);

    const child = spawn(suite.command, suite.args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString();
      logStream.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output += chunk.toString();
      logStream.write(chunk);
    });

    child.on('error', (error) => {
      const message = `\nFailed to start command: ${error.message}\n`;
      process.stderr.write(message);
      output += message;
      logStream.write(message);
      logStream.end();
      resolve({
        ...suite,
        commandLine,
        logPath,
        durationMs: Date.now() - startedAt,
        exitCode: 1,
        outputTail: tail(output),
      });
    });

    child.on('close', (exitCode, signal) => {
      logStream.end();
      resolve({
        ...suite,
        commandLine,
        logPath,
        durationMs: Date.now() - startedAt,
        exitCode: signal ? 1 : (exitCode ?? 1),
        signal,
        outputTail: tail(output),
      });
    });
  });
}

function buildMarkdownReport(results) {
  const generatedAt = new Date().toISOString();
  const failed = results.filter((result) => result.exitCode !== 0);
  const lines = [
    '# Test Report',
    '',
    `Generated: ${generatedAt}`,
    '',
    failed.length === 0 ? '**Status:** Passed' : `**Status:** Failed (${failed.length} step${failed.length === 1 ? '' : 's'})`,
    '',
    '| Step | Command | Status | Duration | Log |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const result of results) {
    const status = result.exitCode === 0 ? 'Passed' : `Failed (${result.exitCode})`;
    const relativeLog = path.relative(repoRoot, result.logPath);
    lines.push(
      `| ${escapeTable(result.name)} | \`${escapeBackticks(result.commandLine)}\` | ${status} | ${formatDuration(result.durationMs)} | \`${relativeLog}\` |`,
    );
  }

  if (failed.length > 0) {
    lines.push('', '## Failure highlights');
    for (const result of failed) {
      lines.push('', `### ${result.name}`, '', `Command: \`${escapeBackticks(result.commandLine)}\``, '', '```text');
      lines.push(result.outputTail || 'No output captured.');
      lines.push('```');
    }

    if (results.some((result) => result.name === 'End-to-end tests' && result.exitCode !== 0)) {
      lines.push('', 'Playwright HTML report: `playwright-report/`');
    }
  }

  return `${lines.join('\n')}\n`;
}

function tail(output, maxLines = 80) {
  return output.trim().split(/\r?\n/).slice(-maxLines).join('\n');
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function escapeTable(value) {
  return String(value).replaceAll('|', '\\|');
}

function escapeBackticks(value) {
  return String(value).replaceAll('`', '\\`');
}
