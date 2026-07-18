// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Vinext injects the platform D1 type at deploy time.
declare type D1Database = any;

declare interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
  };
}
