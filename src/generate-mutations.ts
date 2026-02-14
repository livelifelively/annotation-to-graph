/**
 * Generates Dgraph GraphQL mutations from annotation JSON.
 *
 * Strategy:
 * 1. Each unique entity text -> _Name_ node (upsert via @id on name field)
 * 2. Each annotation entity -> typed KG node (upsert via @id on name_id field)
 *    linked to its _Name_ node
 * 3. Each annotation relationship -> edge between typed KG nodes
 *
 * The _Name_ node is the universal entry point. Because name has @id,
 * Dgraph will upsert: if "Government of India" already exists as a _Name_,
 * it won't create a duplicate -- it'll return the existing one.
 *
 * Similarly, entity types use name_id with @id for upsert behavior.
 */

import {
  AnnotationDocument,
  AnnotationEntity,
  CATEGORY_TYPE_MAP,
  EntityCategory,
  GeneratedMutation,
  MutationBatch,
} from './types.js';

/**
 * Generate a stable name_id from an entity's text.
 * This is the unique identifier in the Dgraph type.
 * Format: "prefix::normalized_text"
 */
function generateNameId(entity: AnnotationEntity): string {
  const mapping = CATEGORY_TYPE_MAP[entity.category];
  const normalized = entity.text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '');
  return `${mapping.nameIdPrefix}::${normalized}`;
}

/**
 * Escape a string for use in GraphQL string literals.
 */
function escapeGraphQL(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Generate _Name_ upsert mutations.
 * Because _Name_.name has @id, Dgraph handles dedup automatically.
 */
function generateNameMutations(entities: AnnotationEntity[]): GeneratedMutation[] {
  const uniqueNames = new Map<string, AnnotationEntity>();
  for (const entity of entities) {
    const key = entity.text.trim();
    if (!uniqueNames.has(key)) {
      uniqueNames.set(key, entity);
    }
  }

  return Array.from(uniqueNames.values()).map((entity) => ({
    description: `_Name_ node for "${entity.text}"`,
    mutation: `mutation {
  add_Name_(input: [{
    name: "${escapeGraphQL(entity.text.trim())}"
  }], upsert: true) {
    _Name_ {
      name
    }
  }
}`,
  }));
}

/**
 * Generate typed entity node mutations.
 *
 * Each entity category maps to a Dgraph type. Most types follow the pattern:
 *   - name_id: String! @id  (for upsert)
 *   - names: [_Name_] @hasInverse(...)  (link to _Name_ entry node)
 *   - node_created_on: DateTime
 *
 * Exceptions are handled per-category.
 */
function generateEntityMutations(entities: AnnotationEntity[]): GeneratedMutation[] {
  return entities.map((entity) => {
    const mapping = CATEGORY_TYPE_MAP[entity.category];
    const nameId = generateNameId(entity);
    const dgType = mapping.dgraphType;
    const now = new Date().toISOString();

    // Category-specific mutation generation
    switch (entity.category) {
      case 'value':
        // _Data_Value_ is simpler than _Metric_ (which requires units + dataType).
        // Store the raw annotation value text; structured metric decomposition comes later.
        return {
          description: `_Data_Value_ for "${entity.text}" [${entity.category}]`,
          mutation: `mutation {
  add_Data_Value_(input: [{
    categorical_value: "${escapeGraphQL(entity.text.trim())}"
  }]) {
    _Data_Value_ {
      categorical_value
    }
  }
}`,
        };

      case 'benefit':
        // _Indian_Union_Government_Service_Benefit_ has no name_id, no @id, no upsert.
        // We create it and link to _Name_ via names field.
        return {
          description: `${dgType} for "${entity.text}" [${entity.category}]`,
          mutation: `mutation {
  add${dgType}(input: [{
    names: [{ name: "${escapeGraphQL(entity.text.trim())}" }]
    node_created_on: "${now}"
  }]) {
    ${dgType} {
      id
    }
  }
}`,
        };

      case 'document':
        // _Source_ has name_id and names with inverse "map_data_source_name"
        return {
          description: `${dgType} for "${entity.text}" [${entity.category}]`,
          mutation: `mutation {
  add${dgType}(input: [{
    name_id: "${escapeGraphQL(nameId)}"
    names: [{ name: "${escapeGraphQL(entity.text.trim())}" }]
  }], upsert: true) {
    ${dgType} {
      name_id
    }
  }
}`,
        };

      default:
        // Standard pattern: name_id (with @id for upsert) + names linkage
        return {
          description: `${dgType} for "${entity.text}" [${entity.category}]`,
          mutation: `mutation {
  add${dgType}(input: [{
    name_id: "${escapeGraphQL(nameId)}"
    names: [{ name: "${escapeGraphQL(entity.text.trim())}" }]
    node_created_on: "${now}"
  }], upsert: true) {
    ${dgType} {
      name_id
    }
  }
}`,
        };
    }
  });
}

/**
 * Generate the full mutation batch from an annotation document.
 */
export function generateMutationBatch(annotation: AnnotationDocument): MutationBatch {
  const nameNodes = generateNameMutations(annotation.entities);
  const entityNodes = generateEntityMutations(annotation.entities);

  // Count by category
  const categoryCounts: Record<string, number> = {};
  for (const e of annotation.entities) {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  }

  return {
    documentId: annotation.document.id,
    documentPath: annotation.document.path,
    nameNodes,
    entityNodes,
    relationships: [], // TODO: implement relationship mutations
    summary: {
      totalNameNodes: nameNodes.length,
      totalEntityNodes: entityNodes.length,
      totalRelationships: 0,
      categoryCounts,
    },
  };
}
