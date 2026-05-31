export function Footer() {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-text-secondary font-sans">
      <p>
        © 2026 KreskaDev. Built with Next.js.{' '}
        <a
          href="https://github.com/KreskaDev/KreskaDev.github.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:text-accent-hover"
        >
          Source on GitHub
        </a>
        .
      </p>
    </footer>
  )
}
