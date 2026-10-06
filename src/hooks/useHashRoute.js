import { useEffect, useState } from "react";

// Minimal hash router: "#/admin/tags?tag=foo" -> { path: "/admin/tags", query: URLSearchParams }.
// Hash routing needs no server config, which suits a static Vite app.
function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(search) };
}

export function navigate(to) {
  window.location.hash = to;
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
