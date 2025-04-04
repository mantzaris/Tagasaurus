declare module 'libsql/promise' {
    //import types from the standard libsql module for reference
    import Libsql from 'libsql';
  
    //export the Database class with promise-based methods
    export default class Database {
      constructor(path: string, options?: {
        readonly?: boolean;
        fileMustExist?: boolean;
        syncUrl?: string;
        authToken?: string;
        timeout?: number;
      });
      
      //core methods
      prepare(sql: string): Promise<Statement>;
      exec(sql: string): Promise<void>;
      sync(): Promise<void>;
      
      //additional methods that 'might' be needed
      close(): Promise<void>;
      transaction<T>(cb: (tx: Transaction) => Promise<T>): Promise<T>;
      backup(destination: string | Database, options?: {
        progress?: (remaining: number, total: number) => void;
      }): Promise<void>;
      
      //properties
      readonly name: string;
      readonly open: boolean;
      readonly inTransaction: boolean;
      readonly memory: boolean;
      readonly readonly: boolean;
    }
    
    export class Statement {
      //basic/core methods
      get(...params: any[]): Promise<any>;
      run(...params: any[]): Promise<RunResult>;
      all(...params: any[]): Promise<any[]>;
      
      //additional methods
      finalize(): Promise<void>;
      bind(...params: any[]): Promise<void>;
      iterate(...params: any[]): Promise<AsyncIterableIterator<any>>;
      expand(...params: any[]): Promise<any[]>;
      columns(): Promise<string[]>;
      
      //properties
      readonly source: string;
      readonly reader: boolean;
    }
    
    export interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }
    
    export interface Transaction {
      prepare(sql: string): Promise<Statement>;
      exec(sql: string): Promise<void>;
      commit(): Promise<void>;
      rollback(): Promise<void>;
    }
    
    //export the Database type for type annotations
    export type Database = InstanceType<typeof Database>;
    
    //to make compatibility with existing code that expects the standard Database type
    export type StandardDatabase = Libsql.Database;
}