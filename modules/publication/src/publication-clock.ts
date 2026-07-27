export interface PublicationClock {
  now(): string;
}

export class SystemPublicationClock implements PublicationClock {
  public now(): string {
    return new Date().toISOString();
  }
}

export class FixedClock implements PublicationClock {
  public constructor(private readonly timestamp: string) {}

  public now(): string {
    return this.timestamp;
  }
}
