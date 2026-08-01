const UPSTREAM_ORIGIN =
  "https://chronokalamos.burrows-bandeau-7x.chatgpt.site";

const EDGE_RELEASE = "mainland-proxy-v1";
const STRIPPED_REQUEST_HEADERS = [
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "forwarded",
  "x-forwarded-for",
  "x-real-ip",
];

export function rewriteLocation(location, publicUrl, upstreamUrl) {
  if (!location) {
    return null;
  }

  const resolved = new URL(location, upstreamUrl);
  if (resolved.origin !== new URL(UPSTREAM_ORIGIN).origin) {
    return location;
  }

  resolved.protocol = publicUrl.protocol;
  resolved.host = publicUrl.host;
  return resolved.toString();
}

export function rewriteSetCookie(value, publicHostname) {
  return value.replace(
    /Domain=(?:\.)?chatgpt\.site/gi,
    `Domain=${publicHostname}`,
  );
}

export function createUpstreamRequest(request, upstreamUrl, publicUrl) {
  const headers = new Headers(request.headers);

  for (const header of STRIPPED_REQUEST_HEADERS) {
    headers.delete(header);
  }

  headers.set("x-forwarded-host", publicUrl.host);
  headers.set("x-forwarded-proto", publicUrl.protocol.slice(0, -1));

  return new Request(upstreamUrl, {
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    headers,
    method: request.method,
    redirect: "manual",
  });
}

export function createPublicResponse(upstreamResponse, publicUrl, upstreamUrl) {
  const headers = new Headers(upstreamResponse.headers);
  const location = rewriteLocation(
    headers.get("location"),
    publicUrl,
    upstreamUrl,
  );

  if (location) {
    headers.set("location", location);
  }

  const setCookies =
    typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : [];

  if (setCookies.length > 0) {
    headers.delete("set-cookie");
    for (const cookie of setCookies) {
      headers.append(
        "set-cookie",
        rewriteSetCookie(cookie, publicUrl.hostname),
      );
    }
  } else {
    const setCookie = headers.get("set-cookie");
    if (setCookie) {
      headers.set(
        "set-cookie",
        rewriteSetCookie(setCookie, publicUrl.hostname),
      );
    }
  }

  headers.set("x-chronokalamos-edge", EDGE_RELEASE);
  headers.set("x-chronokalamos-origin-status", String(upstreamResponse.status));

  return new Response(upstreamResponse.body, {
    headers,
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });
}

const mainlandEdgeProxy = {
  async fetch(request) {
    const publicUrl = new URL(request.url);
    const upstreamUrl = new URL(
      `${publicUrl.pathname}${publicUrl.search}`,
      UPSTREAM_ORIGIN,
    );

    try {
      const upstreamRequest = createUpstreamRequest(
        request,
        upstreamUrl,
        publicUrl,
      );
      const upstreamResponse = await fetch(upstreamRequest);
      return createPublicResponse(upstreamResponse, publicUrl, upstreamUrl);
    } catch {
      return Response.json(
        {
          code: "edge_origin_unavailable",
          message: "站点源站暂时不可用，请稍后重试。",
        },
        {
          headers: {
            "cache-control": "no-store",
            "x-chronokalamos-edge": EDGE_RELEASE,
          },
          status: 502,
        },
      );
    }
  },
};

export default mainlandEdgeProxy;
