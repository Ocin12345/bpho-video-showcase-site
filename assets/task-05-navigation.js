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

if ("IntersectionObserver" in window) {
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
}
