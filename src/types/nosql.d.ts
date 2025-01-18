declare module 'nosql' {
  interface Database {
    insert: (data: any) => void;
    clear: () => void;
  }

  const nosql: {
    load: (path: string) => Database;
  };

  export default nosql;
}
