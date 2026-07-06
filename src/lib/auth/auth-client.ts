import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// No baseURL: auth requests stay same-origin, so login works on every
// domain the site is served from (see PUBLIC_HOSTS in @/lib/base-url).
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
