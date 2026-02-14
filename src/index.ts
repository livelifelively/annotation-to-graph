/**
 * CLI tool: Generate Dgraph mutations from annotation JSON.
 *
 * Usage:
 *   npm run dev -- <path-to-annotations.json>       # Print mutations
 *   npm run dev -- <path-to-annotations.json> --dry  # Same as above (explicit)
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { generateMutationBatch } from './generate-mutations.js';
import type { AnnotationDocument } from './types.js';

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));

  if (!filePath) {
    console.error('Usage: npm run dev -- <path-to-annotations.json> [--dry]');
    console.error('');
    console.error('Generates Dgraph GraphQL mutations from an annotation JSON file.');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  console.log(`Reading: ${absPath}\n`);

  const raw = await readFile(absPath, 'utf8');
  const annotation: AnnotationDocument = JSON.parse(raw);

  console.log(`Document: ${annotation.document.id} (${annotation.document.subject})`);
  console.log(`Path: ${annotation.document.path}`);
  console.log(`Entities: ${annotation.entities.length}`);
  console.log(`Relationships: ${annotation.relationships?.length || 0}`);
  console.log('');

  const batch = generateMutationBatch(annotation);

  // Print summary
  console.log('=== Mutation Summary ===');
  console.log(`_Name_ nodes:   ${batch.summary.totalNameNodes}`);
  console.log(`Entity nodes:   ${batch.summary.totalEntityNodes}`);
  console.log(`Relationships:  ${batch.summary.totalRelationships}`);
  console.log('');
  console.log('Category counts:');
  for (const [cat, count] of Object.entries(batch.summary.categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('');

  // Print _Name_ mutations
  console.log('=== _Name_ Mutations ===\n');
  for (const m of batch.nameNodes) {
    console.log(`# ${m.description}`);
    console.log(m.mutation);
    console.log('');
  }

  // Print entity mutations
  console.log('=== Entity Mutations ===\n');
  for (const m of batch.entityNodes) {
    console.log(`# ${m.description}`);
    console.log(m.mutation);
    console.log('');
  }

  // Print relationship mutations
  if (batch.relationships.length > 0) {
    console.log('=== Relationship Mutations ===\n');
    for (const m of batch.relationships) {
      console.log(`# ${m.description}`);
      console.log(m.mutation);
      console.log('');
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
