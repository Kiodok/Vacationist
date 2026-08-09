// A minimal, purpose-built in-memory stand-in for the subset of the
// supabase-js / postgrest-js query builder API actually used by this
// package's data-access functions. Not a general Supabase mock — just
// enough chained-method + `await`-as-thenable support to drive real
// service functions (e.g. recipes.ts) against controllable, inspectable
// in-memory tables in tests, without needing a live database.
//
// Usage:
//   const fake = createFakeSupabaseClient();
//   fake.seed('shopping_items', [...]);
//   vi.mock('../client', () => ({ supabase: fake.client, freshChannel: vi.fn() }));
//   // ...call the function under test...
//   fake.getTable('shopping_items') // inspect resulting rows

type Row = Record<string, unknown>;

type FilterFn = (row: Row) => boolean;

interface PostgrestResult<T> {
  data: T | null;
  error: { message: string } | null;
}

let nextId = 1;
function generateId(): string {
  return `fake-id-${nextId++}`;
}

class FakeQueryBuilder implements PromiseLike<PostgrestResult<unknown>> {
  private filters: FilterFn[] = [];
  private orderCol: string | null = null;
  private orderAscending = true;
  private limitN: number | null = null;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private writePayload: Row | null = null;
  private wantSingle = false;
  private wantReturnAfterWrite = false;

  constructor(private readonly rows: Row[]) {}

  select(_columns?: string): this {
    if (this.mode !== 'select') this.wantReturnAfterWrite = true;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  // Only the `.not(col, 'is', null)` ("column IS NOT NULL") form is used in this codebase.
  not(column: string, operator: 'is', value: null): this {
    if (operator === 'is' && value === null) {
      this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    }
    return this;
  }

  // Only `.is(col, null)` ("column IS NULL") is used in this codebase.
  is(column: string, value: null): this {
    if (value === null) {
      this.filters.push((row) => row[column] === null || row[column] === undefined);
    }
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }): this {
    this.orderCol = column;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): this {
    this.wantSingle = true;
    return this;
  }

  insert(payload: Row): this {
    this.mode = 'insert';
    this.writePayload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = 'update';
    this.writePayload = payload;
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  private matches(): Row[] {
    let result = this.rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.orderCol) {
      const col = this.orderCol;
      result = [...result].sort((a, b) => {
        const av = a[col] as number | string;
        const bv = b[col] as number | string;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return this.orderAscending ? cmp : -cmp;
      });
    }
    if (this.limitN != null) result = result.slice(0, this.limitN);
    return result;
  }

  private execute(): PostgrestResult<unknown> {
    if (this.mode === 'select') {
      const result = this.matches();
      if (this.wantSingle) {
        if (result.length !== 1) return { data: null, error: { message: 'no rows (or too many) for .single()' } };
        return { data: result[0], error: null };
      }
      return { data: result, error: null };
    }

    if (this.mode === 'insert') {
      const inserted: Row = { id: generateId(), ...this.writePayload };
      this.rows.push(inserted);
      if (this.wantReturnAfterWrite) {
        return this.wantSingle ? { data: inserted, error: null } : { data: [inserted], error: null };
      }
      return { data: null, error: null };
    }

    if (this.mode === 'update') {
      const targets = this.rows.filter((row) => this.filters.every((f) => f(row)));
      for (const row of targets) Object.assign(row, this.writePayload);
      if (this.wantReturnAfterWrite) {
        if (this.wantSingle) {
          return targets.length === 1
            ? { data: targets[0], error: null }
            : { data: null, error: { message: 'no rows (or too many) for .single()' } };
        }
        return { data: targets, error: null };
      }
      return { data: null, error: null };
    }

    // delete
    const toDelete = new Set(this.rows.filter((row) => this.filters.every((f) => f(row))));
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (toDelete.has(this.rows[i])) this.rows.splice(i, 1);
    }
    return { data: null, error: null };
  }

  then<TResult1 = PostgrestResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export interface FakeSupabaseClient {
  client: {
    from: (table: string) => FakeQueryBuilder;
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<PostgrestResult<unknown>>;
    auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  };
  seed: (table: string, rows: Row[]) => void;
  getTable: (table: string) => Row[];
  setSession: (userId: string | null) => void;
}

/**
 * `get_recipe_linked_lists` is a real Postgres RPC (SELECT DISTINCT shopping_list_id
 * FROM shopping_items WHERE source_recipe_id = p_recipe_id) — reimplemented here
 * against the in-memory store so getLinkedShoppingListIds() works unmodified.
 */
function handleRpc(tables: Map<string, Row[]>, fn: string, args: Record<string, unknown>): PostgrestResult<unknown> {
  if (fn === 'get_recipe_linked_lists') {
    const items = tables.get('shopping_items') ?? [];
    const recipeId = args.p_recipe_id;
    const listIds = new Set(
      items.filter((i) => i.source_recipe_id === recipeId).map((i) => i.shopping_list_id),
    );
    return { data: [...listIds].map((shopping_list_id) => ({ shopping_list_id })), error: null };
  }
  throw new Error(`fakeSupabaseClient: unhandled rpc "${fn}"`);
}

export function createFakeSupabaseClient(): FakeSupabaseClient {
  const tables = new Map<string, Row[]>();
  let sessionUserId: string | null = 'fake-user-id';

  const getTableArray = (table: string): Row[] => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };

  return {
    client: {
      from: (table: string) => new FakeQueryBuilder(getTableArray(table)),
      rpc: (fn: string, args: Record<string, unknown>) =>
        Promise.resolve(handleRpc(tables, fn, args)),
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: sessionUserId ? { user: { id: sessionUserId } } : null },
          }),
      },
    },
    seed: (table: string, rows: Row[]) => {
      getTableArray(table).push(...rows);
    },
    getTable: (table: string) => getTableArray(table),
    setSession: (userId: string | null) => {
      sessionUserId = userId;
    },
  };
}
