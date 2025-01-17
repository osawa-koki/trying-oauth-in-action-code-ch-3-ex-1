declare module 'underscore.string' {
  interface UnderscoreString {
    trim: (str: string) => string;
    stripTags: (str: string) => string;
    capitalize: (str: string) => string;
    decapitalize: (str: string) => string;
    camelize: (str: string) => string;
    dasherize: (str: string) => string;
    slugify: (str: string) => string;
  }
  const _: UnderscoreString;
  export = _;
}
