export interface PublicationHostClock {
  now(): number;
}

export class SystemPublicationHostClock implements PublicationHostClock {
  public now(): number {
    return Date.now();
  }
}
