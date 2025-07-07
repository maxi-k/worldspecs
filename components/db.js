import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_next from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// Load static DuckDB database from GitHub
import dbfile from '/static/cloudspecs.duckdb?url';

const MANUAL_BUNDLES = Object.freeze({
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_wasm_next,
        mainWorker: eh_worker
    },
});

const DB_NAME = "cloudspecs.duckdb";
export default class DB {
  #db; #conn;

  constructor(db, conn) {
    this.#db = db;
    this.#conn = conn;
  }

  static async create() {
    // Select a bundle based on browser checks
    const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

    // Instantiate the asynchronus version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

    // Fetch the database file
    //TODO: Could fail for large objects
    const arrayBuffer = new Uint8Array(await (await fetch(dbfile)).arrayBuffer());

    // Register the file in DuckDB's virtual filesystem
    await db.registerFileBuffer(DB_NAME, new Uint8Array(arrayBuffer));

    // create connection
    const conn = await db.connect();
    await conn.send("ATTACH 'cloudspecs.duckdb' AS specs;");
    await conn.send("USE specs;");

    return new DB(db, conn)
  }

  async query(q) {
    try {
      const response = await this.#conn.query(q);
      const columns = response.schema.fields.map(field => field.name);
      // Bug fix explained at: https://github.com/GoogleChromeLabs/jsbi/issues/30
      const rows = JSON.parse(JSON.stringify(response.toArray(), (key, value) =>
          typeof value === 'bigint' ? parseInt(value.toString()) : value // return everything else unchanged
      ));
      let add = {};
      if ((new Set(columns)).size != columns.length){
        console.log("adding warning")
        add.warning = 'Your query returns duplicate column names which may not be rendered correctly.';
      }
      return { columns, rows, ...add };
    } catch (error) {
      return { error: error.toString()?.split("\n") }
    }
  }
};
