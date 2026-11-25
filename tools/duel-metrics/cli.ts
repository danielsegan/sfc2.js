/**
 * pnpm duel:metrics
 *
 * Prints the scenario, a markdown table, and the same report as JSON.
 */
import { renderJson, renderMarkdown } from './report.ts';
import { collectMetrics } from './run.ts';

const report = collectMetrics();
process.stdout.write(renderMarkdown(report));
process.stdout.write('\n');
process.stdout.write(renderJson(report));
process.stdout.write('\n');
