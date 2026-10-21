/* mvcprogrammer.com — main.js
   Small, dependency-free enhancements. Everything degrades gracefully
   if this file fails to load: the page is fully usable without it. */

(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));

  /* ---------- Edition menu ---------- */
  var edition = document.querySelector(".edition");
  var editionToggle = edition ? edition.querySelector(".edition-toggle") : null;

  function setEditions(open) {
    if (!edition || !editionToggle) return;
    edition.classList.toggle("is-open", open);
    editionToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function isEditionsOpen() {
    return !!(edition && edition.classList.contains("is-open"));
  }

  if (edition && editionToggle) {
    editionToggle.addEventListener("click", function () {
      setEditions(!isEditionsOpen());
    });

    // Escape closes the list and returns focus to the button.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isEditionsOpen()) {
        setEditions(false);
        editionToggle.focus();
      }
    });

    // Clicking anywhere outside the list closes it.
    document.addEventListener("click", function (event) {
      if (isEditionsOpen() && !edition.contains(event.target)) {
        setEditions(false);
      }
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.getElementById("year");
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  /* ---------- Mobile navigation ---------- */
  function setMenu(open) {
    if (!toggle || !nav) return;
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  function isMenuOpen() {
    return !!(nav && nav.classList.contains("is-open"));
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(!isMenuOpen());
    });

    // Close after choosing a section so the page is visible when it scrolls.
    nav.addEventListener("click", function (event) {
      var link = event.target.closest("a");
      if (link && isMenuOpen()) {
        setMenu(false);
      }
    });

    // Escape closes the menu and returns focus to the button.
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isMenuOpen()) {
        setMenu(false);
        toggle.focus();
      }
    });

    // Clicking outside the header closes the menu.
    document.addEventListener("click", function (event) {
      if (isMenuOpen() && header && !header.contains(event.target)) {
        setMenu(false);
      }
    });

    // If the viewport grows past the mobile breakpoint, reset the menu state.
    var mq = window.matchMedia("(min-width: 52em)");
    var onChange = function (e) {
      if (e.matches) setMenu(false);
    };
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(onChange);
    }
  }

  /* ---------- Header border on scroll ---------- */
  if (header) {
    var updateHeader = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  /* ---------- Highlight the nav link for the section in view ---------- */
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href");
      return id && id.charAt(0) === "#" ? document.querySelector(id) : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && sections.length) {
    var current = null;

    var setCurrent = function (id) {
      if (id === current) return;
      current = id;
      navLinks.forEach(function (link) {
        if (link.getAttribute("href") === "#" + id) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    var visible = {};
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
        });
        var best = null;
        var bestRatio = 0;
        sections.forEach(function (section) {
          var ratio = visible[section.id] || 0;
          if (ratio > bestRatio) {
            best = section.id;
            bestRatio = ratio;
          }
        });
        if (best) {
          setCurrent(best);
        } else if (window.scrollY < 200) {
          setCurrent(null);
        }
      },
      {
        rootMargin: "-40% 0px -50% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
      }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ---------- Preselect a contact topic ----------
     Links with data-topic (the Employers and Freelance calls to action) set the form's
     topic before the page scrolls to it. */
  var topicLinks = document.querySelectorAll("a[data-topic]");
  var topicSelect = document.querySelector('#contact-form select[name="topic"]');
  if (topicSelect && topicLinks.length) {
    Array.prototype.forEach.call(topicLinks, function (link) {
      link.addEventListener("click", function () {
        topicSelect.value = link.getAttribute("data-topic");
      });
    });
  }

  /* ---------- Contact form ----------
     Posts JSON to the Lambda function URL in data-endpoint. The "website"
     field is a honeypot and "elapsed" is how long the form was open; the
     Lambda silently drops submissions that trip either one. */
  var form = document.getElementById("contact-form");
  if (form && window.fetch) {
    var status = form.querySelector(".form-status");
    var submit = form.querySelector('button[type="submit"]');
    var opened = Date.now();

    var setStatus = function (text, kind) {
      if (!status) return;
      status.textContent = text;
      status.classList.toggle("is-ok", kind === "ok");
      status.classList.toggle("is-error", kind === "error");
    };

    /* The phone field only shows, and is only required, when a call is requested. */
    var replySelect = form.elements.reply;
    var phoneInput = form.elements.phone;
    var phoneField = form.querySelector("[data-reply-phone]");
    var wantsCall = function () {
      return Boolean(replySelect) && replySelect.value === "Phone call";
    };
    var syncPhone = function () {
      if (!phoneInput || !phoneField) return;
      var on = wantsCall();
      phoneField.hidden = !on;
      phoneInput.disabled = !on;
      phoneInput.required = on;
    };
    if (replySelect) replySelect.addEventListener("change", syncPhone);
    syncPhone();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var endpoint = form.getAttribute("data-endpoint");
      if (!endpoint) {
        setStatus("The form is not connected yet. Please reach me on LinkedIn instead.", "error");
        return;
      }
      var payload = {
        name: form.elements.name.value,
        email: form.elements.email.value,
        topic: form.elements.topic.value,
        reply: replySelect ? replySelect.value : "Email",
        phone: wantsCall() && phoneInput ? phoneInput.value : "",
        message: form.elements.message.value,
        website: form.elements.website.value,
        elapsed: Date.now() - opened
      };
      var byPhone = Boolean(payload.phone);
      submit.disabled = true;
      setStatus("Sending\u2026", "");
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error(String(res.status));
          form.reset();
          syncPhone();
          form.classList.add("is-sent");
          setStatus(
            byPhone
              ? "Thanks, your message is on its way. I will call you at the number you gave."
              : "Thanks, your message is on its way. I will reply by email.",
            "ok"
          );
        })
        .catch(function (err) {
          var tooMany = err && err.message === "429";
          setStatus(
            tooMany
              ? "That is a few messages in a row. Please try again in an hour."
              : "Something went wrong sending that. Please try again in a moment, or reach me on LinkedIn.",
            "error"
          );
        })
        .then(function () {
          submit.disabled = false;
        });
    });
  }

  /* ---------- Experience from the API ----------
     The timeline is in the HTML, so it reads without this script. When the
     Experience API (/api, see api/openapi.yaml) answers, the list is re-rendered
     from the JSON and a skill filter appears. Any failure leaves the HTML as it was. */
  var timeline = document.getElementById("experience-timeline");
  var skillFilter = document.getElementById("skill-filter");
  if (timeline && skillFilter && window.fetch) {
    var apiBase = timeline.getAttribute("data-api") || "/api";
    var chipList = skillFilter.querySelector(".skill-filter-list");
    var countOut = skillFilter.querySelector(".skill-filter-count");
    var jsonLink = skillFilter.querySelector(".skill-filter-link");
    var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var VISIBLE_CHIPS = 12;
    /* Chips named here lead the row in this order, regardless of position
       count; chips in DEMOTED_SKILLS go to the end of the row. */
    var PINNED_SKILLS = ["ASP.NET Web API", "C#", "Claude Pair Programming", "Angular", "React"];
    var DEMOTED_SKILLS = ["CloudWatch"];
    var allPositions = [];
    var chips = [];

    var getJson = function (path) {
      return fetch(apiBase + path, { headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      });
    };

    var el = function (tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };

    /* "2023-12" -> "Dec 2023" */
    var monthLabel = function (ym) {
      var parts = String(ym).split("-");
      var m = parseInt(parts[1], 10);
      return (MONTHS[m - 1] || parts[1]) + " " + parts[0];
    };

    var timeEl = function (ym) {
      var t = el("time", null, monthLabel(ym));
      t.setAttribute("datetime", ym);
      return t;
    };

    /* Matches the hand-written markup: "Remote", "Hybrid", or the place for on-site roles. */
    var placeLabel = function (p) {
      if (p.workMode === "remote") return "Remote";
      if (p.workMode === "hybrid") return "Hybrid";
      return p.location || "On-site";
    };

    var renderPosition = function (p) {
      var item = el("li", "timeline-item");
      var date = el("p", "timeline-date");
      date.appendChild(timeEl(p.startDate));
      date.appendChild(document.createTextNode(" \u2013 "));
      if (p.endDate) {
        date.appendChild(timeEl(p.endDate));
      } else {
        date.appendChild(document.createTextNode("Present"));
      }
      date.appendChild(document.createTextNode(" \u00b7 " + placeLabel(p)));
      item.appendChild(date);
      item.appendChild(el("h3", null, p.title));
      item.appendChild(el("p", "timeline-org", p.organization));
      var points = el("ul", "timeline-points");
      (p.highlights || []).forEach(function (h) {
        points.appendChild(el("li", null, h));
      });
      item.appendChild(points);
      return item;
    };

    var renderList = function (list, skill) {
      var frag = document.createDocumentFragment();
      list.items.forEach(function (p) {
        frag.appendChild(renderPosition(p));
      });
      timeline.textContent = "";
      timeline.appendChild(frag);
      var n = list.items.length;
      countOut.textContent =
        n + (n === 1 ? " position" : " positions") + (skill ? " with " + skill : "");
      jsonLink.href = apiBase + "/experience" + (skill ? "?skill=" + encodeURIComponent(skill) : "");
      jsonLink.textContent = "/api/experience" + (skill ? "?skill=" + encodeURIComponent(skill) : "");
    };

    var setPressed = function (active) {
      chips.forEach(function (chip) {
        chip.setAttribute("aria-pressed", chip.getAttribute("data-skill") === (active || "") ? "true" : "false");
      });
    };

    var select = function (skill) {
      timeline.classList.add("is-loading");
      var request = skill ? getJson("/experience?skill=" + encodeURIComponent(skill)) : Promise.resolve(allPositions);
      request
        .then(function (list) {
          renderList(list, skill);
          setPressed(skill);
        })
        .catch(function () {
          renderList(allPositions, null);
          setPressed(null);
        })
        .then(function () {
          timeline.classList.remove("is-loading");
        });
    };

    var addChip = function (skill, label, hidden) {
      var chip = el("button", "skill-chip", label);
      chip.type = "button";
      chip.setAttribute("data-skill", skill);
      chip.setAttribute("aria-pressed", skill ? "false" : "true");
      if (hidden) chip.hidden = true;
      chip.addEventListener("click", function () {
        select(skill);
      });
      chipList.appendChild(chip);
      chips.push(chip);
      return chip;
    };

    var buildChips = function (skills) {
      var byName = function (name) {
        return skills.items.filter(function (s) {
          return s.name === name;
        });
      };
      var rest = skills.items.filter(function (s) {
        return PINNED_SKILLS.indexOf(s.name) === -1 && DEMOTED_SKILLS.indexOf(s.name) === -1;
      });
      var items = [].concat.apply([], PINNED_SKILLS.map(byName))
        .concat(rest)
        .concat([].concat.apply([], DEMOTED_SKILLS.map(byName)));
      addChip("", "All");
      items.forEach(function (s, i) {
        var chip = addChip(s.name, s.name, i >= VISIBLE_CHIPS);
        chip.title = s.positionCount + (s.positionCount === 1 ? " position" : " positions");
      });
      var extra = items.length - VISIBLE_CHIPS;
      if (extra > 0) {
        var more = el("button", "skill-chip skill-chip-more", "+" + extra + " more");
        more.type = "button";
        more.setAttribute("aria-expanded", "false");
        more.addEventListener("click", function () {
          chips.forEach(function (chip) {
            chip.hidden = false;
          });
          more.remove();
        });
        chipList.appendChild(more);
      }
    };

    getJson("/experience")
      .then(function (list) {
        if (!list || !list.items || !list.items.length) throw new Error("empty");
        allPositions = list;
        renderList(list, null);
        return getJson("/skills");
      })
      .then(function (skills) {
        if (skills && skills.items && skills.items.length) {
          buildChips(skills);
          skillFilter.hidden = false;
        }
      })
      .catch(function () {
        /* The hand-written timeline stays. */
      });
  }

  /* ---------- Engagement beacon ----------
     Small GET /ping requests, answered at the CloudFront edge with 204 and read back
     from the access logs by tools/cf-stats.mjs: "load" once, with the viewport class
     and color scheme; "view" when a section reaches the middle of the viewport (once
     per section); "click" when a link to another edition of this site or to the GitHub,
     LinkedIn, or Flickr profile is followed, with which link and which part of the page
     it sat in; and "leave" with the seconds the page has been visible, each time the
     tab is hidden. No cookies and no identifiers; skipped when the page runs locally. */
  var LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
  if (window.fetch && LOCAL_HOSTS.indexOf(location.hostname) === -1) {
    var ping = function (query) {
      fetch("/ping?" + query, { keepalive: true, credentials: "omit", cache: "no-store" }).catch(function () {});
    };

    // Phones below 768 px, tablets below 1024 px, desktops from there: the same bands the stylesheet uses.
    var viewportClass = window.innerWidth < 768 ? "phone" : window.innerWidth < 1024 ? "tablet" : "desktop";
    var colorScheme =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    ping("e=load&v=" + viewportClass + "&c=" + colorScheme);

    var pageSections = document.querySelectorAll("main .section[id]");
    if ("IntersectionObserver" in window && pageSections.length) {
      var viewObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            viewObserver.unobserve(entry.target);
            ping("e=view&s=" + encodeURIComponent(entry.target.id));
          });
        },
        // The middle fifth of the viewport: the section was scrolled to, not just past.
        { rootMargin: "-40% 0px -40% 0px" }
      );
      Array.prototype.forEach.call(pageSections, function (section) {
        viewObserver.observe(section);
      });
    }

    // Which links count, keyed by what they point at. Only absolute links qualify, so the
    // in-page section links never match the edition's own host.
    var EDITION_HOSTS = {
      "mvcprogrammer.com": "js",
      "www.mvcprogrammer.com": "js",
      "angular.mvcprogrammer.com": "angular",
      "react.mvcprogrammer.com": "react",
      "blazor.mvcprogrammer.com": "blazor"
    };
    var classifyLink = function (anchor) {
      var href = anchor.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) return null;
      var url;
      try {
        url = new URL(href);
      } catch (error) {
        return null;
      }
      var host = url.hostname.toLowerCase();
      if (EDITION_HOSTS[host] && (url.pathname === "/" || url.pathname === "")) {
        return { kind: "edition", target: EDITION_HOSTS[host] };
      }
      if (host === "github.com" || host === "www.github.com") {
        var parts = url.pathname.split("/").filter(Boolean);
        return { kind: "github", target: parts.length > 1 ? parts[1] : "profile" };
      }
      if (host === "linkedin.com" || host.slice(-13) === ".linkedin.com") return { kind: "social", target: "linkedin" };
      if (host === "flickr.com" || host.slice(-11) === ".flickr.com") return { kind: "social", target: "flickr" };
      return null;
    };
    var linkPlace = function (anchor) {
      if (anchor.closest(".site-header")) return "header";
      if (anchor.closest("footer")) return "footer";
      var section = anchor.closest("main .section[id]");
      return section ? section.id : "page";
    };
    document.addEventListener("click", function (event) {
      var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      var link = classifyLink(anchor);
      if (!link) return;
      ping("e=click&k=" + link.kind + "&t=" + encodeURIComponent(link.target) + "&f=" + encodeURIComponent(linkPlace(anchor)));
    });

    var visibleSince = document.visibilityState === "hidden" ? null : Date.now();
    var visibleMs = 0;
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) {
          visibleMs += Date.now() - visibleSince;
          visibleSince = null;
        }
        ping("e=leave&t=" + Math.round(visibleMs / 1000));
      } else if (visibleSince === null) {
        visibleSince = Date.now();
      }
    });
  }

  /* ---------- Live kiosk demo ----------
     The dialog is in the HTML; the iframe is not. It is created when the demo opens
     and removed when it closes, so the kiosk and its Lambda only load on request. */
  var kioskDialog = document.getElementById("kiosk-dialog");
  var kioskButtons = document.querySelectorAll("[data-kiosk-demo]");
  if (kioskDialog && kioskButtons.length && typeof kioskDialog.showModal === "function") {
    var kioskSlot = kioskDialog.querySelector(".kiosk-frame-slot");
    var kioskClose = kioskDialog.querySelector("[data-kiosk-close]");

    var openKiosk = function () {
      var frame = document.createElement("iframe");
      frame.className = "kiosk-frame";
      frame.src = kioskDialog.getAttribute("data-src");
      frame.title = "Interactive Property Search Window Display, live";
      frame.setAttribute("loading", "eager");
      kioskSlot.textContent = "";
      kioskSlot.appendChild(frame);
      kioskDialog.showModal();
    };

    Array.prototype.forEach.call(kioskButtons, function (button) {
      button.addEventListener("click", openKiosk);
    });

    if (kioskClose) {
      kioskClose.addEventListener("click", function () {
        kioskDialog.close();
      });
    }

    // A click on the backdrop lands on the dialog element itself, not its children.
    kioskDialog.addEventListener("click", function (event) {
      if (event.target === kioskDialog) kioskDialog.close();
    });

    kioskDialog.addEventListener("close", function () {
      kioskSlot.textContent = "";
    });
  }

  /* ---------- FHIR API card ----------
     The explorer's markup is in the card; its script is not. fhir.js is appended the first
     time the accordion opens, so the home page makes no FHIR request until a visitor asks.
     "#fhir-api" in the URL opens the accordion, for the Healthcare chip and old /fhir links. */
  var fhirCard = document.getElementById("fhir-api");
  var fhirAccordion = fhirCard ? fhirCard.querySelector("[data-fhir-accordion]") : null;
  if (fhirAccordion) {
    var fhirLoaded = false;

    var loadFhir = function () {
      if (fhirLoaded) return;
      fhirLoaded = true;
      var script = document.createElement("script");
      script.src = "fhir.js";
      document.body.appendChild(script);
    };

    fhirAccordion.addEventListener("toggle", function () {
      if (fhirAccordion.open) loadFhir();
    });

    // The browser scrolls to the card on its own; this only opens it.
    var openFhirFromHash = function () {
      if (location.hash === "#fhir-api") fhirAccordion.open = true;
    };
    openFhirFromHash();
    window.addEventListener("hashchange", openFhirFromHash);
  }

  /* ---------- Portfolio image fallback ----------
     Until the real images are added, show a labeled slot instead of a
     broken-image icon. Remove this block once all images are in place. */
  var media = document.querySelectorAll(".card-media img");
  Array.prototype.forEach.call(media, function (img) {
    var markMissing = function () {
      var wrapper = img.closest(".card-media");
      if (!wrapper) return;
      var file = (img.getAttribute("src") || "").split("/").pop();
      wrapper.setAttribute("data-label", "image pending: " + file);
      wrapper.classList.add("is-missing");
    };
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) {
      markMissing();
    } else {
      img.addEventListener("error", markMissing, { once: true });
    }
  });
})();
