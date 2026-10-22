/* mvcprogrammer.com: theme.js
   Applies the visitor's saved light or dark choice before the first paint. Loaded as a plain,
   blocking script in the head of every page and every edition (the Content Security Policy allows
   no inline script). With no saved choice the page follows the OS through prefers-color-scheme;
   the toggle beside the edition menu writes the choice. styles.css maps data-theme to color-scheme,
   and light-dark() does the rest. */
(function () {
  try {
    var saved = window.localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  } catch (error) {
    /* Storage blocked: follow the OS. */
  }
})();
