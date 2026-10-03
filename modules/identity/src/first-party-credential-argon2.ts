import * as crypto from "node:crypto";

export const ARGON2ID_V1 = Object.freeze({ memory: 19456, passes: 2, parallelism: 1, tagLength: 32, saltLength: 16 });
export class FirstPartyAuthenticationError extends Error {
  public constructor(public readonly code: "AUTHENTICATION_UNAVAILABLE" | "INVALID_CREDENTIAL" = "AUTHENTICATION_UNAVAILABLE") {
    super(code === "AUTHENTICATION_UNAVAILABLE" ? "Authentication unavailable." : "Authentication failed.");
    this.name = "FirstPartyAuthenticationError";
  }
}
export interface Argon2Runtime {
  readonly argon2?: typeof crypto.argon2;
}
export class Argon2idV1Verifier {
  public constructor(private readonly runtime: Argon2Runtime = crypto) {}
  public assertAvailable(): void {
    if (typeof this.runtime.argon2 !== "function") throw new FirstPartyAuthenticationError();
  }
  public generateSalt(): Buffer { return crypto.randomBytes(ARGON2ID_V1.saltLength); }
  public async derive(password: string, salt: Uint8Array): Promise<Buffer> {
    this.assertAvailable();
    if (typeof password !== "string" || password.length === 0 || salt.length !== ARGON2ID_V1.saltLength) throw new FirstPartyAuthenticationError("INVALID_CREDENTIAL");
    const message = Buffer.from(password, "utf8");
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        this.runtime.argon2!("argon2id", { message, nonce: Buffer.from(salt), memory: ARGON2ID_V1.memory, passes: ARGON2ID_V1.passes, parallelism: ARGON2ID_V1.parallelism, tagLength: ARGON2ID_V1.tagLength }, (error, key) => {
          if (error !== null || key?.length !== ARGON2ID_V1.tagLength) reject(new FirstPartyAuthenticationError());
          else resolve(key);
        });
      });
    } catch { throw new FirstPartyAuthenticationError(); }
    finally { message.fill(0); }
  }
  public async verify(password: string, salt: Uint8Array, derivedKey: Uint8Array): Promise<boolean> {
    if (derivedKey.length !== ARGON2ID_V1.tagLength) throw new FirstPartyAuthenticationError("INVALID_CREDENTIAL");
    const actual = await this.derive(password, salt);
    try { return crypto.timingSafeEqual(actual, derivedKey); }
    finally { actual.fill(0); }
  }
}
