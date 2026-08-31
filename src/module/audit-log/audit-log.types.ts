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

export type AuditChange = FieldDiffChange | SnapshotChange;
