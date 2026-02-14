/**
 * CLI tool: Load annotation data into Dgraph.
 *
 * Reads annotations.json, generates mutations, and executes them against
 * a running Dgraph instance.
 *
 * Usage:
 *   npm run load -- <path-to-annotations.json>                    # Load to localhost:8080
 *   npm run load -- <path-to-annotations.json> --endpoint=http://host:8080  # Custom endpoint
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { generateMutationBatch } from './generate-mutations.js';
import type { AnnotationDocument, GeneratedMutation } from './types.js';

const DEFAULT_ENDPOINT = 'http://localhost:8080/graphql';

async function executeMutation(
  endpoint: string,
  mutation: GeneratedMutation
): Promise<{ success: boolean; data?: unknown; errors?: unknown[] }> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation.mutation }),
    });

    const json = await res.json();

    if (json.errors && json.errors.length > 0) {
      return { success: false, errors: json.errors };
    }

    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, errors: [{ message: err.message }] };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));
  const endpointArg = args.find((a) => a.startsWith('--endpoint='));
  const endpoint = endpointArg ? endpointArg.split('=')[1] : DEFAULT_ENDPOINT;

  if (!filePath) {
    console.error('Usage: npm run load -- <path-to-annotations.json> [--endpoint=url]');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  console.log(`Reading: ${absPath}`);
  console.log(`Dgraph endpoint: ${endpoint}\n`);

  const raw = await readFile(absPath, 'utf8');
  const annotation: AnnotationDocument = JSON.parse(raw);
  const batch = generateMutationBatch(annotation);

  console.log(`Document: ${batch.documentId}`);
  console.log(`_Name_ nodes to create: ${batch.nameNodes.length}`);
  console.log(`Entity nodes to create: ${batch.entityNodes.length}`);
  console.log(`Relationships to create: ${batch.relationships.length}\n`);

  // Phase 1: Create _Name_ nodes
  console.log('--- Phase 1: Creating _Name_ nodes ---');
  let nameSuccess = 0;
  let nameFail = 0;

  for (const m of batch.nameNodes) {
    const result = await executeMutation(endpoint, m);
    if (result.success) {
      nameSuccess++;
      console.log(`  OK: ${m.description}`);
    } else {
      nameFail++;
      console.error(`  FAIL: ${m.description}`);
      console.error(`    ${JSON.stringify(result.errors)}`);
    }
  }
  console.log(`  Summary: ${nameSuccess} created, ${nameFail} failed\n`);

  // Phase 2: Create entity nodes (linked to _Name_ nodes)
  console.log('--- Phase 2: Creating entity nodes ---');
  let entitySuccess = 0;
  let entityFail = 0;

  for (const m of batch.entityNodes) {
    const result = await executeMutation(endpoint, m);
    if (result.success) {
      entitySuccess++;
      console.log(`  OK: ${m.description}`);
    } else {
      entityFail++;
      console.error(`  FAIL: ${m.description}`);
      console.error(`    ${JSON.stringify(result.errors)}`);
    }
  }
  console.log(`  Summary: ${entitySuccess} created, ${entityFail} failed\n`);

  // Phase 3: Relationships
  if (batch.relationships.length > 0) {
    console.log('--- Phase 3: Creating relationships ---');
    let relSuccess = 0;
    let relFail = 0;

    for (const m of batch.relationships) {
      const result = await executeMutation(endpoint, m);
      if (result.success) {
        relSuccess++;
        console.log(`  OK: ${m.description}`);
      } else {
        relFail++;
        console.error(`  FAIL: ${m.description}`);
        console.error(`    ${JSON.stringify(result.errors)}`);
      }
    }
    console.log(`  Summary: ${relSuccess} created, ${relFail} failed\n`);
  }

  // Final summary
  console.log('=== Load Complete ===');
  console.log(`_Name_ nodes: ${nameSuccess}/${batch.nameNodes.length}`);
  console.log(`Entity nodes: ${entitySuccess}/${batch.entityNodes.length}`);
  console.log(`Relationships: 0/${batch.relationships.length}`);

  if (nameFail > 0 || entityFail > 0) {
    console.log(`\nWARNING: ${nameFail + entityFail} mutations failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
