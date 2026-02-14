# annotation-to-graph

Convert manually annotated document entities into a Dgraph knowledge graph.

Part of a pipeline that turns Indian Parliament (Lok Sabha) Q&A documents into structured, queryable knowledge. This tool reads annotation JSON files produced by a companion annotation workbench and generates Dgraph GraphQL mutations that create typed entity nodes linked through `_Name_` entry nodes.

## Context

This tool sits between two other components:

1. **Upstream** — An annotation workbench UI where parliament documents are manually annotated with entity spans (organizations, programs, services, benefits, regions, etc.) and relationships between them. Annotations are saved as JSON files alongside the source documents.

2. **Downstream** — A Dgraph instance running an ontology schema ([kartvya-knowledge-graph](https://github.com/livelifelively/kartvya-knowledge-graph)) with 120+ types covering Indian government structure, programs, services, regions, and citizens.

## How it works

For each annotated document:

1. **`_Name_` nodes** are created for every unique entity text. `_Name_` is a universal entry node in the ontology — it has `@id` on its `name` field, so Dgraph upserts automatically. The same entity text appearing across multiple documents resolves to one `_Name_` node.

2. **Typed entity nodes** are created based on the annotation category. Each node gets a `name_id` (stable identifier derived from the text) and is linked to its `_Name_` node via `@hasInverse`. Category-to-type mapping:

| Annotation Category | Dgraph Type |
|---------------------|-------------|
| organization | `_Indian_Union_Government_Ministry_` |
| program | `_Indian_Union_Government_Ministry_Program_` |
| service | `_Indian_Union_Government_Service_` |
| benefit | `_Indian_Union_Government_Service_Benefit_` |
| citizen_attribute | `_Citizen_Attribute_Category_` |
| value | `_Data_Value_` |
| official_role | `_Indian_Government_Official_Role_` |
| region | `_Indian_State_Union_Territory_` |
| delivery_node | `_Indian_Union_Government_Service_Delivery_Node_` |
| document | `_Source_` |
| domain_issue | `_Domain_Issue_` |

3. **Relationships** between entities (e.g. "organization administers program") will be mapped to Dgraph edges. (In progress.)

## Usage

### Preview mutations (dry run)

```sh
npm run dev -- path/to/annotations.json
```

Prints all generated mutations to stdout without executing them.

### Load into Dgraph

```sh
npm run load -- path/to/annotations.json
```

Executes mutations against `http://localhost:8080/graphql`. Use `--endpoint=` to target a different instance:

```sh
npm run load -- path/to/annotations.json --endpoint=http://dgraph-host:8080/graphql
```

### Example

```sh
# Preview what would be loaded
npm run dev -- ../../ls-qna-pipeline/implementation/data/loksabha-qna/18/iv/ministries/health-and-family-welfare/s-64/annotations.json

# Load into running Dgraph
npm run load -- ../../ls-qna-pipeline/implementation/data/loksabha-qna/18/iv/ministries/health-and-family-welfare/s-64/annotations.json
```

## Annotation JSON format

The tool expects files with this structure:

```json
{
  "document": {
    "id": "s-64",
    "path": "18/iv/ministries/health-and-family-welfare/s-64",
    "subject": "Ayushman Bharat Cards"
  },
  "entities": [
    {
      "id": "e1",
      "text": "National Health Authority (NHA)",
      "start": 245,
      "end": 275,
      "category": "organization"
    }
  ],
  "relationships": [
    {
      "id": "r1",
      "source_entity_id": "e1",
      "target_entity_id": "e2",
      "type": "administers",
      "label": "NHA administers AB-PMJAY"
    }
  ]
}
```

## Prerequisites

- Node.js 18+
- A running Dgraph instance with the [kartvya-knowledge-graph](https://github.com/livelifelively/kartvya-knowledge-graph) schema deployed

## Setup

```sh
npm install
```

## Related repositories

- [kartvya-knowledge-graph](https://github.com/livelifelively/kartvya-knowledge-graph) — Dgraph ontology schema
- [pipeline.loksabha-qna](https://github.com/livelifelively/pipeline.loksabha-qna) — Document processing pipeline and annotation API
- [ui.pipeline.knowledge-graph](https://github.com/livelifelively/ui.pipeline.knowledge-graph) — Annotation workbench UI

## License

Private.
