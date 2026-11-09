import { Redirect } from "expo-router";

/** Route malformed or stale deep links through the app's role-aware entry point. */
export default function NotFoundRoute() {
  return <Redirect href="/" />;
}
