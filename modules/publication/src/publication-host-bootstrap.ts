import { PublicationApplicationHost } from "./publication-application-host.js";
import {
  SystemPublicationHostClock,
  type PublicationHostClock,
} from "./publication-host-clock.js";
import {
  composePublicationHostApplication,
  type PublicationCompositionOptions,
} from "./publication-composition-root.js";

export interface PublicationApplicationHostOptions {
  readonly clock?: PublicationHostClock;
  readonly compositionOptions?: PublicationCompositionOptions;
}

export function createPublicationApplicationHost(
  options: PublicationApplicationHostOptions = {},
): PublicationApplicationHost {
  return new PublicationApplicationHost(
    composePublicationHostApplication,
    options.clock ?? new SystemPublicationHostClock(),
    options.compositionOptions ?? {},
  );
}

export function bootstrapPublicationApplicationHost(
  options: PublicationApplicationHostOptions = {},
): PublicationApplicationHost {
  const host = createPublicationApplicationHost(options);
  host.start();
  return host;
}
