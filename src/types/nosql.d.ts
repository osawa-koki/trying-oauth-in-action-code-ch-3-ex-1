declare module 'nosql' {
  interface Builder {
    where: (field: string, value: string | null) => void;
    callback: (callback: (err: Error | null, token: TokenData | null) => void) => void;
  }

  interface TokenData {
    access_token: string;
    client_id: string;
    scope: string | null;
  }

  interface Database {
    insert: (data: TokenData) => void;
    clear: () => void;
    one: () => {
      make: (callback: (builder: Builder) => void) => void;
    };
  }

  const nosql: {
    load: (path: string) => Database;
  };

  export default nosql;
}
