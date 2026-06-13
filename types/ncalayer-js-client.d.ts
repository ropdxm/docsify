// Minimal types for ncalayer-js-client (the package ships no .d.ts). It is a
// CommonJS module that does `exports.NCALayerClient = NCALayerClient`, i.e. a
// NAMED export — not a default export. Only the surface we use is declared.
declare module "ncalayer-js-client" {
  export class NCALayerClient {
    static basicsStorageAll: string;
    static basicsCMSParamsDetached: unknown;
    static basicsCMSParamsAttached: unknown;
    static basicsSignerSignAny: unknown;
    constructor(url?: string, allowKmdHttpApi?: boolean);
    connect(): Promise<void>;
    basicsSignCMS(
      storageType: string,
      data: string | ArrayBuffer | Blob | File,
      cmsParams: unknown,
      signerType: unknown
    ): Promise<string>;
  }
}
