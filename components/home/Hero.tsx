function HeroSvg() {
  return (
    <svg
      viewBox="0 0 1200 600"
      role="img"
      aria-label="What is the truth — concentric probability rings"
      className="w-full h-auto"
    >
      {/* Outer ring — thin, low opacity, "uncertainty boundary" */}
      <circle cx="600" cy="300" r="260" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.25" />
      {/* Mid ring — medium, "credible interval" */}
      <circle cx="600" cy="300" r="180" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.55" />
      {/* Inner ring — bold, "point estimate" */}
      <circle cx="600" cy="300" r="80" stroke="currentColor" strokeWidth="2.5" fill="none" />
      {/* Anchor dot — center, "the truth (?)" */}
      <circle cx="600" cy="300" r="6" fill="currentColor" />
      {/* Horizontal baseline — "fact axis", extends beyond rings */}
      <line x1="200" y1="300" x2="1000" y2="300" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  )
}

export function Hero() {
  return (
    <section className="container mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-20 md:py-24 text-center">
      {/* text-burgundy alone — CSS var w globals.css flipuje auto (#8B2635 light → #D97785 dark)
          przez `.dark` override. NIE używamy `dark:text-burgundy-soft` bo `--color-burgundy-soft`
          w dark mode = #2F1518 (dark wine → niewidoczne na dark bg). */}
      <div className="mx-auto mb-10 w-full max-w-md text-burgundy">
        <HeroSvg />
      </div>
      <h1 className="font-display text-4xl sm:text-5xl md:text-6xl text-text-primary mb-6 leading-tight">
        What is the truth?
      </h1>
      <p className="font-sans text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
        Essays on probability, reasoning, and the gap between what we measure and what we know.
      </p>
    </section>
  )
}
