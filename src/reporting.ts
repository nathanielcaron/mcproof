import fs from 'fs';
import path from 'path';
import {McpPromptDescriptor, McpResourceDescriptor, McpServerInfo, McpToolDescriptor} from './types';

export type McproofPreflightStatus = 'passed' | 'failed' | 'skipped';
export type McproofTestExecutionStatus = 'completed' | 'not-run' | 'unavailable';

export interface McproofReportPreflight {
  status: McproofPreflightStatus;
  endpoint?: string;
  serverInfo?: McpServerInfo;
  errorMessage?: string;
  tools: McpToolDescriptor[];
  resources: McpResourceDescriptor[];
  prompts: McpPromptDescriptor[];
}

export interface McproofReportTestCase {
  title: string;
  fullName: string;
  status: string;
  durationMs?: number;
  failureMessages: string[];
}

export interface McproofReportSuite {
  name: string;
  status: string;
  message?: string;
  durationMs?: number;
  testCases: McproofReportTestCase[];
}

export interface McproofReportTests {
  status: McproofTestExecutionStatus;
  exitCode?: number;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  numTodoTests?: number;
  numTotalTestSuites?: number;
  numPassedTestSuites?: number;
  numFailedTestSuites?: number;
  suites: McproofReportSuite[];
}

export interface McproofHtmlReport {
  generatedAt: string;
  packageVersion: string;
  workingDirectory: string;
  command: string[];
  overallStatus: 'passed' | 'failed';
  preflight: McproofReportPreflight;
  tests: McproofReportTests;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestampForFileName(timestamp: string): string {
  return timestamp.replace(/[-:]/g, '').replace('.', '-').replace('T', '-').replace('Z', '');
}

function formatDateTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function formatDuration(durationMs?: number): string {
  if (durationMs === undefined || Number.isNaN(durationMs)) {
    return 'n/a';
  }

  return `${durationMs} ms`;
}

function renderTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) {
    return '<p>None discovered.</p>';
  }

  const head = headers.map(header => `<th>${escapeHtml(header)}</th>`).join('');
  const body = rows
    .map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderSummaryList(items: Array<[string, string]>): string {
  return `<dl class="summary-list">${items
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join('')}</dl>`;
}

function renderPreflightSection(preflight: McproofReportPreflight): string {
  const summary = renderSummaryList([
    ['Status', preflight.status],
    ['Endpoint', preflight.endpoint ?? 'n/a'],
    ['Server name', preflight.serverInfo?.name ?? 'unknown'],
    ['Server version', preflight.serverInfo?.version ?? 'unknown'],
    ['Error', preflight.errorMessage ?? 'none'],
  ]);

  return [
    '<section>',
    '<h2>Preflight</h2>',
    summary,
    '<h3>Tools</h3>',
    renderTable(
      ['Name', 'Title', 'Description'],
      preflight.tools.map(tool => [tool.name, tool.title ?? '', tool.description ?? '']),
    ),
    '<h3>Resources</h3>',
    renderTable(
      ['Name', 'URI', 'MIME Type', 'Description'],
      preflight.resources.map(resource => [resource.name, resource.uri, resource.mimeType ?? '', resource.description ?? '']),
    ),
    '<h3>Prompts</h3>',
    renderTable(
      ['Name', 'Args', 'Description'],
      preflight.prompts.map(prompt => [prompt.name, String(prompt.argumentCount), prompt.description ?? '']),
    ),
    '</section>',
  ].join('');
}

function renderTestsSection(tests: McproofReportTests): string {
  const summary = renderSummaryList([
    ['Status', tests.status],
    ['Exit code', tests.exitCode !== undefined ? String(tests.exitCode) : 'n/a'],
    ['Success', tests.success === undefined ? 'n/a' : String(tests.success)],
    ['Duration', formatDuration(tests.durationMs)],
    ['Total suites', tests.numTotalTestSuites !== undefined ? String(tests.numTotalTestSuites) : 'n/a'],
    ['Passed suites', tests.numPassedTestSuites !== undefined ? String(tests.numPassedTestSuites) : 'n/a'],
    ['Failed suites', tests.numFailedTestSuites !== undefined ? String(tests.numFailedTestSuites) : 'n/a'],
    ['Total tests', tests.numTotalTests !== undefined ? String(tests.numTotalTests) : 'n/a'],
    ['Passed tests', tests.numPassedTests !== undefined ? String(tests.numPassedTests) : 'n/a'],
    ['Failed tests', tests.numFailedTests !== undefined ? String(tests.numFailedTests) : 'n/a'],
    ['Pending tests', tests.numPendingTests !== undefined ? String(tests.numPendingTests) : 'n/a'],
    ['Todo tests', tests.numTodoTests !== undefined ? String(tests.numTodoTests) : 'n/a'],
    ['Error', tests.errorMessage ?? 'none'],
  ]);

  if (tests.status !== 'completed') {
    return ['<section>', '<h2>Test Results</h2>', summary, '<p>Tests were not executed to completion.</p>', '</section>'].join('');
  }

  const suitesMarkup =
    tests.suites.length === 0
      ? '<p>No test suites were reported.</p>'
      : tests.suites
          .map(suite => {
            const testCases =
              suite.testCases.length === 0
                ? '<p>No individual test cases were reported for this suite.</p>'
                : `<table><thead><tr><th>Test</th><th>Status</th><th>Duration</th><th>Failures</th></tr></thead><tbody>${suite.testCases
                    .map(testCase => {
                      const failures = testCase.failureMessages.length > 0 ? testCase.failureMessages.join('\n\n') : '';
                      return `<tr><td>${escapeHtml(testCase.fullName)}</td><td>${escapeHtml(testCase.status)}</td><td>${escapeHtml(
                        formatDuration(testCase.durationMs),
                      )}</td><td><pre>${escapeHtml(failures || 'none')}</pre></td></tr>`;
                    })
                    .join('')}</tbody></table>`;

            return [
              '<article class="suite">',
              `<h3>${escapeHtml(suite.name)}</h3>`,
              renderSummaryList([
                ['Status', suite.status],
                ['Duration', formatDuration(suite.durationMs)],
                ['Message', suite.message ?? 'none'],
              ]),
              testCases,
              '</article>',
            ].join('');
          })
          .join('');

  return ['<section>', '<h2>Test Results</h2>', summary, suitesMarkup, '</section>'].join('');
}

function renderHtmlDocument(report: McproofHtmlReport): string {
  const summary = renderSummaryList([
    ['Overall status', report.overallStatus],
    ['Generated at', formatDateTime(report.generatedAt)],
    ['Package version', report.packageVersion],
    ['Working directory', report.workingDirectory],
    ['Command', report.command.join(' ')],
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCProof Report</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; margin: 24px; color: #1f2937; background: #f8fafc; }
    h1, h2, h3 { color: #111827; }
    section, article { background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #d1d5db; text-align: left; vertical-align: top; padding: 8px; }
    th { background: #e5e7eb; }
    dl.summary-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0; }
    dl.summary-list div { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
    dt { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #4b5563; }
    dd { margin: 6px 0 0; font-size: 14px; }
    pre { white-space: pre-wrap; margin: 0; font-family: Menlo, Monaco, monospace; }
    .status-passed { color: #166534; }
    .status-failed { color: #991b1b; }
  </style>
</head>
<body>
  <section>
    <h1>MCProof HTML Report</h1>
    ${summary}
  </section>
  ${renderPreflightSection(report.preflight)}
  ${renderTestsSection(report.tests)}
</body>
</html>`;
}

export function writeHtmlReport(report: McproofHtmlReport, reportsDir: string = path.resolve(process.cwd(), 'mcproof-reports')): string {
  fs.mkdirSync(reportsDir, {recursive: true});
  const fileName = `mcproof-report-${formatTimestampForFileName(report.generatedAt)}.html`;
  const outputPath = path.join(reportsDir, fileName);
  fs.writeFileSync(outputPath, renderHtmlDocument(report), 'utf8');
  return outputPath;
}