/* eslint-disable @typescript-eslint/naming-convention */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      WEB_SOCKET_ADDRESS: string;
      WEB_SOCKET_SECRET: string;
      AZURE_COMPUTERVISIONKEY: string;
      AZURE_COMPUTERVISIONENDPOINT: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
