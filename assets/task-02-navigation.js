const navigationLinks = [...document.querySelectorAll(".section-nav a")];
const sections = navigationLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setCurrentSection(id) {
  navigationLinks.forEach((link) => {
    const current = link.getAttribute("href") === `#${id}`;
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

navigationLinks.forEach((link) => {
  link.addEventListener("click", () => {
    setCurrentSection(link.getAttribute("href").slice(1));
  });
});

const initialSection = window.location.hash.slice(1);
if (sections.some((section) => section.id === initialSection)) {
  setCurrentSection(initialSection);
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setCurrentSection(visible.target.id);
  },
  { rootMargin: "-12% 0px -72% 0px", threshold: [0, 0.1, 0.25] },
);

sections.forEach((section) => observer.observe(section));

const collisionVisual = document.querySelector(".collision-visual");
const animationButton = document.querySelector("[data-collision-animation]");
const animationLabel = document.querySelector(
  "[data-collision-animation-label]",
);
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (collisionVisual) {
  const collisionObserver = new IntersectionObserver(
    ([entry]) => {
      collisionVisual.classList.toggle(
        "is-motion-active",
        entry.isIntersecting,
      );
    },
    { threshold: 0.2 },
  );
  collisionObserver.observe(collisionVisual);
}

if (animationButton && animationLabel && collisionVisual) {
  if (reducedMotion) {
    animationButton.hidden = true;
    collisionVisual.classList.add("is-paused");
  } else {
    animationButton.addEventListener("click", () => {
      const paused = collisionVisual.classList.toggle("is-paused");
      animationButton.setAttribute("aria-pressed", String(paused));
      animationLabel.textContent = paused
        ? "Resume animation"
        : "Pause animation";
    });
  }
}
