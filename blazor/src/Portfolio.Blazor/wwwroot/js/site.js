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

/**
 * The engagement beacon, mirroring main.js: GET /ping?e=view&s=<id> once per section that reaches
 * the middle of the viewport, and GET /ping?e=leave&t=<seconds visible> each time the tab is hidden.
 * CloudFront answers 204 at the edge and the access logs feed tools/cf-stats.mjs. Returns null, so
 * nothing to dispose, when the browser asks not to be tracked or the page runs locally.
 */
export function watchEngagement() {
  const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
  const optedOut = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  if (!window.fetch || optedOut || LOCAL_HOSTS.includes(location.hostname)) return null;

  const ping = (query) => {
    fetch(`/ping?${query}`, { keepalive: true, credentials: "omit", cache: "no-store" }).catch(() => {});
  };

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
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
