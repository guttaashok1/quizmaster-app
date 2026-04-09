import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class FileStore<T> {
  private filePath: string;
  private cache: Map<string, T>;

  constructor(filename: string) {
    this.filePath = path.join(DATA_DIR, filename);
    this.cache = new Map();
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, T>;
        this.cache = new Map(Object.entries(data));
        console.log(`Loaded ${this.cache.size} entries from ${this.filePath}`);
      }
    } catch (err) {
      console.error(`Error loading ${this.filePath}:`, err);
      this.cache = new Map();
    }
  }

  private save(): void {
    try {
      const obj: Record<string, T> = {};
      this.cache.forEach((value, key) => {
        obj[key] = value;
      });
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Error saving ${this.filePath}:`, err);
    }
  }

  get(key: string): T | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  set(key: string, value: T): void {
    this.cache.set(key, value);
    this.save();
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) this.save();
    return result;
  }

  get size(): number {
    return this.cache.size;
  }
}
