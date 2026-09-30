/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Μικρή ψεύτικη βάση στη μνήμη, με το υποσύνολο του supabase-js query builder που
 * χρησιμοποιεί η εφαρμογή. Χρησιμοποιείται ΜΟΝΟ στα tests, ώστε να τρέχει ο
 * πραγματικός κώδικας των server actions/loaders χωρίς πραγματικό Supabase.
 */
type Row = Record<string, any>;
type Relation = { table: string; fk: string };

export interface FakeDbConfig {
  seed: Record<string, Row[]>;
  /** many-to-one embeds: relations[table][embedName] = { table, fk } */
  relations: Record<string, Record<string, Relation>>;
  /** μοναδικοί περιορισμοί: uniques[table] = [[colA, colB], ...] */
  uniques: Record<string, string[][]>;
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function createFakeDb(config: FakeDbConfig) {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(config.seed)) tables[k] = v.map((r) => ({ ...r }));
  const T = (name: string) => (tables[name] ??= []);

  function project(table: string, row: Row, cols: string): Row {
    if (!cols || cols.trim() === "*") return { ...row };
    const out: Row = {};
    for (const part of splitTop(cols)) {
      const m = part.match(/^(\w+)\(([\s\S]*)\)$/);
      if (m) {
        const rel = config.relations[table]?.[m[1]];
        if (!rel) throw new Error(`fakeDb: άγνωστη σχέση ${table}.${m[1]}`);
        const target = T(rel.table).find((r) => r.id === row[rel.fk]);
        out[m[1]] = target ? project(rel.table, target, m[2]) : null;
      } else out[part] = row[part];
    }
    return out;
  }

  class Query {
    private op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    private filters: ((r: Row) => boolean)[] = [];
    private payload: any = null;
    private cols = "*";
    private wantReturn = false;
    private orderSpecs: { col: string; asc: boolean }[] = [];
    private limitN: number | null = null;
    private mode: "many" | "maybe" | "single" = "many";
    private headCount = false;
    private onConflict: string[] | null = null;
    constructor(private table: string) {}

    select(cols = "*", opts?: { count?: string; head?: boolean }) {
      if (this.op === "select") this.cols = cols;
      else {
        this.wantReturn = true;
        this.cols = cols;
      }
      if (opts?.head) this.headCount = true;
      return this;
    }
    insert(p: any) { this.op = "insert"; this.payload = p; return this; }
    update(p: any) { this.op = "update"; this.payload = p; return this; }
    upsert(p: any, o?: { onConflict?: string }) {
      this.op = "upsert"; this.payload = p;
      this.onConflict = o?.onConflict ? o.onConflict.split(",").map((s) => s.trim()) : null;
      return this;
    }
    delete() { this.op = "delete"; return this; }
    eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
    neq(col: string, val: any) { this.filters.push((r) => r[col] !== val); return this; }
    in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
    is(col: string, val: null) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
    not(col: string, op: string, val: any) {
      if (op === "is" && val === null) this.filters.push((r) => r[col] != null);
      else throw new Error(`fakeDb: not(${op}) δεν υποστηρίζεται`);
      return this;
    }
    like(col: string, pat: string) {
      const rx = new RegExp("^" + pat.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
      this.filters.push((r) => rx.test(String(r[col] ?? "")));
      return this;
    }
    ilike(col: string, pat: string) {
      const rx = new RegExp("^" + pat.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
      this.filters.push((r) => rx.test(String(r[col] ?? "")));
      return this;
    }
    or(expr: string) {
      const conds = expr.split(",").map((c) => {
        const [col, op, ...rest] = c.split(".");
        if (op !== "eq") throw new Error("fakeDb: or() μόνο eq");
        return { col, val: rest.join(".") };
      });
      this.filters.push((r) => conds.some((c) => r[c.col] === c.val));
      return this;
    }
    order_(col: string, o?: { ascending?: boolean }) { this.orderSpecs.push({ col, asc: o?.ascending !== false }); return this; }
    limit(n: number) { this.limitN = n; return this; }
    maybeSingle() { this.mode = "maybe"; return this; }
    single() { this.mode = "single"; return this; }

    private violates(row: Row, ignore?: Row): string | null {
      for (const cols of config.uniques[this.table] ?? []) {
        const clash = T(this.table).find(
          (r) => r !== ignore && cols.every((c) => r[c] !== undefined && r[c] === row[c])
        );
        if (clash) return `duplicate key value violates unique constraint (${cols.join(",")})`;
      }
      return null;
    }

    private run(): { data: any; error: any; count?: number } {
      const rows = T(this.table);
      const matches = () => rows.filter((r) => this.filters.every((f) => f(r)));

      if (this.op === "select") {
        let found = matches();
        if (this.orderSpecs.length) {
          found = [...found].sort((a, b) => {
            for (const { col, asc } of this.orderSpecs) {
              const c = a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0;
              if (c !== 0) return c * (asc ? 1 : -1);
            }
            return 0;
          });
        }
        if (this.limitN != null) found = found.slice(0, this.limitN);
        if (this.headCount) return { data: null, error: null, count: found.length };
        const projected = found.map((r) => project(this.table, r, this.cols));
        return this.shape(projected);
      }

      if (this.op === "insert" || this.op === "upsert") {
        const list: Row[] = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted: Row[] = [];
        for (const item of list) {
          let row: Row = { id: crypto.randomUUID(), ...item };
          if (this.op === "upsert" && this.onConflict) {
            const existing = rows.find((r) => this.onConflict!.every((c) => r[c] === row[c]));
            if (existing) {
              Object.assign(existing, item);
              inserted.push(existing);
              continue;
            }
          }
          const bad = this.violates(row);
          if (bad) return { data: null, error: { message: bad, code: "23505" } };
          rows.push(row);
          inserted.push(row);
        }
        if (!this.wantReturn) return { data: null, error: null };
        return this.shape(inserted.map((r) => project(this.table, r, this.cols)));
      }

      if (this.op === "update") {
        const found = matches();
        for (const r of found) {
          const next = { ...r, ...this.payload };
          const bad = this.violates(next, r);
          if (bad) return { data: null, error: { message: bad, code: "23505" } };
          Object.assign(r, this.payload);
        }
        return this.wantReturn ? this.shape(found.map((r) => project(this.table, r, this.cols))) : { data: null, error: null };
      }

      // delete
      const found = new Set(matches());
      tables[this.table] = rows.filter((r) => !found.has(r));
      return { data: null, error: null };
    }

    private shape(list: Row[]) {
      if (this.mode === "many") return { data: list, error: null };
      if (this.mode === "maybe") return { data: list[0] ?? null, error: null };
      return list.length === 1 || list.length > 1
        ? { data: list[0], error: null }
        : { data: null, error: { message: "no rows" } };
    }

    then(resolve: (v: any) => any, reject?: (e: any) => any) {
      try { return Promise.resolve(this.run()).then(resolve, reject); }
      catch (e) { return Promise.reject(e).then(resolve, reject); }
    }
  }

  // ώστε το .order(...) να μην συγκρούεται με το εσωτερικό πεδίο
  (Query.prototype as any).order = (Query.prototype as any).order_;

  const client = {
    from: (table: string) => new Query(table),
    rpc: async () => ({ data: null, error: null }),
  };
  return { client, tables, T };
}
