declare module "node:sqlite" {
  type SQLiteValue = string | number | bigint | null;

  export class StatementSync {
    run(...values: SQLiteValue[]): unknown;
    all(...values: SQLiteValue[]): Record<string, unknown>[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
