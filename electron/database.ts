import { app } from 'electron'
import path from 'path'
import BetterSqlite3 from 'better-sqlite3'

export class Database {
  private db: BetterSqlite3.Database

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'benchmarks.db')
    this.db = new BetterSqlite3(dbPath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        model_name TEXT NOT NULL,
        model_path TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `)
  }

  saveResult(result: any): void {
    this.db.prepare(`
      INSERT INTO results (id, timestamp, model_name, model_path, type, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      result.id,
      result.timestamp,
      result.modelName,
      result.modelPath,
      result.type,
      JSON.stringify(result.data)
    )
  }

  getAllResults(): any[] {
    const rows = this.db.prepare('SELECT * FROM results ORDER BY timestamp DESC').all() as any[]
    return rows.map((row) => ({
      id: row.id,
      timestamp: row.timestamp,
      modelName: row.model_name,
      modelPath: row.model_path,
      type: row.type,
      data: JSON.parse(row.data),
    }))
  }

  deleteResult(id: string): void {
    this.db.prepare('DELETE FROM results WHERE id = ?').run(id)
  }
}
