// ─── Annotation JSON types ────────────────────────────────────────────────

export interface AnnotationDocument {
  document: {
    id: string;
    path: string;
    subject: string;
  };
  entities: AnnotationEntity[];
  relationships?: AnnotationRelationship[];
  saved_at?: string;
}

export interface AnnotationEntity {
  id: string;      // e.g. "e1"
  text: string;     // the extracted text span
  start: number;    // character offset start
  end: number;      // character offset end
  category: EntityCategory;
}

export interface AnnotationRelationship {
  id: string;               // e.g. "r1"
  source_entity_id: string; // references AnnotationEntity.id
  target_entity_id: string; // references AnnotationEntity.id
  type: string;             // relationship type (e.g. "administers", "provides")
  label: string;            // human-readable description
}

export type EntityCategory =
  | 'organization'
  | 'program'
  | 'service'
  | 'benefit'
  | 'citizen_attribute'
  | 'value'
  | 'official_role'
  | 'region'
  | 'delivery_node'
  | 'document'
  | 'domain_issue';

// ─── Category to Dgraph type mapping ─────────────────────────────────────

export interface DgraphTypeMapping {
  dgraphType: string;       // e.g. "_Indian_Union_Government_Ministry_"
  nameIdPrefix: string;     // prefix for generating name_id values
  nameField: string;        // the _Name_ inverse field name on this type
}

/**
 * Maps annotation categories to their primary Dgraph types.
 *
 * Some categories can map to multiple types (e.g. organization -> Ministry OR Department).
 * For the initial pipeline, we use the most general type per category.
 * Refinement (e.g. distinguishing Ministry from Department) will come from
 * relationship context or manual sub-categorization.
 */
export const CATEGORY_TYPE_MAP: Record<EntityCategory, DgraphTypeMapping> = {
  organization: {
    dgraphType: '_Indian_Union_Government_Ministry_',
    nameIdPrefix: 'org',
    nameField: 'indian_union_government_ministry',
  },
  program: {
    dgraphType: '_Indian_Union_Government_Ministry_Program_',
    nameIdPrefix: 'prog',
    nameField: 'indian_union_government_ministry_program',
  },
  service: {
    dgraphType: '_Indian_Union_Government_Service_',
    nameIdPrefix: 'svc',
    nameField: 'indian_union_government_service',
  },
  benefit: {
    dgraphType: '_Indian_Union_Government_Service_Benefit_',
    nameIdPrefix: 'ben',
    nameField: 'indian_union_government_service_benefit',
  },
  citizen_attribute: {
    dgraphType: '_Citizen_Attribute_Category_',
    nameIdPrefix: 'cattr',
    nameField: 'citizen_attribute_category',
  },
  value: {
    dgraphType: '_Metric_',
    nameIdPrefix: 'metric',
    nameField: 'metric',
  },
  official_role: {
    dgraphType: '_Indian_Government_Official_Role_',
    nameIdPrefix: 'role',
    nameField: 'indian_government_official_role',
  },
  region: {
    dgraphType: '_Indian_State_Union_Territory_',
    nameIdPrefix: 'region',
    nameField: 'indian_state_union_territory',
  },
  delivery_node: {
    dgraphType: '_Indian_Union_Government_Service_Delivery_Node_',
    nameIdPrefix: 'dnode',
    nameField: 'indian_union_government_service_delivery_node',
  },
  document: {
    dgraphType: '_Source_',
    nameIdPrefix: 'doc',
    nameField: 'map_data_source_name',
  },
  domain_issue: {
    dgraphType: '_Domain_Issue_',
    nameIdPrefix: 'issue',
    nameField: 'domain_issue',
  },
};

// ─── Mutation output types ────────────────────────────────────────────────

export interface GeneratedMutation {
  description: string;
  mutation: string;
  variables?: Record<string, unknown>;
}

export interface MutationBatch {
  documentId: string;
  documentPath: string;
  nameNodes: GeneratedMutation[];
  entityNodes: GeneratedMutation[];
  relationships: GeneratedMutation[];
  summary: {
    totalNameNodes: number;
    totalEntityNodes: number;
    totalRelationships: number;
    categoryCounts: Record<string, number>;
  };
}
