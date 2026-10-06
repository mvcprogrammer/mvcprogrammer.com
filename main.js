/* mvcprogrammer.com — main.js
   Small, dependency-free enhancements. Everything degrades gracefully
   if this file fails to load: the page is fully usable without it. */

(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));

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
    var mq = window.matchMedia("(min-width: 48em)");
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
     Links with data-topic (the Freelance call to action) set the form's
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
        message: form.elements.message.value,
        website: form.elements.website.value,
        elapsed: Date.now() - opened
      };
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
          form.classList.add("is-sent");
          setStatus("Thanks, your message is on its way. I will reply by email.", "ok");
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
