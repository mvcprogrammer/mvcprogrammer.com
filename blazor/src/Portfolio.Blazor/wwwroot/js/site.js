// blazor.mvcprogrammer.com — site.js
// The few browser APIs the Blazor components cannot reach on their own: document-level
// events, IntersectionObserver, matchMedia, the native <dialog>, and focus. Loaded as an
// ES module through IJSRuntime. Every watcher returns a handle with dispose(), which the
// owning component calls from DisposeAsync.

/** Tells .NET when the page scrolls past the header threshold, and only on change. */
export function watchHeader(dotnet) {
  let scrolled = null;
  const update = () => {
    const now = window.scrollY > 8;
    if (now !== scrolled) {
      scrolled = now;
      dotnet.invokeMethodAsync("SetScrolled", now);
    }
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  return { dispose: () => window.removeEventListener("scroll", update) };
}

/** Reports which section is most in view so the nav can mark it with aria-current. */
export function observeSections(dotnet, ids) {
  const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return null;

  const visible = {};
  let current = null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visible[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
      });
      let best = null;
      let bestRatio = 0;
      sections.forEach((section) => {
        const ratio = visible[section.id] || 0;
        if (ratio > bestRatio) {
          best = section.id;
          bestRatio = ratio;
        }
      });
      const next = best ?? (window.scrollY < 200 ? null : current);
      if (next !== current) {
        current = next;
        dotnet.invokeMethodAsync("SetCurrentSection", current);
      }
    },
    { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
  );
  sections.forEach((section) => observer.observe(section));
  return { dispose: () => observer.disconnect() };
}

/** While a menu is open: Escape, a click outside its root, or growing past the breakpoint closes it.
 *  The mobile menu reports through CloseMenu; the edition list passes its own method name. */
export function watchMenu(dotnet, root, method = "CloseMenu") {
  const onKey = (event) => {
    if (event.key === "Escape") dotnet.invokeMethodAsync(method, true);
  };
  const onClick = (event) => {
    if (!root.contains(event.target)) dotnet.invokeMethodAsync(method, false);
  };
  const query = window.matchMedia("(min-width: 52em)");
  const onChange = (event) => {
    if (event.matches) dotnet.invokeMethodAsync(method, false);
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("click", onClick);
  query.addEventListener("change", onChange);
  return {
    dispose: () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
      query.removeEventListener("change", onChange);
    },
  };
}

export function focus(element) {
  element?.focus();
}

/** Flips between light and dark from whatever is showing now (a saved choice, else the OS) and saves
    the choice for theme.js to apply on the next visit. The stylesheet picks the toggle's icon. */
export function toggleTheme() {
  const root = document.documentElement;
  const saved = root.getAttribute("data-theme");
  const osDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = saved === "light" || saved === "dark" ? saved : osDark ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    window.localStorage.setItem("theme", next);
  } catch {
    /* Storage blocked: the choice lasts for this page only. */
  }
}

/** Opens a <dialog> modally. A click on the backdrop closes it; .NET hears about any close. */
export function showModal(dialog, dotnet) {
  const onClick = (event) => {
    if (event.target === dialog) dialog.close();
  };
  dialog.addEventListener("click", onClick);
  dialog.addEventListener(
    "close",
    () => {
      dialog.removeEventListener("click", onClick);
      dotnet.invokeMethodAsync("OnClosed");
    },
    { once: true }
  );
  dialog.showModal();
}

export function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

/** The engagement beacon, mirrored from main.js: small GET /ping requests the CloudFront edge answers
 *  with 204. "load" once with the viewport class and color scheme, "view" once per section that reaches
 *  the middle of the viewport, "click" when an edition or profile link is followed, and "leave" with the
 *  seconds visible each time the tab is hidden. No cookies and no identifiers. Returns a handle with
 *  dispose(), or null, with nothing to dispose, when the page runs locally. */
export function watchEngagement() {
  const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
  if (!window.fetch || LOCAL_HOSTS.includes(location.hostname)) return null;

  const ping = (query) => {
    fetch(`/ping?${query}`, { keepalive: true, credentials: "omit", cache: "no-store" }).catch(() => {});
  };

  // Phones below 768 px, tablets below 1024 px, desktops from there: the same bands the stylesheet uses.
  const viewportClass = window.innerWidth < 768 ? "phone" : window.innerWidth < 1024 ? "tablet" : "desktop";
  const colorScheme =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  ping(`e=load&v=${viewportClass}&c=${colorScheme}`);

  let observer = null;
  const sections = document.querySelectorAll("main .section[id]");
  if ("IntersectionObserver" in window && sections.length) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          ping(`e=view&s=${encodeURIComponent(entry.target.id)}`);
        });
      },
      // The middle fifth of the viewport: the section was scrolled to, not just past.
      { rootMargin: "-40% 0px -40% 0px" }
    );
    sections.forEach((section) => observer.observe(section));
  }

  // Which links count, keyed by what they point at. Only absolute links qualify, so the in-page
  // section links never match the edition's own host.
  const EDITION_HOSTS = {
    "mvcprogrammer.com": "js",
    "www.mvcprogrammer.com": "js",
    "angular.mvcprogrammer.com": "angular",
    "react.mvcprogrammer.com": "react",
    "blazor.mvcprogrammer.com": "blazor",
  };
  const classifyLink = (anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    if (!/^https?:/i.test(href)) return null;
    let url;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (EDITION_HOSTS[host] && (url.pathname === "/" || url.pathname === "")) {
      return { kind: "edition", target: EDITION_HOSTS[host] };
    }
    if (host === "github.com" || host === "www.github.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      return { kind: "github", target: parts.length > 1 ? parts[1] : "profile" };
    }
    if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return { kind: "social", target: "linkedin" };
    if (host === "flickr.com" || host.endsWith(".flickr.com")) return { kind: "social", target: "flickr" };
    return null;
  };
  const linkPlace = (anchor) => {
    if (anchor.closest(".site-header")) return "header";
    if (anchor.closest("footer")) return "footer";
    const section = anchor.closest("main .section[id]");
    return section ? section.id : "page";
  };
  const onClick = (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const link = classifyLink(anchor);
    if (!link) return;
    ping(`e=click&k=${link.kind}&t=${encodeURIComponent(link.target)}&f=${encodeURIComponent(linkPlace(anchor))}`);
  };
  document.addEventListener("click", onClick);

  let visibleSince = document.visibilityState === "hidden" ? null : Date.now();
  let visibleMs = 0;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      if (visibleSince !== null) {
        visibleMs += Date.now() - visibleSince;
        visibleSince = null;
      }
      ping(`e=leave&t=${Math.round(visibleMs / 1000)}`);
    } else if (visibleSince === null) {
      visibleSince = Date.now();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return {
    dispose: () => {
      observer?.disconnect();
      document.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
