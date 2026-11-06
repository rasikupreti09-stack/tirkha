import { Redirect } from "expo-router";

/** The authenticated app's landing route is the interactive diagnostic assistant. */
export default function AppHome() {
  return <Redirect href="/(app)/assistant" />;
}
