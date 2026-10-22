/** The inline SVG sprite every icon on the page references. Rendered once in the layout; <Icon name="..."> references a symbol. */
export function IconSprite() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="sr-only"
      aria-hidden="true"
      focusable="false"
    >
      <symbol id="icon-github" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"
        />
      </symbol>
      <symbol id="icon-linkedin" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
        />
      </symbol>
      <symbol id="icon-flickr" viewBox="0 0 24 24">
        <circle fill="currentColor" cx="7" cy="12" r="4.5" />
        <circle fill="currentColor" cx="17" cy="12" r="4.5" />
      </symbol>
      <symbol id="icon-design" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 20h4l10.5-10.5a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4M3 21l3-1"
        />
      </symbol>
      <symbol id="icon-code" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"
        />
      </symbol>
      <symbol id="icon-deploy" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 8.5 4.5 4.5 0 0 1 17.5 18H7zM12 12v6M9.5 14.5L12 12l2.5 2.5"
        />
      </symbol>
      <symbol id="icon-monitor" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12h4l3-7 4 14 3-7h4"
        />
      </symbol>
      <symbol id="icon-test" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 3h6M10 3v6l-5.2 9A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3L14 9V3M7.5 15h9"
        />
      </symbol>
      <symbol id="icon-data" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"
        />
      </symbol>
      <symbol id="icon-mail" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3.5 7.5L12 13l8.5-5.5"
        />
      </symbol>
      <symbol id="icon-download" viewBox="0 0 24 24">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 19h16"
        />
      </symbol>
    </svg>
  );
}
