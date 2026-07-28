import { createPublicationApplicationHost } from "./publication-host-bootstrap.js";
import { createPublicationExecutableConfiguration } from "./publication-executable-configuration.js";
import {
  PublicationInProcessExecutable,
  type PublicationExecutableHostFactory,
} from "./publication-in-process-executable.js";

export type { PublicationExecutableHostFactory } from "./publication-in-process-executable.js";

const defaultHostFactory: PublicationExecutableHostFactory = () =>
  createPublicationApplicationHost();

export function createPublicationInProcessExecutable(
  configuration?: unknown,
  hostFactory: PublicationExecutableHostFactory = defaultHostFactory,
): PublicationInProcessExecutable {
  return new PublicationInProcessExecutable(
    createPublicationExecutableConfiguration(configuration),
    hostFactory,
  );
}
