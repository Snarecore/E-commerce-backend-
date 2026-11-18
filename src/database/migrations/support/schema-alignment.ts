import { Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';

/**
 * Brings legacy tables in line with the entities without losing data.
 *
 * MySQL/TiDB DDL cannot be rolled back, so every op is checked against the live data first
 * and the run aborts before the first DDL if anything would fail or truncate. Every op is
 * also guarded, so a run interrupted halfway can simply be started again.
 */

export type SchemaAlignmentOp =
	| { op: 'modify'; table: string; column: string; definition: string }
	| { op: 'addPrimaryKey'; table: string; columns: string[] }
	| { op: 'dropIndex'; table: string; name: string }
	| { op: 'createIndex'; table: string; name: string; unique: boolean; columns: string[] }
	| { op: 'dropForeignKey'; table: string; name: string }
	| {
			op: 'addForeignKey';
			table: string;
			name: string;
			columns: string[];
			refTable: string;
			refColumns: string[];
			onDelete: string;
			onUpdate: string;
	  };

const logger = new Logger('SchemaAlignment');
const q = (name: string) => `\`${name.replace(/`/g, '``')}\``;
const colList = (cols: string[]) => cols.map(q).join(', ');
const TEXT_TYPES = new Set(['char', 'varchar', 'tinytext', 'text', 'mediumtext', 'longtext']);

interface ParsedDefinition {
	baseType: string;
	length?: number;
	enumValues?: string[];
	precision?: number;
	scale?: number;
	notNull: boolean;
	defaultLiteral?: string;
}

export function parseDefinition(definition: string): ParsedDefinition {
	const typeMatch = /^(\w+)(?:\s*\(([^)]*)\))?/.exec(definition);
	if (!typeMatch) throw new Error(`Unparseable column definition: ${definition}`);
	const baseType = typeMatch[1].toLowerCase();
	const args = typeMatch[2];
	const parsed: ParsedDefinition = { baseType, notNull: /\bNOT NULL\b/.test(definition) };

	if (baseType === 'enum' && args) {
		parsed.enumValues = Array.from(args.matchAll(/'((?:[^']|'')*)'/g), (m) => m[1].replace(/''/g, "'"));
	} else if ((baseType === 'varchar' || baseType === 'char') && args) {
		parsed.length = Number(args);
	} else if (baseType === 'decimal' && args) {
		const [p, s] = args.split(',').map((n) => Number(n.trim()));
		parsed.precision = p;
		parsed.scale = s ?? 0;
	}

	const defaultMatch = /\bDEFAULT\s+('(?:[^']|'')*'|-?\d+(?:\.\d+)?|CURRENT_TIMESTAMP(?:\(\d\))?)/.exec(definition);
	if (defaultMatch) parsed.defaultLiteral = defaultMatch[1];
	return parsed;
}

const TIMESTAMP_SIBLINGS: Record<string, string> = {
	createdAt: 'updatedAt',
	updatedAt: 'createdAt',
	created_at: 'updated_at',
	updated_at: 'created_at',
};

/**
 * Value used for existing NULLs when a column becomes NOT NULL. Audit timestamps borrow
 * their sibling (a row missing createdAt usually still has updatedAt) before falling back
 * to the column default.
 */
async function backfillExpression(
	runner: QueryRunner,
	table: string,
	column: string,
	def: ParsedDefinition
): Promise<string | undefined> {
	if (def.defaultLiteral === undefined) return undefined;
	const sibling = TIMESTAMP_SIBLINGS[column];
	if (sibling && /^CURRENT_TIMESTAMP/.test(def.defaultLiteral) && (await columnInfo(runner, table, sibling))) {
		return `COALESCE(${q(sibling)}, ${def.defaultLiteral})`;
	}
	return def.defaultLiteral;
}

async function scalar(runner: QueryRunner, sql: string, params: unknown[] = []): Promise<number> {
	const rows: Array<Record<string, unknown>> = await runner.query(sql, params);
	const value = rows[0] ? Object.values(rows[0])[0] : 0;
	return Number(value ?? 0);
}

async function columnInfo(runner: QueryRunner, table: string, column: string) {
	const rows: Array<{ DATA_TYPE: string }> = await runner.query(
		`SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
		[table, column]
	);
	return rows[0];
}

async function indexExists(runner: QueryRunner, table: string, name: string) {
	return (
		(await scalar(
			runner,
			`SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
			[table, name]
		)) > 0
	);
}

async function hasPrimaryKey(runner: QueryRunner, table: string) {
	return (
		(await scalar(
			runner,
			`SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'PRIMARY KEY'`,
			[table]
		)) > 0
	);
}

async function foreignKeyExists(runner: QueryRunner, table: string, name: string) {
	return (
		(await scalar(
			runner,
			`SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
			[table, name]
		)) > 0
	);
}

/** Returns human-readable problems that would make an op fail or silently change data. */
async function precheck(runner: QueryRunner, op: SchemaAlignmentOp): Promise<string[]> {
	const problems: string[] = [];
	const t = q(op.table);

	if (op.op === 'modify') {
		const info = await columnInfo(runner, op.table, op.column);
		if (!info) return [`${op.table}.${op.column}: column does not exist`];
		const c = q(op.column);
		const def = parseDefinition(op.definition);
		const fromText = TEXT_TYPES.has(info.DATA_TYPE.toLowerCase());

		if (def.notNull && def.defaultLiteral === undefined) {
			const nulls = await scalar(runner, `SELECT COUNT(*) FROM ${t} WHERE ${c} IS NULL`);
			if (nulls) problems.push(`${op.table}.${op.column}: ${nulls} NULL row(s) but target is NOT NULL with no default`);
		}
		if (def.length !== undefined) {
			const longest = await scalar(runner, `SELECT COALESCE(MAX(CHAR_LENGTH(${c})), 0) FROM ${t}`);
			if (longest > def.length)
				problems.push(`${op.table}.${op.column}: longest value is ${longest} chars, target allows ${def.length}`);
		}
		if (def.enumValues) {
			const placeholders = def.enumValues.map(() => '?').join(', ');
			const bad: Array<{ v: string; n: number }> = await runner.query(
				`SELECT ${c} AS v, COUNT(*) AS n FROM ${t} WHERE ${c} IS NOT NULL AND ${c} NOT IN (${placeholders}) GROUP BY ${c}`,
				def.enumValues
			);
			if (bad.length)
				problems.push(
					`${op.table}.${op.column}: values outside enum: ${bad.map((b) => `'${b.v}' x${b.n}`).join(', ')}`
				);
		}
		if (fromText && ['tinyint', 'smallint', 'int', 'bigint'].includes(def.baseType)) {
			const bad = await scalar(
				runner,
				`SELECT COUNT(*) FROM ${t} WHERE ${c} IS NOT NULL AND ${c} NOT REGEXP '^-?[0-9]+$'`
			);
			if (bad) problems.push(`${op.table}.${op.column}: ${bad} non-integer value(s)`);
		}
		if (def.baseType === 'decimal' && def.precision !== undefined) {
			if (fromText) {
				const bad = await scalar(
					runner,
					`SELECT COUNT(*) FROM ${t} WHERE ${c} IS NOT NULL AND ${c} NOT REGEXP '^-?[0-9]+(\\\\.[0-9]+)?$'`
				);
				if (bad) problems.push(`${op.table}.${op.column}: ${bad} non-numeric value(s)`);
			}
			const limit = Math.pow(10, def.precision - (def.scale ?? 0));
			const over = await scalar(runner, `SELECT COUNT(*) FROM ${t} WHERE ABS(${c}) >= ?`, [limit]);
			if (over) problems.push(`${op.table}.${op.column}: ${over} value(s) too large for ${op.definition}`);
		}
		if (def.baseType === 'timestamp') {
			const outOfRange = await scalar(
				runner,
				`SELECT COUNT(*) FROM ${t} WHERE ${c} IS NOT NULL AND (${c} < '1970-01-01 00:00:01' OR ${c} > '2038-01-19 03:14:07')`
			);
			if (outOfRange) problems.push(`${op.table}.${op.column}: ${outOfRange} value(s) outside TIMESTAMP range`);
		}
	}

	if (op.op === 'addPrimaryKey' && !(await hasPrimaryKey(runner, op.table))) {
		const cols = op.columns.map(q);
		const nulls = await scalar(runner, `SELECT COUNT(*) FROM ${t} WHERE ${cols.map((c) => `${c} IS NULL`).join(' OR ')}`);
		if (nulls) problems.push(`${op.table} PK(${op.columns}): ${nulls} row(s) with NULL key`);
		const dups = await scalar(
			runner,
			`SELECT COUNT(*) FROM (SELECT 1 FROM ${t} GROUP BY ${cols.join(', ')} HAVING COUNT(*) > 1) d`
		);
		if (dups) problems.push(`${op.table} PK(${op.columns}): ${dups} duplicated key value(s)`);
	}

	if (op.op === 'createIndex' && op.unique && !(await indexExists(runner, op.table, op.name))) {
		const cols = op.columns.map(q);
		const dups = await scalar(
			runner,
			`SELECT COUNT(*) FROM (SELECT 1 FROM ${t} WHERE ${cols.map((c) => `${c} IS NOT NULL`).join(' AND ')} GROUP BY ${cols.join(', ')} HAVING COUNT(*) > 1) d`
		);
		if (dups) problems.push(`${op.table} UNIQUE(${op.columns}): ${dups} duplicated value(s)`);
	}

	if (op.op === 'addForeignKey' && !(await foreignKeyExists(runner, op.table, op.name))) {
		const join = op.columns.map((c, i) => `r.${q(op.refColumns[i])} = s.${q(c)}`).join(' AND ');
		const notNull = op.columns.map((c) => `s.${q(c)} IS NOT NULL`).join(' AND ');
		const orphans = await scalar(
			runner,
			`SELECT COUNT(*) FROM ${t} s WHERE ${notNull} AND NOT EXISTS (SELECT 1 FROM ${q(op.refTable)} r WHERE ${join})`
		);
		if (orphans)
			problems.push(`${op.table}(${op.columns}) -> ${op.refTable}: ${orphans} row(s) point to a missing parent`);
	}

	return problems;
}

/**
 * Legacy tables use three different default collations. A foreign key needs the child and
 * parent string columns to share one, so the child column adopts the parent's collation.
 */
async function matchCollations(
	runner: QueryRunner,
	op: Extract<SchemaAlignmentOp, { op: 'addForeignKey' }>
): Promise<void> {
	for (const [i, column] of op.columns.entries()) {
		const rows: Array<{
			side: string;
			COLUMN_TYPE: string;
			IS_NULLABLE: string;
			CHARACTER_SET_NAME: string | null;
			COLLATION_NAME: string | null;
		}> = await runner.query(
			`SELECT 'child' AS side, COLUMN_TYPE, IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME
			 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
			 UNION ALL
			 SELECT 'parent', COLUMN_TYPE, IS_NULLABLE, CHARACTER_SET_NAME, COLLATION_NAME
			 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
			[op.table, column, op.refTable, op.refColumns[i]]
		);
		const child = rows.find((r) => r.side === 'child');
		const parent = rows.find((r) => r.side === 'parent');
		if (!child || !parent || !parent.COLLATION_NAME || child.COLLATION_NAME === parent.COLLATION_NAME) continue;

		// TiDB refuses to change the collation of an indexed column: lift those indexes
		// (non-primary) for the change and put them back exactly as they were.
		const indexes: Array<{ name: string; nonUnique: number; cols: string }> = await runner.query(
			`SELECT INDEX_NAME AS name, MAX(NON_UNIQUE) AS nonUnique,
			        GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS cols
			 FROM information_schema.STATISTICS
			 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME <> 'PRIMARY'
			   AND INDEX_NAME IN (SELECT INDEX_NAME FROM information_schema.STATISTICS
			                      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?)
			 GROUP BY INDEX_NAME`,
			[op.table, op.table, column]
		);
		for (const index of indexes) {
			await runner.query(`DROP INDEX ${q(index.name)} ON ${q(op.table)}`);
		}
		await runner.query(
			`ALTER TABLE ${q(op.table)} MODIFY ${q(column)} ${child.COLUMN_TYPE} CHARACTER SET ${parent.CHARACTER_SET_NAME} COLLATE ${parent.COLLATION_NAME} ${child.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`
		);
		for (const index of indexes) {
			await runner.query(
				`CREATE ${Number(index.nonUnique) ? '' : 'UNIQUE '}INDEX ${q(index.name)} ON ${q(op.table)} (${colList(index.cols.split(','))})`
			);
		}
		logger.log(`${op.table}.${column}: collation ${child.COLLATION_NAME} -> ${parent.COLLATION_NAME} for ${op.name}`);
	}
}

/**
 * TiDB cannot change the type of a clustered primary-key column in place. Rebuild the table:
 * copy it with the new column type, then swap the two names in one atomic RENAME. The old
 * table is kept as `_legacy_backup_pk_<table>`.
 */
async function rebuildPrimaryKeyColumn(runner: QueryRunner, table: string, column: string, definition: string) {
	const rebuilt = `_rebuild_${table}`;
	const backupName = `_legacy_backup_pk_${table}`;
	await runner.query(`DROP TABLE IF EXISTS ${q(rebuilt)}`); // leftover from an interrupted run

	const [{ 'Create Table': ddl }]: Array<{ 'Create Table': string }> = await runner.query(`SHOW CREATE TABLE ${q(table)}`);
	if (/FOREIGN KEY/i.test(ddl)) {
		throw new Error(`${table}: rebuild refuses a table that has foreign keys; drop them first`);
	}
	const columnLine = new RegExp(`^(\\s*)${q(column).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} [^\\n]*?(,?)$`, 'm');
	if (!columnLine.test(ddl)) throw new Error(`${table}: could not find column ${column} in SHOW CREATE TABLE`);
	const newDdl = ddl
		.replace(/^CREATE TABLE `[^`]+`/, `CREATE TABLE ${q(rebuilt)}`)
		.replace(columnLine, (_m, indent: string, comma: string) => `${indent}${q(column)} ${definition}${comma}`);

	await runner.query(newDdl);
	await runner.query(`INSERT INTO ${q(rebuilt)} SELECT * FROM ${q(table)}`);
	const before = await scalar(runner, `SELECT COUNT(*) FROM ${q(table)}`);
	const after = await scalar(runner, `SELECT COUNT(*) FROM ${q(rebuilt)}`);
	if (before !== after) {
		await runner.query(`DROP TABLE ${q(rebuilt)}`);
		throw new Error(`${table}: row count changed during rebuild (${before} -> ${after}); nothing was swapped`);
	}
	await runner.query(`DROP TABLE IF EXISTS ${q(backupName)}`);
	await runner.query(`RENAME TABLE ${q(table)} TO ${q(backupName)}, ${q(rebuilt)} TO ${q(table)}`);
	logger.log(`${table}: rebuilt with ${column} ${definition} (${after} rows); old table kept as ${backupName}`);
}


async function apply(runner: QueryRunner, op: SchemaAlignmentOp): Promise<string | null> {
	const t = q(op.table);
	switch (op.op) {
		case 'modify': {
			const def = parseDefinition(op.definition);
			const fill = def.notNull ? await backfillExpression(runner, op.table, op.column, def) : undefined;
			if (fill !== undefined) {
				const res = await runner.query(
					`UPDATE ${t} SET ${q(op.column)} = ${fill} WHERE ${q(op.column)} IS NULL`
				);
				const filled = Number(res?.affectedRows ?? 0);
				if (filled) logger.log(`${op.table}.${op.column}: filled ${filled} NULL(s) with ${fill}`);
			}
			const [current]: Array<{ COLUMN_TYPE: string; COLUMN_KEY: string }> = await runner.query(
				`SELECT COLUMN_TYPE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
				[op.table, op.column]
			);
			if (current?.COLUMN_KEY === 'PRI') {
				const targetType = /^\w+(?:\([^)]*\))?/.exec(op.definition)?.[0].toLowerCase();
				if (current.COLUMN_TYPE.toLowerCase() === targetType) return null; // already done
				await rebuildPrimaryKeyColumn(runner, op.table, op.column, op.definition);
				return `rebuild ${op.table}.${op.column}`;
			}
			await runner.query(`ALTER TABLE ${t} MODIFY ${q(op.column)} ${op.definition}`);
			return `modify ${op.table}.${op.column}`;
		}
		case 'addPrimaryKey':
			if (await hasPrimaryKey(runner, op.table)) return null;
			await runner.query(`ALTER TABLE ${t} ADD PRIMARY KEY (${colList(op.columns)})`);
			return `primary key ${op.table}`;
		case 'dropIndex':
			if (!(await indexExists(runner, op.table, op.name))) return null;
			await runner.query(`DROP INDEX ${q(op.name)} ON ${t}`);
			return `drop index ${op.name}`;
		case 'createIndex':
			if (await indexExists(runner, op.table, op.name)) return null;
			await runner.query(
				`CREATE ${op.unique ? 'UNIQUE ' : ''}INDEX ${q(op.name)} ON ${t} (${colList(op.columns)})`
			);
			return `create index ${op.name}`;
		case 'dropForeignKey':
			if (!(await foreignKeyExists(runner, op.table, op.name))) return null;
			await runner.query(`ALTER TABLE ${t} DROP FOREIGN KEY ${q(op.name)}`);
			return `drop fk ${op.name}`;
		case 'addForeignKey':
			if (await foreignKeyExists(runner, op.table, op.name)) return null;
			await matchCollations(runner, op);
			await runner.query(
				`ALTER TABLE ${t} ADD CONSTRAINT ${q(op.name)} FOREIGN KEY (${colList(op.columns)}) REFERENCES ${q(op.refTable)} (${colList(op.refColumns)}) ON DELETE ${op.onDelete} ON UPDATE ${op.onUpdate}`
			);
			return `add fk ${op.name}`;
	}
}

export async function precheckSchemaAlignment(runner: QueryRunner, ops: SchemaAlignmentOp[]): Promise<string[]> {
	const problems: string[] = [];
	for (const op of ops) problems.push(...(await precheck(runner, op)));
	return problems;
}

/**
 * Lets an interrupted run resume. A drop-then-recreate index pair whose index already has its
 * target shape is left alone (a foreign key may now depend on it), and a column that already
 * has its target type and nullability is not modified again.
 */
async function alreadyInTargetState(
	runner: QueryRunner,
	op: SchemaAlignmentOp,
	ops: SchemaAlignmentOp[]
): Promise<boolean> {
	if (op.op === 'dropIndex') {
		const target = ops.find(
			(o): o is Extract<SchemaAlignmentOp, { op: 'createIndex' }> =>
				o.op === 'createIndex' && o.table === op.table && o.name === op.name
		);
		if (!target) return false;
		const [current]: Array<{ cols: string | null; nonUnique: number | null }> = await runner.query(
			`SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS cols, MAX(NON_UNIQUE) AS nonUnique
			 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
			[op.table, op.name]
		);
		return (
			!!current?.cols &&
			current.cols === target.columns.join(',') &&
			Number(current.nonUnique) === (target.unique ? 0 : 1)
		);
	}
	if (op.op === 'modify') {
		const [current]: Array<{ COLUMN_TYPE: string; IS_NULLABLE: string }> = await runner.query(
			`SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
			[op.table, op.column]
		);
		if (!current) return false;
		const targetType = /^\w+(?:\s*\([^)]*\))?/.exec(op.definition)?.[0].toLowerCase().replace(/\s+/g, '');
		const currentType = current.COLUMN_TYPE.toLowerCase().replace(/\s+/g, '');
		const notNull = parseDefinition(op.definition).notNull;
		return currentType === targetType && (current.IS_NULLABLE === 'NO') === notNull;
	}
	return false;
}

export async function runSchemaAlignment(runner: QueryRunner, ops: SchemaAlignmentOp[]): Promise<void> {
	// DATETIME -> TIMESTAMP conversion is interpreted in the session time zone; the app writes UTC.
	await runner.query(`SET time_zone = '+00:00'`);

	const problems = await precheckSchemaAlignment(runner, ops);
	if (problems.length) {
		throw new Error(
			`Schema alignment aborted before any change. Fix these rows first:\n - ${problems.join('\n - ')}`
		);
	}

	let applied = 0;
	for (const [i, op] of ops.entries()) {
		try {
			if (await alreadyInTargetState(runner, op, ops)) continue;
			if (await apply(runner, op)) applied++;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(
				`Schema alignment stopped at op ${i + 1}/${ops.length} (${JSON.stringify(op)}): ${message}. ` +
					'Earlier ops are applied; fix the cause and run the migration again, it resumes safely.'
			);
		}
	}
	logger.log(`Schema alignment complete: ${applied} change(s) across ${ops.length} op(s).`);
}
