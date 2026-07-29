import { NextResponse } from "next/server";
import {
  type ApiScope,
  type RequestAuth,
  getRequestAuth,
  hasScope,
} from "@/lib/device-auth";
import { hasTrustedOrigin } from "@/lib/request-security";

export async function requireRequestAuth(
  request: Request,
  options?: { scope?: ApiScope },
): Promise<RequestAuth | NextResponse> {
  const auth = await getRequestAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (options?.scope && !hasScope(auth, options.scope)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return auth;
}

/** CSRF check for cookie-session mutations; Bearer clients skip Origin. */
export function requireTrustedMutation(request: Request, auth: RequestAuth): NextResponse | null {
  if (auth.via === "bearer") {
    return null;
  }
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  return null;
}

export function isAuthError(
  value: RequestAuth | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
