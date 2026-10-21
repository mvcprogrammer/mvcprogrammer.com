/* mvcprogrammer.com — fhir.js
   The FHIR R4 patient explorer at /fhir. Talks only to this site's own /api/fhir
   function (see api/openapi.yaml), which talks to the sandbox. Dependency-free,
   no inline script or style, and everything degrades to the static page if it fails. */

(function () {
  "use strict";

  var form = document.getElementById("fhir-search");
  var log = document.getElementById("fhir-log");
  if (!form || !log || !window.fetch) return;

  var API = "/api/fhir";
  var PAGE_CAP = 5;
  /* The prefilled example and the names tried in turn when it returns nothing (the sandbox is wiped now
     and then). Synthea-style families such as Watsica258 carry conditions, encounters, and vital signs;
     the plain surnames at the end match something on almost any FHIR server, if only a thin record. */
  var FALLBACK_FAMILIES = ["Programmer", "Grant", "Meridius", "Deshmukh", "Smith", "Johnson", "Williams"];
  var AVATAR_HUES = 8;

  var familyInput = form.elements.family;
  var birthdateInput = form.elements.birthdate;
  var identifierInput = form.elements.identifier;
  var submit = document.getElementById("fhir-submit");
  var status = document.getElementById("fhir-status");
  var sourceLabel = document.querySelector("[data-fhir-source]");

  var list = document.getElementById("fhir-patients");
  var listEmpty = document.getElementById("fhir-list-empty");
  var count = document.getElementById("fhir-count");
  var summary = document.getElementById("fhir-summary");
  var summaryEmpty = document.getElementById("fhir-summary-empty");
  var card = document.getElementById("fhir-card");
  var avatar = document.getElementById("fhir-avatar");
  var cardName = document.getElementById("fhir-card-name");
  var cardMeta = document.getElementById("fhir-card-meta");
  var tiles = {
    conditions: document.getElementById("fhir-tile-conditions"),
    encounters: document.getElementById("fhir-tile-encounters"),
    observations: document.getElementById("fhir-tile-observations")
  };
  var conditionsList = document.getElementById("fhir-conditions");
  var resolvedList = document.getElementById("fhir-resolved");
  var vitalsTable = document.getElementById("fhir-vitals");
  var vitalsBody = vitalsTable ? vitalsTable.querySelector("tbody") : null;
  var vitalsEmpty = document.getElementById("fhir-vitals-empty");

  var dtoDetails = document.getElementById("fhir-dto-details");
  var dto = document.getElementById("fhir-dto");
  var rawToggle = document.getElementById("fhir-raw-toggle");
  var raw = document.getElementById("fhir-raw");

  var selectedId = null;
  var rawLoadedFor = null;
  var lines = [];

  /* ---------- Small helpers ---------- */
  var el = function (tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  var setStatus = function (text, kind) {
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("is-ok", kind === "ok");
    status.classList.toggle("is-error", kind === "error");
  };

  var setError = function (input, message) {
    var out = input.parentNode.querySelector(".field-error");
    if (out) out.textContent = message || "";
    input.classList.toggle("is-invalid", Boolean(message));
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  };

  var pad = function (n) {
    return (n < 10 ? "0" : "") + n;
  };

  /* "2025-11-03T09:14:00Z" -> { date: "2025-11-03", time: "09:14" } in local time; a bare date or year has no time. */
  var dateParts = function (iso) {
    if (!iso) return { date: "", time: "" };
    if (iso.length <= 10) return { date: iso, time: "" };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { date: iso.slice(0, 10), time: "" };
    return {
      date: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
      time: pad(d.getHours()) + ":" + pad(d.getMinutes())
    };
  };

  var number = function (value) {
    return typeof value === "number" ? String(Math.round(value * 100) / 100) : "";
  };

  /* A stable colour per patient id, so the same patient keeps its avatar between searches. */
  var hueOf = function (id) {
    var hash = 0;
    for (var i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return hash % AVATAR_HUES;
  };

  /* ---------- The log ---------- */
  var write = function (text, kind) {
    lines.push({ text: text, kind: kind || "" });
    if (lines.length > 60) lines.shift();
    log.textContent = "";
    lines.forEach(function (line) {
      var span = el("span", line.kind ? "fhir-log-" + line.kind : null, line.text);
      log.appendChild(span);
      log.appendChild(document.createTextNode("\n"));
    });
    log.scrollTop = log.scrollHeight;
  };

  var describeCache = function (res) {
    var xCache = res.headers.get("x-cache");
    if (!xCache) return "X-Cache: n/a (no CloudFront in front of this origin)";
    return "X-Cache: " + xCache;
  };

  var isHit = function (res) {
    var xCache = res.headers.get("x-cache") || "";
    return /^hit/i.test(xCache);
  };

  var writeTrace = function (trace, res) {
    if (!trace) return;
    var hit = isHit(res);
    if (hit) {
      write("  served from the CloudFront cache; the upstream numbers below are from the original request at " + trace.generatedAt, "note");
    }
    (trace.requests || []).forEach(function (r) {
      write("  ↳ " + r.method + " " + r.url, "upstream");
      write("    " + r.status + " · " + r.durationMs + " ms · " + r.entries + (r.entries === 1 ? " entry" : " entries") + " · " + r.pages + (r.pages === 1 ? " page" : " pages"), "detail");
    });
    write("  " + (trace.requests || []).length + " upstream " + ((trace.requests || []).length === 1 ? "request" : "requests") + " in " + trace.totalDurationMs + " ms wall time · " + trace.bundleEntries + " bundle " + (trace.bundleEntries === 1 ? "entry" : "entries") + " · " + trace.pagesWalked + (trace.pagesWalked === 1 ? " page" : " pages") + " walked (cap " + (trace.pageCap || PAGE_CAP) + " per search)" + (trace.truncated ? " · truncated" : ""), "detail");
  };

  var showDto = function (name, value) {
    if (!dto) return;
    dto.textContent = JSON.stringify(value, null, 2);
    var label = dtoDetails ? dtoDetails.querySelector("summary") : null;
    if (label) label.textContent = "The " + name + " the function returned";
  };

  /* ---------- Fetching ---------- */
  var problemMessage = function (problem, statusCode) {
    if (problem && problem.detail) return problem.detail;
    if (statusCode === 429) return "That is a lot of requests in a row; wait a moment and try again.";
    if (statusCode === 502 || statusCode === 504) return "The sandbox is slow or down right now. Try again in a moment.";
    return "The request failed (" + statusCode + ").";
  };

  /* GET from the function. Resolves with { body, res, ms }; rejects with an Error carrying status and message. */
  var getJson = function (path) {
    var started = performance.now();
    write("→ GET " + API + path, "request");
    return fetch(API + path, { headers: { Accept: "application/json, application/problem+json" } }).then(function (res) {
      var ms = Math.round(performance.now() - started);
      return res.json().then(
        function (body) {
          if (!res.ok) {
            write("← " + res.status + " " + path.split("?")[0] + (body && body.title ? ": " + body.title : "") + " in " + ms + " ms · " + describeCache(res), "error");
            var error = new Error(problemMessage(body, res.status));
            error.status = res.status;
            throw error;
          }
          write("← " + res.status + " " + path.split("?")[0] + " in " + ms + " ms · " + describeCache(res) + " · ETag " + (res.headers.get("etag") || "none"), "response");
          return { body: body, res: res, ms: ms };
        },
        function () {
          write("← " + res.status + " with an unreadable body in " + ms + " ms", "error");
          var error = new Error(res.ok ? "The function answered with something that is not JSON." : problemMessage(null, res.status));
          error.status = res.status;
          throw error;
        }
      );
    }, function () {
      write("← network error", "error");
      throw new Error("Could not reach the API. Check the connection and try again.");
    });
  };

  /* ---------- Rendering: the list ---------- */
  var renderList = function (result) {
    list.textContent = "";
    var n = result.items.length;
    count.textContent = n === 0 ? "(0)" : "(" + n + (result.total != null && result.total > n ? " of " + result.total : "") + ")";
    listEmpty.hidden = n > 0;
    if (n === 0) {
      listEmpty.textContent = "No patients match. Try another family name; the sandbox is wiped now and then.";
    }
    result.items.forEach(function (p) {
      var item = el("li");
      var button = el("button", "fhir-patient");
      button.type = "button";
      button.setAttribute("data-id", p.id);
      button.setAttribute("aria-pressed", "false");
      var mark = el("span", "fhir-avatar fhir-avatar-sm fhir-avatar-" + hueOf(p.id), initialsOf(p));
      mark.setAttribute("aria-hidden", "true");
      button.appendChild(mark);
      var text = el("span", "fhir-patient-text");
      text.appendChild(el("span", "fhir-patient-name", p.name));
      text.appendChild(el("span", "fhir-patient-sub", [p.birthYear ? "born " + p.birthYear : "birth year unknown", p.sex || null, "Patient/" + p.id].filter(Boolean).join(" · ")));
      button.appendChild(text);
      button.addEventListener("click", function () {
        selectPatient(p.id);
      });
      item.appendChild(button);
      list.appendChild(item);
    });
  };

  var initialsOf = function (p) {
    var given = p.givenName ? p.givenName.charAt(0) : "";
    var family = p.familyName && p.familyName !== "Unknown" ? p.familyName.charAt(0) : "";
    var initials = (given + family).toUpperCase();
    return initials || "?";
  };

  var markSelected = function (id) {
    Array.prototype.forEach.call(list.querySelectorAll(".fhir-patient"), function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-id") === id ? "true" : "false");
    });
  };

  /* ---------- Rendering: the summary ---------- */
  var pill = function (c) {
    var item = el("li", "fhir-pill");
    item.appendChild(el("span", "fhir-pill-text", c.display));
    if (c.code) {
      item.appendChild(el("code", "fhir-pill-code", (c.systemLabel && c.systemLabel !== "other" ? c.systemLabel + " " : "") + c.code));
    }
    if (c.onsetDate) item.title = "Onset " + c.onsetDate + " · " + c.clinicalStatus;
    return item;
  };

  var renderSummary = function (s) {
    var p = s.patient;
    avatar.className = "fhir-avatar fhir-avatar-" + hueOf(p.id);
    avatar.textContent = p.initials;
    cardName.textContent = p.name;
    cardMeta.textContent = "";
    [p.sex || "sex unknown", p.age != null ? p.age + " years" : (p.birthDate ? "born " + p.birthDate : "age unknown")].forEach(function (part, i) {
      if (i) cardMeta.appendChild(document.createTextNode(" · "));
      cardMeta.appendChild(document.createTextNode(part));
    });
    cardMeta.appendChild(document.createTextNode(" · "));
    cardMeta.appendChild(el("code", null, "Patient/" + p.id));
    if (p.mrn) {
      cardMeta.appendChild(document.createTextNode(" · MRN "));
      cardMeta.appendChild(el("code", null, p.mrn));
    }

    tiles.conditions.textContent = String(s.counts.conditions);
    tiles.encounters.textContent = String(s.counts.encounters);
    tiles.observations.textContent = String(s.counts.observations);

    conditionsList.textContent = "";
    resolvedList.textContent = "";
    resolvedList.hidden = true;
    if (!s.conditions.active.length && !s.conditions.resolved.length) {
      conditionsList.appendChild(el("li", "fhir-empty-inline", "None recorded."));
    }
    s.conditions.active.forEach(function (c) {
      conditionsList.appendChild(pill(c));
    });
    if (s.conditions.resolved.length) {
      var more = el("li", "fhir-pill fhir-pill-more");
      var button = el("button", "fhir-pill-button", "+" + s.conditions.resolved.length + " resolved");
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", "fhir-resolved");
      button.addEventListener("click", function () {
        var open = resolvedList.hidden;
        resolvedList.hidden = !open;
        button.setAttribute("aria-expanded", open ? "true" : "false");
        button.textContent = (open ? "hide " : "+") + s.conditions.resolved.length + " resolved";
      });
      more.appendChild(button);
      conditionsList.appendChild(more);
      s.conditions.resolved.forEach(function (c) {
        var item = pill(c);
        item.classList.add("is-resolved");
        resolvedList.appendChild(item);
      });
    }

    vitalsBody.textContent = "";
    vitalsEmpty.hidden = s.vitals.length > 0;
    vitalsTable.hidden = s.vitals.length === 0;
    s.vitals.forEach(function (v) {
      var row = el("tr");
      var when = el("td", "fhir-table-date");
      var parts = dateParts(v.date);
      var time = el("time", null, parts.date);
      time.setAttribute("datetime", v.date);
      if (parts.time) {
        time.appendChild(el("span", "fhir-table-time", parts.time));
      }
      when.appendChild(time);
      row.appendChild(when);
      var name = el("td", null, v.name);
      name.appendChild(document.createTextNode(" "));
      name.appendChild(el("code", "fhir-loinc", v.loincCode));
      row.appendChild(name);
      var value;
      if (v.components && v.components.length) {
        value = v.components.map(function (c) {
          return number(c.value);
        }).join("/") + " " + (v.components[0].unit || "");
      } else {
        value = number(v.value) + " " + (v.unit || "");
      }
      row.appendChild(el("td", "fhir-table-value", value.trim()));
      vitalsBody.appendChild(row);
    });

    summaryEmpty.hidden = true;
    card.hidden = false;
  };

  var showSummaryMessage = function (message) {
    card.hidden = true;
    summaryEmpty.hidden = false;
    summaryEmpty.textContent = message;
  };

  /* ---------- Flows ---------- */
  var selectPatient = function (id) {
    selectedId = id;
    rawLoadedFor = null;
    markSelected(id);
    summary.setAttribute("aria-busy", "true");
    summary.classList.add("is-loading");
    if (rawToggle) {
      rawToggle.disabled = true;
      rawToggle.setAttribute("aria-expanded", "false");
    }
    if (raw) raw.hidden = true;
    getJson("/patients/" + encodeURIComponent(id) + "/summary")
      .then(function (r) {
        if (selectedId !== id) return;
        writeTrace(r.body.trace, r.res);
        write("  mapped to PatientSummary: " + r.body.conditions.active.length + " active and " + r.body.conditions.resolved.length + " resolved conditions, " + r.body.vitals.length + " vital signs", "detail");
        showDto("PatientSummary", r.body);
        renderSummary(r.body);
        if (rawToggle) rawToggle.disabled = false;
      })
      .catch(function (err) {
        if (selectedId !== id) return;
        showSummaryMessage(err.message);
      })
      .then(function () {
        summary.setAttribute("aria-busy", "false");
        summary.classList.remove("is-loading");
      });
  };

  var search = function (family, birthdate, identifier, fallbackIndex) {
    var query = "?family=" + encodeURIComponent(family);
    if (birthdate) query += "&birthdate=" + encodeURIComponent(birthdate);
    if (identifier) query += "&identifier=" + encodeURIComponent(identifier);
    submit.disabled = true;
    form.classList.add("is-loading");
    setStatus("Searching…", "");
    return getJson("/patients" + query)
      .then(function (r) {
        var result = r.body;
        writeTrace(result.trace, r.res);
        write("  mapped to PatientSearchResult: " + result.count + (result.count === 1 ? " item" : " items") + (result.trace.truncated ? " (one page; more matches exist)" : ""), "detail");
        showDto("PatientSearchResult", result);
        /* The prefilled example may have been wiped from the sandbox; walk the fallback list once, without extra inputs. */
        if (result.count === 0 && !birthdate && !identifier && fallbackIndex != null && fallbackIndex < FALLBACK_FAMILIES.length) {
          var next = FALLBACK_FAMILIES[fallbackIndex];
          write("  nothing for \"" + family + "\"; the sandbox may have been wiped, trying \"" + next + "\"", "note");
          familyInput.value = next;
          return search(next, "", "", fallbackIndex + 1);
        }
        renderList(result);
        setStatus(result.count === 0 ? "No matches." : result.count + (result.count === 1 ? " patient" : " patients") + " for “" + family + "”; the first is selected.", "ok");
        if (result.items.length) {
          selectPatient(result.items[0].id);
        } else {
          showSummaryMessage("Select a patient to load the summary.");
        }
      })
      .catch(function (err) {
        renderList({ items: [], count: 0 });
        listEmpty.textContent = err.message;
        showSummaryMessage(err.status === 502 || err.status === 504 ? "The sandbox did not answer in time. The explorer will work again as soon as it does." : "Nothing to show.");
        setStatus(err.message, "error");
      })
      .then(function () {
        submit.disabled = false;
        form.classList.remove("is-loading");
      });
  };

  var validate = function () {
    var ok = true;
    var family = familyInput.value.trim();
    if (!family) {
      setError(familyInput, "A family name is required.");
      ok = false;
    } else if (family.length > 60) {
      setError(familyInput, "At most 60 characters.");
      ok = false;
    } else {
      setError(familyInput, "");
    }
    var birthdate = birthdateInput.value;
    if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
      setError(birthdateInput, "Use the YYYY-MM-DD form.");
      ok = false;
    } else {
      setError(birthdateInput, "");
    }
    return ok;
  };

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validate()) return;
    var family = familyInput.value.trim();
    var birthdate = birthdateInput.value;
    var identifier = identifierInput.value.trim();
    var usingTheExample = family === FALLBACK_FAMILIES[0] && !birthdate && !identifier;
    search(family, birthdate, identifier, usingTheExample ? 1 : null);
  });

  familyInput.addEventListener("input", function () {
    if (familyInput.classList.contains("is-invalid")) validate();
  });

  /* ---------- Raw bundle ---------- */
  if (rawToggle && raw) {
    rawToggle.addEventListener("click", function () {
      if (!selectedId) return;
      var open = raw.hidden;
      if (!open) {
        raw.hidden = true;
        rawToggle.setAttribute("aria-expanded", "false");
        return;
      }
      raw.hidden = false;
      rawToggle.setAttribute("aria-expanded", "true");
      if (rawLoadedFor === selectedId) return;
      var id = selectedId;
      raw.textContent = "loading…";
      var started = performance.now();
      write("→ GET " + API + "/patients/" + id + "/raw", "request");
      fetch(API + "/patients/" + encodeURIComponent(id) + "/raw", { headers: { Accept: "application/fhir+json, application/problem+json" } })
        .then(function (res) {
          var ms = Math.round(performance.now() - started);
          return res.text().then(function (text) {
            if (selectedId !== id) return;
            if (!res.ok) {
              write("← " + res.status + " in " + ms + " ms · " + describeCache(res), "error");
              raw.textContent = "The raw bundle could not be loaded (" + res.status + ").";
              return;
            }
            write("← " + res.status + " " + (res.headers.get("content-type") || "") + " in " + ms + " ms · " + describeCache(res) + " · " + text.length + " bytes", "response");
            raw.textContent = text;
            rawLoadedFor = id;
          });
        })
        .catch(function () {
          write("← network error", "error");
          raw.textContent = "The raw bundle could not be loaded.";
        });
    });
  }

  /* ---------- Capability, once, so the panel can say what the sandbox supports ---------- */
  getJson("/capability")
    .then(function (r) {
      var c = r.body;
      var missing = [];
      (c.resources || []).forEach(function (res) {
        if (!res.supported) missing.push(res.type);
        (res.searchParams || []).forEach(function (sp) {
          if (!sp.supported) missing.push(res.type + "?" + sp.name);
        });
      });
      write("  " + (c.software && c.software.name ? c.software.name + " " + (c.software.version || "") : "sandbox") + " · FHIR " + c.fhirVersion + " at " + c.baseUrl + " · checked " + c.checkedAt, "detail");
      write(c.ok ? "  every resource and search parameter the explorer needs is supported ✓" : "  not supported: " + missing.join(", "), c.ok ? "detail" : "error");
      if (sourceLabel && c.baseUrl) {
        sourceLabel.textContent = /hapi\.fhir\.org/.test(c.baseUrl) ? "HAPI sandbox" : (c.software && c.software.name ? c.software.name : "FHIR sandbox");
      }
    })
    .catch(function (err) {
      write("  capability check failed: " + err.message, "error");
    });
})();
