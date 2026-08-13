import { composeDevelopmentAdminConsole } from "./console-composition.js";
import { parseAdminConsoleArguments } from "./console-configuration.js";

const configuration = parseAdminConsoleArguments(process.argv.slice(2));
const composition = composeDevelopmentAdminConsole(configuration);

await composition.server.start();
process.stdout.write(`AI-MLS Admin Console: ${composition.server.localUrl}\n`);

let stopping = false;
const stop = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  await composition.server.stop();
};

process.once("SIGINT", () => { void stop().then(() => process.exit(0)); });
process.once("SIGTERM", () => { void stop().then(() => process.exit(0)); });
