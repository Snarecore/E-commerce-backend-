export interface FieldDiffItem {
    from: any;
    to: any;
}

export interface FieldDiffChange {
    type: 'FIELD_DIFF';
    changedFields: Record<string, FieldDiffItem>;
}

export interface SnapshotChange {
    type: 'SNAPSHOT';
    before: Record<string, any> | null;
    after: Record<string, any> | null;
}

export interface MutationChange {
    type?: string;
    summary?: string;
    description?: string;
    changedFields?: Record<string, FieldDiffItem>;
    before?: Record<string, any> | null;
    after?: Record<string, any> | null;
    payload?: Record<string, any> | null;
    params?: Record<string, any> | null;
    query?: Record<string, any> | null;
    response?: Record<string, any> | null;
}

export type AuditChange = FieldDiffChange | SnapshotChange | MutationChange | Record<string, any>;
