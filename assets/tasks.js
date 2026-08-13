const root = document.documentElement;
const rows = [...document.querySelectorAll("[data-task]")];
const cursor = document.querySelector("[data-cursor]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointer = window.matchMedia("(pointer: coarse)");

let activeRow = rows[0];

function setActiveRow(row) {
  if (!row || row === activeRow) return;

  activeRow?.classList.remove("is-active");
  row.classList.add("is-active");
  activeRow = row;
  root.style.setProperty("--active-accent", row.style.getPropertyValue("--task-accent"));
}

rows.forEach((row) => {
  row.addEventListener("mouseenter", () => setActiveRow(row));
  row.addEventListener("focus", () => setActiveRow(row));
  row.addEventListener("click", (event) => {
    setActiveRow(row);
    if (!row.classList.contains("is-ready")) event.preventDefault();
  });
});

if (!reduceMotion.matches) {
  let targetX = window.innerWidth * 0.72;
  let targetY = window.innerHeight * 0.3;
  let x = targetX;
  let y = targetY;

  function animatePointer() {
    x += (targetX - x) * 0.09;
    y += (targetY - y) * 0.09;
    root.style.setProperty("--pointer-x", `${(x / window.innerWidth) * 100}%`);
    root.style.setProperty("--pointer-y", `${(y / window.innerHeight) * 100}%`);

    if (!coarsePointer.matches) {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
    requestAnimationFrame(animatePointer);
  }

  window.addEventListener("pointermove", (event) => {
    targetX = event.clientX;
    targetY = event.clientY;
    if (!coarsePointer.matches) cursor.classList.add("is-visible");
  });

  document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
  animatePointer();
}

root.style.setProperty("--active-accent", rows[0]?.style.getPropertyValue("--task-accent") || "#55e6ff");
