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

type SummaryListItem = {
  label: string;
  value: string;
  tone?: 'success' | 'failure' | 'neutral';
  valueIsHtml?: boolean;
};

function getStatusTone(status?: string): 'success' | 'failure' | 'neutral' {
  switch (status?.toLowerCase()) {
    case 'passed':
    case 'completed':
    case 'success':
      return 'success';
    case 'failed':
    case 'error':
      return 'failure';
    default:
      return 'neutral';
  }
}

function renderStatusBadge(status: string): string {
  return `<span class="status-badge status-${getStatusTone(status)}">${escapeHtml(status)}</span>`;
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

function renderSummaryList(items: SummaryListItem[]): string {
  return `<dl class="summary-list">${items
    .map(item => {
      const toneClass = item.tone ? ` summary-${item.tone}` : '';
      const value = item.valueIsHtml ? item.value : escapeHtml(item.value);
      return `<div class="summary-card${toneClass}"><dt>${escapeHtml(item.label)}</dt><dd>${value}</dd></div>`;
    })
    .join('')}</dl>`;
}

function renderPreflightSection(preflight: McproofReportPreflight): string {
  const summary = renderSummaryList([
    {
      label: 'Status',
      value: renderStatusBadge(preflight.status === 'passed' ? 'success' : preflight.status),
      tone: getStatusTone(preflight.status),
      valueIsHtml: true,
    },
    {label: 'Endpoint', value: preflight.endpoint ?? 'n/a'},
    {label: 'Server name', value: preflight.serverInfo?.name ?? 'unknown'},
    {label: 'Server version', value: preflight.serverInfo?.version ?? 'unknown'},
    {label: 'Error', value: preflight.errorMessage ?? 'none', tone: preflight.errorMessage ? 'failure' : 'neutral'},
  ]);

  return [
    '<section>',
    '<h2>Server Information</h2>',
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

function renderTestSummarySection(tests: McproofReportTests): string {
  const summary = renderSummaryList([
    {label: 'Status', value: renderStatusBadge(tests.status), tone: getStatusTone(tests.status), valueIsHtml: true},
    {
      label: 'Success',
      value: tests.success === undefined ? 'n/a' : String(tests.success),
      tone: tests.success === true ? 'success' : tests.success === false ? 'failure' : 'neutral',
    },
    {label: 'Duration', value: formatDuration(tests.durationMs)},
    {label: 'Total suites', value: tests.numTotalTestSuites !== undefined ? String(tests.numTotalTestSuites) : 'n/a'},
    {label: 'Total tests', value: tests.numTotalTests !== undefined ? String(tests.numTotalTests) : 'n/a'},
    {
      label: 'Passed suites',
      value: tests.numPassedTestSuites !== undefined ? String(tests.numPassedTestSuites) : 'n/a',
      tone: (tests.numPassedTestSuites ?? 0) > 0 ? 'success' : 'neutral',
    },
    {
      label: 'Passed tests',
      value: tests.numPassedTests !== undefined ? String(tests.numPassedTests) : 'n/a',
      tone: (tests.numPassedTests ?? 0) > 0 ? 'success' : 'neutral',
    },
    {
      label: 'Failed suites',
      value: tests.numFailedTestSuites !== undefined ? String(tests.numFailedTestSuites) : 'n/a',
      tone: (tests.numFailedTestSuites ?? 0) > 0 ? 'failure' : 'neutral',
    },
    {
      label: 'Failed tests',
      value: tests.numFailedTests !== undefined ? String(tests.numFailedTests) : 'n/a',
      tone: (tests.numFailedTests ?? 0) > 0 ? 'failure' : 'neutral',
    },
    {label: 'Pending tests', value: tests.numPendingTests !== undefined ? String(tests.numPendingTests) : 'n/a'},
    {label: 'Todo tests', value: tests.numTodoTests !== undefined ? String(tests.numTodoTests) : 'n/a'},
    {label: 'Error', value: tests.errorMessage ?? 'none', tone: tests.errorMessage ? 'failure' : 'neutral'},
  ]);

  return ['<section>', '<h2>Test Summary</h2>', summary, '</section>'].join('');
}

function renderDetailedTestsSection(tests: McproofReportTests): string {
  if (tests.status !== 'completed') {
    return ['<section>', '<h2>Detailed Test Results</h2>', '<p>Tests were not executed to completion.</p>', '</section>'].join('');
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
                      return `<tr class="status-row-${getStatusTone(testCase.status)}"><td>${escapeHtml(testCase.fullName)}</td><td>${renderStatusBadge(
                        testCase.status,
                      )}</td><td>${escapeHtml(
                        formatDuration(testCase.durationMs),
                      )}</td><td><pre>${escapeHtml(failures || 'none')}</pre></td></tr>`;
                    })
                    .join('')}</tbody></table>`;

            return [
              `<article class="suite suite-${getStatusTone(suite.status)}">`,
              `<h3>${escapeHtml(suite.name)}</h3>`,
              renderSummaryList([
                {label: 'Status', value: renderStatusBadge(suite.status), tone: getStatusTone(suite.status), valueIsHtml: true},
                {label: 'Duration', value: formatDuration(suite.durationMs)},
                {label: 'Message', value: suite.message ?? 'none', tone: suite.message ? 'failure' : 'neutral'},
              ]),
              testCases,
              '</article>',
            ].join('');
          })
          .join('');

  return ['<section>', '<h2>Detailed Test Results</h2>', suitesMarkup, '</section>'].join('');
}

function renderHtmlDocument(report: McproofHtmlReport): string {
  const summary = renderSummaryList([
    {
      label: 'Overall status',
      value: renderStatusBadge(report.overallStatus === 'passed' ? 'success' : report.overallStatus),
      tone: getStatusTone(report.overallStatus),
      valueIsHtml: true,
    },
    {label: 'Generated at', value: formatDateTime(report.generatedAt)},
    {label: 'Package version', value: report.packageVersion},
    {label: 'Working directory', value: report.workingDirectory},
    {label: 'Command', value: report.command.join(' ')},
  ]);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCProof Report</title>
  <style>
    :root {
      --surface: #ffffff;
      --surface-subtle: #f8fafc;
      --border: #d7dee7;
      --text: #1f2937;
      --muted: #4b5563;
      --success-bg: #dcfce7;
      --success-border: #86efac;
      --success-text: #166534;
      --failure-bg: #fee2e2;
      --failure-border: #fca5a5;
      --failure-text: #991b1b;
      --neutral-bg: #eef2f7;
      --neutral-border: #cbd5e1;
    }
    body { font-family: Helvetica, Arial, sans-serif; margin: 24px; color: var(--text); background: linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%); }
    h1, h2, h3 { color: #111827; }
    section, article { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid var(--border); text-align: left; vertical-align: top; padding: 8px; }
    th { background: #e8eef7; }
    dl.summary-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0; }
    .summary-card { background: var(--surface-subtle); border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; }
    .summary-success { background: var(--success-bg); border-color: var(--success-border); }
    .summary-failure { background: var(--failure-bg); border-color: var(--failure-border); }
    .summary-neutral { background: var(--neutral-bg); border-color: var(--neutral-border); }
    dt { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--muted); }
    dd { margin: 6px 0 0; font-size: 14px; }
    pre { white-space: pre-wrap; margin: 0; font-family: Menlo, Monaco, monospace; }
    .status-badge { display: inline-block; padding: 4px 10px; border: 1px solid transparent; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
    .status-success { color: var(--success-text); background: var(--success-bg); border-color: var(--success-border); }
    .status-failure { color: var(--failure-text); background: var(--failure-bg); border-color: var(--failure-border); }
    .status-neutral { color: #334155; background: var(--neutral-bg); border-color: var(--neutral-border); }
    .suite-success { border-color: var(--success-border); }
    .suite-failure { border-color: var(--failure-border); }
    .status-row-success td { background: #f0fdf4; }
    .status-row-failure td { background: #fef2f2; }
  </style>
</head>
<body>
  <section>
    <h1>MCProof Report 🛡️</h1>
    ${summary}
  </section>
  ${renderPreflightSection(report.preflight)}
  ${renderTestSummarySection(report.tests)}
  ${renderDetailedTestsSection(report.tests)}
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