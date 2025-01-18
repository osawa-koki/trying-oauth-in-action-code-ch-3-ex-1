declare module 'nosql' {
  interface TokenData {
    access_token: string;
    client_id: string;
    scope: string | null;
  }

  interface Database {
    insert: (data: TokenData) => void;
    clear: () => void;
  }

  const nosql: {
    load: (path: string) => Database;
  };

  export default nosql;
}
