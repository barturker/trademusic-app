import type { SVGProps } from "react";

export function WeTransferLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="20"
      fill="none"
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M12.23 15.014c-.383-.605-.697-.926-1.254-.926-.558 0-.872.32-1.255.926L8.05 17.686c-.627 1.032-1.15 1.745-2.37 1.745s-1.777-.499-2.369-1.888a42.3 42.3 0 0 1-2.195-6.554C.348 7.89 0 5.967 0 4.4s.488-2.493 2.16-2.813c2.3-.428 5.401-.677 8.816-.677 3.414 0 6.515.25 8.815.677 1.672.32 2.16 1.246 2.16 2.814 0 1.567-.348 3.49-1.115 6.59a42.3 42.3 0 0 1-2.195 6.553c-.592 1.39-1.15 1.888-2.37 1.888-1.219 0-1.741-.713-2.369-1.745zm26.516 2.5c-1.185 1.282-3.415 2.208-6.342 2.208-5.888 0-9.373-4.096-9.373-9.474 0-5.77 4.007-9.19 9.199-9.19 4.634 0 7.7 2.458 7.7 5.77 0 3.135-2.613 5.165-5.575 5.165-1.602 0-2.787-.32-3.588-.961-.314-.25-.488-.214-.488.071 0 1.175.418 2.173 1.184 2.956.628.641 1.812 1.069 2.927 1.069 1.15 0 2.16-.25 3.066-.713s1.673-.32 2.126.428c.523.855-.21 1.959-.836 2.671m-4.356-7.76c1.324 0 2.335-.819 2.335-2.386 0-1.354-1.115-2.315-2.787-2.315-2.16 0-3.937 1.567-3.937 4.452 0 .107.035.178.14.178.661-.036 2.753-.036 4.25.071"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M5.172 8 8 10.828 10.83 8"
      />
    </svg>
  );
}

export function LightningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <path
        fill="currentColor"
        d="M16.628 2.573a.81.81 0 0 1 1.455.486v9.543h6.956a.81.81 0 0 1 .673 1.258L15.36 29.39a.81.81 0 0 1-1.482-.45l.011-9.543H5.628a.81.81 0 0 1-.647-1.294z"
      />
    </svg>
  );
}

export function ThreeDotsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <g fill="currentColor">
        <circle cx="8" cy="16" r="2" />
        <circle cx="16" cy="16" r="2" />
        <circle cx="24" cy="16" r="2" />
      </g>
    </svg>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <g stroke="#161616" strokeWidth="1.5">
        <path d="M24 29.4H8a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v13.4a5 5 0 0 1-5 5Z" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.15 3v5.2M21.85 3v5.2"
        />
        <path d="M3 13.4h26" />
      </g>
    </svg>
  );
}

export function AddFilesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      {...props}
    >
      <circle cx="16" cy="16" r="12" fill="#3767EA" />
      <path
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        d="M16 11v10M11 16h10"
      />
    </svg>
  );
}

export function AddFoldersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      {...props}
    >
      <path
        d="M4 10C4 8.89543 4.89543 8 6 8H13L15 11H26C27.1046 11 28 11.8954 28 13V24C28 25.1046 27.1046 26 26 26H6C4.89543 26 4 25.1046 4 24V10Z"
        fill="#93B4FF"
      />
      <circle cx="24" cy="10" r="6" fill="#3767EA" />
      <path
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M24 7.5v5M21.5 10h5"
      />
    </svg>
  );
}

export function HamburgerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  );
}

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
        d="M10.83 10 8 7.172 5.172 10"
      />
    </svg>
  );
}
