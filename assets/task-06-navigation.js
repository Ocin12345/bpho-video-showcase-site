const links = [...document.querySelectorAll(".section-nav a")];
const sections = links
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setCurrent(id) {
  links.forEach((link) => {
    if (link.getAttribute("href") === `#${id}`) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

links.forEach((link) => {
  link.addEventListener("click", () => setCurrent(link.hash.slice(1)));
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setCurrent(visible.target.id);
    },
    { rootMargin: "-12% 0px -72% 0px", threshold: [0, 0.1, 0.25] },
  );
  sections.forEach((section) => observer.observe(section));
}
