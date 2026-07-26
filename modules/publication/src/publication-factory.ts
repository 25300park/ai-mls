import { createCommandContext, createPublicationBinding, createPublicationIdentity, immutableDomain } from "./publication-contracts.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { CreatePublicationCommand } from "./publication-commands.js";

export class PublicationFactory {
  public static create(input: CreatePublicationCommand): PublicationAggregate {
    return PublicationAggregate.create(immutableDomain({
      ...input,
      identity: createPublicationIdentity(input.identity),
      binding: createPublicationBinding(input.binding),
      command: createCommandContext(input.command),
    }));
  }
}

export function createPublication(input: CreatePublicationCommand): PublicationAggregate {
  return PublicationFactory.create(input);
}
